/**
 * Plugin Executor Service 测试
 */

import { PluginExecutorService, TaskStatus } from '../plugin-executor-service';
import { PluginManagerService } from '../plugin-manager-service';
import { EventBusService } from '../event-bus-service';

describe('PluginExecutorService', () => {
  let pluginExecutor: PluginExecutorService;
  let pluginManager: PluginManagerService;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockReturnValue(true),
    } as any;

    pluginManager = new PluginManagerService({ eventBus: mockEventBus });
    pluginExecutor = new PluginExecutorService({
      pluginManager,
      eventBus: mockEventBus,
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      // 安装并激活插件
      await pluginManager.installPlugin('security-scan', '1.0.0');
      await pluginManager.activatePlugin('security-scan');
    });

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
      await expect(
        pluginExecutor.executeTask({
          taskId: 'test-task-002',
          pipelineRunId: 'run-001',
          stageId: 'stage-001',
          pluginId: 'non-existent-plugin',
          config: {},
          workspace: { rootPath: '/tmp/workspace' },
        })
      ).rejects.toThrow();
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
      // 重新初始化插件（每个测试独立）
      await pluginManager.installPlugin('security-scan', '1.0.0');
      await pluginManager.activatePlugin('security-scan');
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
      expect(result.stdout).toContain('Process');
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
      expect(result.stdout).toContain('Container');
    });
  });
});
