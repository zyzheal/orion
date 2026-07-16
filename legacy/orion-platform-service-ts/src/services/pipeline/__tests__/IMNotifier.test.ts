/**
 * IMNotifier Tests
 *
 * 测试 IMNotifier 的通知分发逻辑、错误处理和便捷方法。
 */

import { IMNotifier, IMAdapter, IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../../models/PipelineRun';

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

describe('IMNotifier', () => {
  let notifier: IMNotifier;

  beforeEach(() => {
    notifier = new IMNotifier();
  });

  // Helper to create a sample PipelineRun
  function createSampleRun(override?: Partial<PipelineRun>): PipelineRun {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 30000); // 30 seconds ago
    return {
      id: 'run-123',
      pipelineId: 'pipeline-main',
      pipelineVersion: '1',
      triggerType: TriggerType.MANUAL,
      triggerBy: 'user-001',
      status: PipelineRunStatus.SUCCESS,
      startedAt,
      completedAt: now,
      durationMs: 30000,
      context: {},
      createdAt: startedAt,
      updatedAt: now,
      ...override,
    };
  }

  // Helper to create a sample config
  function createSampleConfig(override?: Partial<IMNotificationConfig>): IMNotificationConfig {
    return {
      type: 'dingtalk',
      webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=test',
      name: 'Test Channel',
      ...override,
    };
  }

  describe('registerAdapter', () => {
    it('should register an adapter and increase count', () => {
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn(),
      };

      expect(notifier.getAdapterCount()).toBe(0);
      notifier.registerAdapter(mockAdapter);
      expect(notifier.getAdapterCount()).toBe(1);
    });

    it('should replace adapter of the same type', () => {
      const adapter1: IMAdapter = { platformType: 'dingtalk', send: jest.fn() };
      const adapter2: IMAdapter = { platformType: 'dingtalk', send: jest.fn() };

      notifier.registerAdapter(adapter1);
      notifier.registerAdapter(adapter2);
      expect(notifier.getAdapterCount()).toBe(1);
    });
  });

  describe('sendNotification', () => {
    it('should call adapter send method when adapter exists', async () => {
      const mockSend = jest.fn().mockResolvedValue(undefined);
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: mockSend,
      };
      notifier.registerAdapter(mockAdapter);

      const config = createSampleConfig();
      const payload: IMNotificationPayload = {
        title: 'Test',
        content: 'Content',
        pipelineName: 'pipeline-main',
        runId: 'run-123',
        status: 'success',
      };

      await notifier.sendNotification(config, payload);

      expect(mockSend).toHaveBeenCalledWith(config, payload);
    });

    it('should not throw when adapter is not found', async () => {
      const config = createSampleConfig({ type: 'feishu' });
      const payload: IMNotificationPayload = {
        title: 'Test',
        content: 'Content',
        pipelineName: 'pipeline-main',
        runId: 'run-123',
        status: 'success',
      };

      // Should not throw
      await expect(notifier.sendNotification(config, payload)).resolves.not.toThrow();
    });

    it('should not throw when adapter send fails', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Network error'));
      const mockAdapter: IMAdapter = {
        platformType: 'wecom',
        send: mockSend,
      };
      notifier.registerAdapter(mockAdapter);

      const config = createSampleConfig({ type: 'wecom' });
      const payload: IMNotificationPayload = {
        title: 'Test',
        content: 'Content',
        pipelineName: 'pipeline-main',
        runId: 'run-123',
        status: 'success',
      };

      // Should not throw - errors are caught and logged
      await expect(notifier.sendNotification(config, payload)).resolves.not.toThrow();
    });
  });

  describe('notifyOnPipelineComplete', () => {
    it('should send success notification with correct payload', async () => {
      const capturedPayloads: IMNotificationPayload[] = [];
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation((config: IMNotificationConfig, payload: IMNotificationPayload) => {
          capturedPayloads.push(payload);
          return Promise.resolve();
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun({ status: PipelineRunStatus.SUCCESS });
      const config = createSampleConfig();

      await notifier.notifyOnPipelineComplete(run, config, 'My Pipeline');

      expect(capturedPayloads).toHaveLength(1);
      expect(capturedPayloads[0].status).toBe('success');
      expect(capturedPayloads[0].pipelineName).toBe('My Pipeline');
      expect(capturedPayloads[0].runId).toBe('run-123');
      expect(capturedPayloads[0].duration).toBe('30s');
    });

    it('should use pipelineId as name when pipelineName not provided', async () => {
      const capturedPayloads: IMNotificationPayload[] = [];
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation((config: IMNotificationConfig, payload: IMNotificationPayload) => {
          capturedPayloads.push(payload);
          return Promise.resolve();
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun();
      const config = createSampleConfig();

      await notifier.notifyOnPipelineComplete(run, config);

      expect(capturedPayloads[0].pipelineName).toBe('pipeline-main');
    });

    it('should format duration correctly for minutes', async () => {
      const capturedPayloads: IMNotificationPayload[] = [];
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation((config: IMNotificationConfig, payload: IMNotificationPayload) => {
          capturedPayloads.push(payload);
          return Promise.resolve();
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun({ durationMs: 125000 }); // 2m 5s
      const config = createSampleConfig();

      await notifier.notifyOnPipelineComplete(run, config);

      expect(capturedPayloads[0].duration).toBe('2m 5s');
    });
  });

  describe('notifyOnPipelineFailure', () => {
    it('should send failure notification with correct payload', async () => {
      const capturedPayloads: IMNotificationPayload[] = [];
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation((config: IMNotificationConfig, payload: IMNotificationPayload) => {
          capturedPayloads.push(payload);
          return Promise.resolve();
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun({ status: PipelineRunStatus.FAILED, durationMs: 15000 });
      const config = createSampleConfig();

      await notifier.notifyOnPipelineFailure(run, config, 'Deploy Pipeline');

      expect(capturedPayloads).toHaveLength(1);
      expect(capturedPayloads[0].status).toBe('failed');
      expect(capturedPayloads[0].pipelineName).toBe('Deploy Pipeline');
      expect(capturedPayloads[0].duration).toBe('15s');
    });
  });

  describe('notifyOnPipelineCancelled', () => {
    it('should send cancelled notification with correct payload', async () => {
      const capturedPayloads: IMNotificationPayload[] = [];
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation((config: IMNotificationConfig, payload: IMNotificationPayload) => {
          capturedPayloads.push(payload);
          return Promise.resolve();
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun({ status: PipelineRunStatus.CANCELLED, durationMs: 5000 });
      const config = createSampleConfig();

      await notifier.notifyOnPipelineCancelled(run, config, 'Build Pipeline');

      expect(capturedPayloads).toHaveLength(1);
      expect(capturedPayloads[0].status).toBe('cancelled');
      expect(capturedPayloads[0].pipelineName).toBe('Build Pipeline');
      expect(capturedPayloads[0].duration).toBe('5s');
    });
  });

  describe('sendBatch', () => {
    it('should send to multiple configs in parallel', async () => {
      const sentCounts: string[] = [];
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation(async () => {
          sentCounts.push('sent');
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const configs: IMNotificationConfig[] = [
        createSampleConfig({ name: 'Channel 1' }),
        createSampleConfig({ name: 'Channel 2' }),
        createSampleConfig({ name: 'Channel 3' }),
      ];
      const payload: IMNotificationPayload = {
        title: 'Batch Test',
        content: 'Content',
        pipelineName: 'pipeline-main',
        runId: 'run-123',
        status: 'success',
      };

      await notifier.sendBatch(configs, payload);

      expect(sentCounts).toHaveLength(3);
    });

    it('should not fail batch if one notification fails', async () => {
      let callCount = 0;
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Second call failed');
          }
        }),
      };
      notifier.registerAdapter(mockAdapter);

      const configs: IMNotificationConfig[] = [
        createSampleConfig({ name: 'Channel 1' }),
        createSampleConfig({ name: 'Channel 2' }),
        createSampleConfig({ name: 'Channel 3' }),
      ];
      const payload: IMNotificationPayload = {
        title: 'Batch Test',
        content: 'Content',
        pipelineName: 'pipeline-main',
        runId: 'run-123',
        status: 'success',
      };

      // Should not throw even if one fails
      await expect(notifier.sendBatch(configs, payload)).resolves.not.toThrow();
      expect(callCount).toBe(3);
    });
  });

  describe('error handling - pipeline state protection', () => {
    it('should not throw error when webhook fails during notifyOnPipelineComplete', async () => {
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockRejectedValue(new Error('Webhook failed')),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun();
      const config = createSampleConfig();

      // Notification failure should not affect pipeline
      await expect(notifier.notifyOnPipelineComplete(run, config)).resolves.not.toThrow();
    });

    it('should not throw error when webhook fails during notifyOnPipelineFailure', async () => {
      const mockAdapter: IMAdapter = {
        platformType: 'dingtalk',
        send: jest.fn().mockRejectedValue(new Error('Webhook timeout')),
      };
      notifier.registerAdapter(mockAdapter);

      const run = createSampleRun({ status: PipelineRunStatus.FAILED });
      const config = createSampleConfig();

      await expect(notifier.notifyOnPipelineFailure(run, config)).resolves.not.toThrow();
    });
  });
});
