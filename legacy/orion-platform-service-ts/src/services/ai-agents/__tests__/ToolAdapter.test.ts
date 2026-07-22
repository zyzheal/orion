/**
 * ToolAdapter Tests
 *
 * Covers:
 * - Constructor: registers built-in tools
 * - registerTool / registerTools: custom tool registration, overwriting existing
 * - getTool / getToolNames / hasTool / removeTool
 * - executeTool(): success, failure, tool not found, handler throws
 * - Built-in tools: pipeline, deploy, monitoring, git, log_query (all actions)
 */

import { ToolAdapter } from '../base/ToolAdapter';
import { ToolDefinition, AgentExecutionContext } from '../base/types';

function createContext(): AgentExecutionContext {
  return { traceId: 't1', userId: 'u1', tenantId: 'ten1' };
}

function createCustomTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'custom-tool',
    description: 'A custom test tool',
    inputSchema: { type: 'object' },
    handler: jest.fn().mockResolvedValue({ success: true, data: 'custom-result' }),
    ...overrides,
  };
}

describe('ToolAdapter', () => {
  let adapter: ToolAdapter;

  beforeEach(() => {
    adapter = new ToolAdapter();
  });

  // ==================== Built-in Tools ====================

  describe('built-in tools', () => {
    it('should register 5 built-in tools on construction', () => {
      const names = adapter.getToolNames();
      expect(names).toContain('pipeline');
      expect(names).toContain('deploy');
      expect(names).toContain('monitoring');
      expect(names).toContain('git');
      expect(names).toContain('log_query');
      expect(names.length).toBe(5);
    });

    it('should have tool definitions for each built-in tool', () => {
      for (const name of ['pipeline', 'deploy', 'monitoring', 'git', 'log_query']) {
        const tool = adapter.getTool(name);
        expect(tool).toBeDefined();
        expect(tool!.name).toBe(name);
        expect(tool!.description).toBeTruthy();
        expect(tool!.handler).toBeInstanceOf(Function);
      }
    });
  });

  // ==================== pipeline tool ====================

  describe('pipeline tool', () => {
    it('should handle "list" action', async () => {
      const result = await adapter.executeTool('pipeline', { action: 'list' }, createContext());
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('pipelines');
      expect(result.data).toHaveProperty('total', 0);
    });

    it('should handle "get" action', async () => {
      const result = await adapter.executeTool(
        'pipeline',
        { action: 'get', pipelineId: 'p-1' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('pipelineId', 'p-1');
      expect(result.data).toHaveProperty('status', 'active');
    });

    it('should handle "run" action', async () => {
      const result = await adapter.executeTool(
        'pipeline',
        { action: 'run' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('runId');
      expect(result.data).toHaveProperty('status', 'triggered');
    });

    it('should return error for unsupported action', async () => {
      const result = await adapter.executeTool(
        'pipeline',
        { action: 'unknown-action' },
        createContext()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action');
    });
  });

  // ==================== deploy tool ====================

  describe('deploy tool', () => {
    it('should handle "list" action', async () => {
      const result = await adapter.executeTool('deploy', { action: 'list' }, createContext());
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployments');
    });

    it('should handle "status" action', async () => {
      const result = await adapter.executeTool(
        'deploy',
        { action: 'status', deploymentId: 'd-1', environment: 'staging' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deploymentId', 'd-1');
      expect(result.data).toHaveProperty('environment', 'staging');
    });

    it('should handle "deploy" action', async () => {
      const result = await adapter.executeTool(
        'deploy',
        { action: 'deploy', environment: 'prod', version: 'v1.0' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status', 'deployed');
    });

    it('should handle "rollback" action', async () => {
      const result = await adapter.executeTool(
        'deploy',
        { action: 'rollback', deploymentId: 'd-2' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status', 'rolled_back');
    });

    it('should return error for unsupported action', async () => {
      const result = await adapter.executeTool(
        'deploy',
        { action: 'delete' },
        createContext()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action');
    });
  });

  // ==================== monitoring tool ====================

  describe('monitoring tool', () => {
    it('should handle "metrics" action', async () => {
      const result = await adapter.executeTool(
        'monitoring',
        { action: 'metrics', metricType: 'cpu', timeRange: '1h' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('metrics');
      expect(result.data).toHaveProperty('metricType', 'cpu');
    });

    it('should handle "alerts" action', async () => {
      const result = await adapter.executeTool(
        'monitoring',
        { action: 'alerts' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('alerts');
    });

    it('should handle "status" action', async () => {
      const result = await adapter.executeTool(
        'monitoring',
        { action: 'status' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('systemStatus', 'healthy');
    });

    it('should return error for unsupported action', async () => {
      const result = await adapter.executeTool(
        'monitoring',
        { action: 'deploy' },
        createContext()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action');
    });
  });

  // ==================== git tool ====================

  describe('git tool', () => {
    it('should handle "commits" action', async () => {
      const result = await adapter.executeTool(
        'git',
        { action: 'commits', repo: 'my-repo', branch: 'main', count: 5 },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('commits');
      expect(result.data).toHaveProperty('repo', 'my-repo');
      expect(result.data).toHaveProperty('count', 5);
    });

    it('should handle "branches" action', async () => {
      const result = await adapter.executeTool(
        'git',
        { action: 'branches', repo: 'my-repo' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('branches');
    });

    it('should handle "diff" action', async () => {
      const result = await adapter.executeTool(
        'git',
        { action: 'diff', commitHash: 'abc123', branch: 'main' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('diff');
    });

    it('should return error for unsupported action', async () => {
      const result = await adapter.executeTool(
        'git',
        { action: 'push' },
        createContext()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action');
    });
  });

  // ==================== log_query tool ====================

  describe('log_query tool', () => {
    it('should handle "query" action', async () => {
      const result = await adapter.executeTool(
        'log_query',
        { action: 'query', query: 'error', timeRange: '1h' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('logs');
      expect(result.data).toHaveProperty('query', 'error');
    });

    it('should handle "search" action', async () => {
      const result = await adapter.executeTool(
        'log_query',
        { action: 'search', query: 'timeout', level: 'error', service: 'api' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('matched');
    });

    it('should handle "aggregate" action', async () => {
      const result = await adapter.executeTool(
        'log_query',
        { action: 'aggregate', query: 'status:500', timeRange: '24h' },
        createContext()
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('aggregation');
    });

    it('should return error for unsupported action', async () => {
      const result = await adapter.executeTool(
        'log_query',
        { action: 'delete' },
        createContext()
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action');
    });
  });

  // ==================== Custom Tool Registration ====================

  describe('registerTool', () => {
    it('should register a custom tool', () => {
      const tool = createCustomTool();
      adapter.registerTool(tool);

      expect(adapter.hasTool('custom-tool')).toBe(true);
      expect(adapter.getTool('custom-tool')).toBe(tool);
    });

    it('should overwrite an existing tool with the same name', () => {
      const tool1 = createCustomTool({
        handler: jest.fn().mockResolvedValue({ success: true, data: 'v1' }),
      });
      const tool2 = createCustomTool({
        handler: jest.fn().mockResolvedValue({ success: true, data: 'v2' }),
      });

      adapter.registerTool(tool1);
      adapter.registerTool(tool2);

      // Should still have same count (5 built-in + 1 custom)
      const names = adapter.getToolNames();
      expect(names.filter((n) => n === 'custom-tool').length).toBe(1);
    });

    it('should overwrite a built-in tool', async () => {
      const customPipeline = createCustomTool({
        name: 'pipeline',
        handler: jest.fn().mockResolvedValue({ success: true, data: 'custom-pipeline' }),
      });

      adapter.registerTool(customPipeline);

      const result = await adapter.executeTool('pipeline', { action: 'list' }, createContext());
      expect(result.data).toBe('custom-pipeline');
    });
  });

  describe('registerTools', () => {
    it('should register multiple tools at once', () => {
      const tools = [
        createCustomTool({ name: 'tool-a' }),
        createCustomTool({ name: 'tool-b' }),
      ];

      adapter.registerTools(tools);

      expect(adapter.hasTool('tool-a')).toBe(true);
      expect(adapter.hasTool('tool-b')).toBe(true);
    });
  });

  // ==================== hasTool / removeTool ====================

  describe('hasTool', () => {
    it('should return true for existing tool', () => {
      expect(adapter.hasTool('pipeline')).toBe(true);
    });

    it('should return false for non-existing tool', () => {
      expect(adapter.hasTool('nonexistent')).toBe(false);
    });
  });

  describe('removeTool', () => {
    it('should remove an existing tool', () => {
      expect(adapter.removeTool('pipeline')).toBe(true);
      expect(adapter.hasTool('pipeline')).toBe(false);
      expect(adapter.getToolNames().length).toBe(4);
    });

    it('should return false when removing non-existing tool', () => {
      expect(adapter.removeTool('nonexistent')).toBe(false);
    });
  });

  // ==================== executeTool ====================

  describe('executeTool', () => {
    it('should return durationMs in the result', async () => {
      const result = await adapter.executeTool('pipeline', { action: 'list' }, createContext());
      expect(result).toHaveProperty('durationMs');
      expect(typeof result.durationMs).toBe('number');
    });

    it('should return failure for non-existing tool', async () => {
      const result = await adapter.executeTool('ghost-tool', {}, createContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain("Tool 'ghost-tool' not found");
    });

    it('should catch handler exceptions and return failure', async () => {
      const throwingTool = createCustomTool({
        name: 'throwing',
        handler: jest.fn().mockRejectedValue(new Error('handler exploded')),
      });
      adapter.registerTool(throwingTool);

      const result = await adapter.executeTool('throwing', {}, createContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('handler exploded');
    });

    it('should catch non-Error exceptions from handler', async () => {
      const throwingTool = createCustomTool({
        name: 'string-throw',
        handler: jest.fn().mockRejectedValue('string-error'),
      });
      adapter.registerTool(throwingTool);

      const result = await adapter.executeTool('string-throw', {}, createContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('string-error');
    });

    it('should pass params and context to handler', async () => {
      const handler = jest.fn().mockResolvedValue({ success: true, data: null });
      const tool = createCustomTool({ name: 'spy-tool', handler });
      adapter.registerTool(tool);

      const ctx = createContext();
      await adapter.executeTool('spy-tool', { key: 'value' }, ctx);

      expect(handler).toHaveBeenCalledWith({ key: 'value' }, ctx);
    });
  });

  // ==================== getToolNames ====================

  describe('getToolNames', () => {
    it('should return a new array each time', () => {
      const names1 = adapter.getToolNames();
      const names2 = adapter.getToolNames();
      expect(names1).not.toBe(names2);
      expect(names1).toEqual(names2);
    });
  });
});
