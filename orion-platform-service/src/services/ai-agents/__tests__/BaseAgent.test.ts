/**
 * BaseAgent Tests
 *
 * Covers:
 * - Constructor (enabled/disabled agent)
 * - isEnabled / getStatus / getInfo / getConfig / getLastError / getCurrentConcurrency
 * - execute(): success path, disabled agent error, concurrency limit, retry logic
 * - callAI(): success, failure (OrionError)
 * - callTool(): success, failure (OrionError)
 * - validateContext(): missing traceId, userId, tenantId
 * - Audit log: record, clear, capacity limit
 */

import { BaseAgent } from '../base/BaseAgent';
import { AgentConfig, AgentExecutionContext } from '../base/types';

// Concrete subclass for testing the abstract BaseAgent
class TestableAgent extends BaseAgent {
  public doExecuteCalls: unknown[] = [];
  public doExecuteResult: unknown = 'test-result';
  public doExecuteError: Error | null = null;
  public doExecuteDelayMs = 0;

  protected async doExecute(input: unknown, context: AgentExecutionContext): Promise<unknown> {
    this.doExecuteCalls.push({ input, context });
    if (this.doExecuteDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.doExecuteDelayMs));
    }
    if (this.doExecuteError) {
      throw this.doExecuteError;
    }
    return this.doExecuteResult;
  }

  // Expose protected methods for testing
  public testCallAI(prompt: string) {
    return this.callAI(prompt);
  }

  public testCallTool(toolName: string, params: Record<string, unknown>, context: AgentExecutionContext) {
    return this.callTool(toolName, params, context);
  }

  public testValidateContext(context: AgentExecutionContext) {
    return this.validateContext(context);
  }
}

// -- Mock Factories --

function createMockAIGateway(overrides: Record<string, unknown> = {}) {
  return {
    execute: jest.fn().mockResolvedValue({ success: true, data: 'ai-response' }),
    health: jest.fn().mockResolvedValue({ status: 'healthy' }),
    ...overrides,
  } as any;
}

function createMockToolAdapter(overrides: Record<string, unknown> = {}) {
  return {
    executeTool: jest.fn().mockResolvedValue({ success: true, data: 'tool-data' }),
    getToolNames: jest.fn().mockReturnValue(['pipeline', 'deploy']),
    registerTool: jest.fn(),
    ...overrides,
  } as any;
}

function createDefaultConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    enabled: true,
    scenario: 'test-scenario',
    provider: 'sonnet',
    maxConcurrency: 3,
    timeoutMs: 5000,
    retry: { maxRetries: 0, backoffMs: 100 },
    requiredTools: [],
    requiredPermissions: [],
    ...overrides,
  };
}

