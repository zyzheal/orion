/**
 * Plugin Executor Service 测试
 */

// Mock child_process to avoid real Docker/process execution
jest.mock('child_process', () => {
  const actualSpawn = jest.fn((cmd: string, args: string[]) => {
    const stdoutData = (args[0] === 'create' || args[0] === 'start' || args[0] === 'inspect')
      ? 'Container plugin executed successfully'
      : 'Process plugin executed successfully';

    const child = {
      pid: 12345,
      stdout: {
        on: jest.fn((event: string, cb: Function) => {
          if (event === 'data') {
            // Fire data immediately when listener is registered
            process.nextTick(() => cb(Buffer.from(stdoutData)));
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn((event: string, cb: Function) => {
        if (event === 'close') {
          process.nextTick(() => cb(0));
        }
      }),
      kill: jest.fn(),
      killed: false,
    };

    return child;
  });

  return { spawn: actualSpawn };
});

// Mock ExecutionGuardian to avoid setInterval
jest.mock('../guardian/ExecutionGuardian', () => ({
  ExecutionGuardian: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    registerTask: jest.fn(),
    unregisterTask: jest.fn(),
    createAbortSignal: jest.fn(() => ({
      signal: { aborted: false, addEventListener: jest.fn() },
    })),
  })),
}));

// Mock ProcessKiller
jest.mock('../guardian/ProcessKiller', () => ({
  ProcessKiller: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    unregister: jest.fn(),
  })),
}));

// Mock WasmRuntime
jest.mock('../inline-script/WasmRuntime', () => ({
  WasmRuntime: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, stdout: 'WASM executed' }),
  })),
}));

import { PluginExecutorService, TaskStatus } from '../plugin-executor-service';
import { PluginManagerService } from '../plugin-manager-service';
import { EventBusService } from '../event-bus-service';

describe('PluginExecutorService', () => {
  let pluginExecutor: PluginExecutorService;
  let pluginManager: PluginManagerService;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockReturnValue(true),
    } as any;

    pluginManager = new PluginManagerService({ eventBus: mockEventBus });
    pluginExecutor = new PluginExecutorService({
      pluginManager,
      eventBus: mockEventBus,
    });

    // Install and activate the test plugins
    await pluginManager.installPlugin('security-scan', '1.0.0');
    await pluginManager.activatePlugin('security-scan');
  });

  afterEach(async () => {
    await pluginExecutor.shutdown();
  });

  describe('executeTask', () => {
    it('should execute a plugin task successfully', async () => {
      const result = await pluginExecutor.executeTask({
        taskId: 'test-task-001',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'security-scan',
        config: {
          scanType: 'fs',
          severity: 'CRITICAL,HIGH',
        },
        workspace: {
          rootPath: '/tmp/workspace',
        },
      });

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.exitCode).toBe(0);
      expect(result.taskId).toBe('test-task-001');
    });

    it('should throw error if plugin not active', async () => {
      const result = await pluginExecutor.executeTask({
        taskId: 'test-task-002',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'non-existent-plugin',
        config: {},
        workspace: { rootPath: '/tmp/workspace' },
      });

      // Plugin not found returns FAILED status
      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.errorMessage).toContain('not found');
    });

    it('should publish task started event', async () => {
      await pluginExecutor.executeTask({
        taskId: 'test-task-003',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'security-scan',
        config: {},
        workspace: { rootPath: '/tmp/workspace' },
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.task.started',
        expect.any(Object),
        { source: 'plugin-executor' }
      );
    });

    it('should publish task completed event', async () => {
      await pluginExecutor.executeTask({
        taskId: 'test-task-004',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'security-scan',
        config: {},
        workspace: { rootPath: '/tmp/workspace' },
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.task.completed',
        expect.any(Object),
        { source: 'plugin-executor' }
      );
    });

    it('should save execution result', async () => {
      const result = await pluginExecutor.executeTask({
        taskId: 'test-task-005',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'security-scan',
        config: {},
        workspace: { rootPath: '/tmp/workspace' },
      });

      const savedResult = pluginExecutor.getExecutionResult('test-task-005');
      expect(savedResult).toEqual(result);
    });
  });

  describe('executeTask with different security levels', () => {
    beforeEach(async () => {
      // Install and activate additional plugins
      await pluginManager.installPlugin('code-quality', '1.0.0');
      await pluginManager.activatePlugin('code-quality');
    });

    it('should execute LOW security plugin via process', async () => {
      const result = await pluginExecutor.executeTask({
        taskId: 'test-task-006',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'code-quality',
        config: {},
        workspace: { rootPath: '/tmp/workspace' },
      });

      expect(result.status).toBe(TaskStatus.SUCCESS);
      // LOW security uses process execution, outputs should include result
      expect(result.outputs).toBeDefined();
    });

    it('should execute MEDIUM security plugin via container', async () => {
      const result = await pluginExecutor.executeTask({
        taskId: 'test-task-007',
        pipelineRunId: 'run-001',
        stageId: 'stage-001',
        pluginId: 'security-scan',
        config: {},
        workspace: { rootPath: '/tmp/workspace' },
      });

      expect(result.status).toBe(TaskStatus.SUCCESS);
      // MEDIUM security uses container execution, outputs should include result
      expect(result.outputs).toBeDefined();
    });
  });
});