function createContext(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    traceId: 'trace-123',
    userId: 'user-1',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

// -- Tests --

describe('BaseAgent', () => {
  beforeEach(() => {
    BaseAgent.clearAuditLogs();
    jest.clearAllMocks();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should initialize with enabled config', () => {
      const agent = new TestableAgent(
        createDefaultConfig({ enabled: true }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(agent.isEnabled()).toBe(true);
      expect(agent.getStatus()).toBe('idle');
    });

    it('should set status to disabled when config.enabled is false', () => {
      const agent = new TestableAgent(
        createDefaultConfig({ enabled: false }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(agent.isEnabled()).toBe(false);
      expect(agent.getStatus()).toBe('disabled');
    });
  });

  // ==================== getInfo / getConfig ====================

  describe('getInfo', () => {
    it('should return correct agent info', () => {
      const config = createDefaultConfig();
      const agent = new TestableAgent(config, createMockAIGateway(), createMockToolAdapter());

      const info = agent.getInfo();
      expect(info.id).toBe('test-agent');
      expect(info.name).toBe('Test Agent');
      expect(info.enabled).toBe(true);
      expect(info.scenario).toBe('test-scenario');
      expect(info.status).toBe('idle');
      expect(info.currentConcurrency).toBe(0);
      expect(info.maxConcurrency).toBe(3);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const config = createDefaultConfig();
      const agent = new TestableAgent(config, createMockAIGateway(), createMockToolAdapter());

      const returned = agent.getConfig();
      expect(returned).toEqual(config);
      // Verify it is a copy (not the same reference)
      returned.id = 'modified';
      expect(agent.getConfig().id).toBe('test-agent');
    });
  });

  // ==================== execute() ====================

  describe('execute', () => {
    it('should return result on successful execution', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );
      agent.doExecuteResult = 'success-data';

      const result = await agent.execute('input-data', createContext());
      expect(result).toBe('success-data');
      expect(agent.getStatus()).toBe('idle');
      expect(agent.getLastError()).toBeUndefined();
    });

    it('should throw when agent is disabled', async () => {
      const agent = new TestableAgent(
        createDefaultConfig({ enabled: false }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      await expect(agent.execute('input', createContext())).rejects.toThrow(
        'Agent test-agent is disabled'
      );
      expect(agent.getStatus()).toBe('error');
    });

    it('should throw when concurrency limit is reached', async () => {
      const agent = new TestableAgent(
        createDefaultConfig({ maxConcurrency: 1 }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      // Start two concurrent calls; the second should fail
      const p1 = agent.execute('first', createContext());
      // The first is running, now the second should hit concurrency limit
      await expect(agent.execute('second', createContext())).rejects.toThrow(
        'concurrency limit reached'
      );

      // Wait for the first to complete
      await p1;
    });

    it('should decrement concurrency counter after execution', async () => {
      const agent = new TestableAgent(
        createDefaultConfig({ maxConcurrency: 2 }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      await agent.execute('input', createContext());
      expect(agent.getCurrentConcurrency()).toBe(0);
    });

    it('should record audit log on success', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      await agent.execute({ key: 'value' }, createContext());

      const logs = await agent.getAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0].agentId).toBe('test-agent');
      expect(logs[0].success).toBe(true);
      expect(logs[0].input).toEqual({ key: 'value' });
      expect(logs[0].context.traceId).toBe('trace-123');
    });

    it('should record audit log on failure', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );
      agent.doExecuteError = new Error('boom');

      await expect(agent.execute('input', createContext())).rejects.toThrow('boom');

      const logs = await agent.getAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error).toBe('boom');
    });

    it('should set status to running during execution', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      let statusDuringExecution: string | undefined;
      agent.doExecuteDelayMs = 50;
      const originalDoExecute = agent.doExecute.bind(agent);
      (agent as any).doExecute = async (input: unknown, ctx: AgentExecutionContext) => {
        statusDuringExecution = agent.getStatus();
        return originalDoExecute(input, ctx);
      };

      await agent.execute('input', createContext());
      expect(statusDuringExecution).toBe('running');
      expect(agent.getStatus()).toBe('idle');
    });

    it('should set status to error when execution fails', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );
      agent.doExecuteError = new Error('fail');

      await expect(agent.execute('input', createContext())).rejects.toThrow();
      expect(agent.getStatus()).toBe('error');
      expect(agent.getLastError()).toBe('fail');
    });
  });

  // ==================== Retry Logic ====================

  describe('retry logic', () => {
    it('should retry on failure up to maxRetries', async () => {
      const agent = new TestableAgent(
        createDefaultConfig({
          retry: { maxRetries: 2, backoffMs: 1 }, // small backoff for fast test
        }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      let callCount = 0;
      const original = agent.doExecute.bind(agent);
      (agent as any).doExecute = async (input: unknown, ctx: AgentExecutionContext) => {
        callCount++;
        if (callCount <= 2) {
          throw new Error(`attempt-${callCount} failed`);
        }
        return 'recovered';
      };

      // We need to patch the private executeWithRetry via doExecute
      // Actually, executeWithRetry calls doExecute internally, so let's override doExecute properly
      // Since executeWithRetry is private and calls this.doExecute, our override works.

      const result = await agent.execute('input', createContext());
      expect(result).toBe('recovered');
      expect(callCount).toBe(3); // 1 initial + 2 retries
    }, 10000);

    it('should throw after exhausting all retries', async () => {
      const agent = new TestableAgent(
        createDefaultConfig({
          retry: { maxRetries: 1, backoffMs: 1 },
        }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      (agent as any).doExecute = async () => {
        throw new Error('always-fail');
      };

      await expect(agent.execute('input', createContext())).rejects.toThrow('always-fail');
    }, 10000);

    it('should not retry when maxRetries is 0', async () => {
      const agent = new TestableAgent(
        createDefaultConfig({
          retry: { maxRetries: 0, backoffMs: 1 },
        }),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      let callCount = 0;
      (agent as any).doExecute = async () => {
        callCount++;
        throw new Error('no-retry');
      };

      await expect(agent.execute('input', createContext())).rejects.toThrow('no-retry');
      expect(callCount).toBe(1);
    });
  });

  // ==================== callAI() ====================

  describe('callAI', () => {
    it('should return AI response on success', async () => {
      const mockGateway = createMockAIGateway({
        execute: jest.fn().mockResolvedValue({ success: true, data: 'generated-text' }),
      });
      const agent = new TestableAgent(createDefaultConfig(), mockGateway, createMockToolAdapter());

      const result = await agent.testCallAI('generate something');
      expect(result).toBe('generated-text');
      expect(mockGateway.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scenario: 'test-scenario',
          input: expect.objectContaining({
            prompt: 'generate something',
            temperature: 0.3,
          }),
        })
      );
    });

    it('should throw OrionError when AI call fails', async () => {
      const mockGateway = createMockAIGateway({
        execute: jest.fn().mockResolvedValue({ success: false, error: 'model overloaded' }),
      });
      const agent = new TestableAgent(createDefaultConfig(), mockGateway, createMockToolAdapter());

      await expect(agent.testCallAI('prompt')).rejects.toThrow('model overloaded');
    });

    it('should use custom temperature and maxTokens from modelConfig', async () => {
      const mockGateway = createMockAIGateway({
        execute: jest.fn().mockResolvedValue({ success: true, data: 'text' }),
      });
      const config = createDefaultConfig({
        modelConfig: { temperature: 0.7, maxTokens: 1000 },
      });
      const agent = new TestableAgent(config, mockGateway, createMockToolAdapter());

      await agent.testCallAI('prompt');

      expect(mockGateway.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            temperature: 0.7,
            maxTokens: 1000,
          }),
        })
      );
    });

    it('should use degradationReason when error is not available', async () => {
      const mockGateway = createMockAIGateway({
        execute: jest.fn().mockResolvedValue({
          success: false,
          degradationReason: 'circuit open',
        }),
      });
      const agent = new TestableAgent(createDefaultConfig(), mockGateway, createMockToolAdapter());

      await expect(agent.testCallAI('prompt')).rejects.toThrow('circuit open');
    });
  });

  // ==================== callTool() ====================

  describe('callTool', () => {
    it('should return tool data on success', async () => {
      const mockAdapter = createMockToolAdapter({
        executeTool: jest.fn().mockResolvedValue({ success: true, data: { items: [1, 2] } }),
      });
      const agent = new TestableAgent(createDefaultConfig(), createMockAIGateway(), mockAdapter);

      const result = await agent.testCallTool('pipeline', { action: 'list' }, createContext());
      expect(result).toEqual({ items: [1, 2] });
      expect(mockAdapter.executeTool).toHaveBeenCalledWith(
        'pipeline',
        { action: 'list' },
        expect.anything()
      );
    });

    it('should throw OrionError when tool execution fails', async () => {
      const mockAdapter = createMockToolAdapter({
        executeTool: jest.fn().mockResolvedValue({ success: false, error: 'not found' }),
      });
      const agent = new TestableAgent(createDefaultConfig(), createMockAIGateway(), mockAdapter);

      await expect(
        agent.testCallTool('deploy', { action: 'status' }, createContext())
      ).rejects.toThrow("Tool 'deploy' execution failed: not found");
    });
  });

  // ==================== validateContext() ====================

  describe('validateContext', () => {
    it('should pass with all required fields', () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(() => agent.testValidateContext(createContext())).not.toThrow();
    });

    it('should throw when traceId is missing', () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(() =>
        agent.testValidateContext(createContext({ traceId: undefined }))
      ).toThrow('Missing required field: traceId');
    });

    it('should throw when userId is missing', () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(() =>
        agent.testValidateContext(createContext({ userId: undefined }))
      ).toThrow('Missing required field: userId');
    });

    it('should throw when tenantId is missing', () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(() =>
        agent.testValidateContext(createContext({ tenantId: undefined }))
      ).toThrow('Missing required field: tenantId');
    });
  });

  // ==================== Audit Log ====================

  describe('audit logs', () => {
    it('should clear audit logs', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      await agent.execute('input', createContext());
      expect((await agent.getAuditLog()).length).toBe(1);

      BaseAgent.clearAuditLogs();
      expect((await agent.getAuditLog()).length).toBe(0);
    });

    it('should limit returned logs with limit parameter', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      await agent.execute('a', createContext());
      await agent.execute('b', createContext());
      await agent.execute('c', createContext());

      expect((await agent.getAuditLog()).length).toBe(3);
      expect((await agent.getAuditLog(1)).length).toBe(1);
      expect((await agent.getAuditLog(2)).length).toBe(2);
    });
  });

  // ==================== getLastError ====================

  describe('getLastError', () => {
    it('should return undefined initially', () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      expect(agent.getLastError()).toBeUndefined();
    });

    it('should clear lastError after successful execution', async () => {
      const agent = new TestableAgent(
        createDefaultConfig(),
        createMockAIGateway(),
        createMockToolAdapter()
      );

      agent.doExecuteError = new Error('first-fail');
      await expect(agent.execute('input', createContext())).rejects.toThrow();
      expect(agent.getLastError()).toBe('first-fail');

      // Now succeed
      agent.doExecuteError = null;
      await agent.execute('input', createContext());
      expect(agent.getLastError()).toBeUndefined();
    });
  });
});
