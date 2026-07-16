/**
 * NotificationDispatcher - Enhanced Tests
 *
 * Tests for template variable resolution and multi-channel dispatch.
 * P3 feature from neatlogic-autoexec comparison analysis.
 */

import { NotificationDispatcher } from '../NotificationDispatcher';
import { IMNotifier } from '../IMNotifier';
import { WebhookNotifier } from '../WebhookNotifier';
import type { NotificationTemplate, NotificationContext } from '../NotificationDispatcher';

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcher;
  let mockIMNotifier: jest.Mocked<IMNotifier>;
  let mockWebhookNotifier: jest.Mocked<WebhookNotifier>;

  beforeEach(() => {
    mockIMNotifier = {
      sendNotification: jest.fn().mockResolvedValue(undefined),
      sendWithTemplate: jest.fn(),
    } as any;

    mockWebhookNotifier = {
      sendWebhook: jest.fn().mockResolvedValue(undefined),
      sendWithTemplate: jest.fn().mockResolvedValue(undefined),
      shouldSend: jest.fn(() => true),
    } as any;

    dispatcher = new NotificationDispatcher(mockIMNotifier, mockWebhookNotifier);
  });

  // ==================== Template Resolution ====================

  describe('resolveTemplate', () => {
    test('should resolve {{run.id}} placeholder', () => {
      const context: NotificationContext = {
        run: { id: 'run-123', pipelineId: 'p-1', status: 'success' },
      };

      const result = dispatcher.resolveTemplate('Run {{run.id}} completed', context);
      expect(result).toBe('Run run-123 completed');
    });

    test('should resolve {{stages.<name>.status}} placeholder', () => {
      const context: NotificationContext = {
        run: { id: 'run-1', pipelineId: 'p-1', status: 'success' },
        stages: { build: { status: 'success' } },
      };

      const result = dispatcher.resolveTemplate('Build: {{stages.build.status}}', context);
      expect(result).toBe('Build: success');
    });

    test('should resolve {{tasks.<name>.outputs.<key>}} placeholder', () => {
      const context: NotificationContext = {
        run: { id: 'run-1', pipelineId: 'p-1', status: 'success' },
        tasks: { test: { outputs: { passRate: '0.95' } } },
      };

      const result = dispatcher.resolveTemplate('Pass rate: {{tasks.test.outputs.passRate}}', context);
      expect(result).toBe('Pass rate: 0.95');
    });

    test('should resolve {{pipeline.<key>}} placeholder', () => {
      const context: NotificationContext = {
        run: { id: 'run-1', pipelineId: 'p-1', status: 'success' },
        pipeline: { name: 'my-pipeline' },
      };

      const result = dispatcher.resolveTemplate('Pipeline: {{pipeline.name}}', context);
      expect(result).toBe('Pipeline: my-pipeline');
    });

    test('should keep unresolved placeholders as-is', () => {
      const context: NotificationContext = {
        run: { id: 'run-1', pipelineId: 'p-1', status: 'success' },
      };

      const result = dispatcher.resolveTemplate('Unknown: {{nonexistent.field}}', context);
      expect(result).toBe('Unknown: {{nonexistent.field}}');
    });

    test('should resolve multiple placeholders in one template', () => {
      const context: NotificationContext = {
        run: { id: 'run-1', pipelineId: 'p-1', status: 'success' },
        stages: { build: { status: 'success' } },
      };

      const result = dispatcher.resolveTemplate(
        'Run {{run.id}}: {{stages.build.status}}',
        context,
      );
      expect(result).toBe('Run run-1: success');
    });
  });

  // ==================== sendWithTemplate ====================

  describe('sendWithTemplate', () => {
    test('should send to IM channels with resolved template', async () => {
      const template: NotificationTemplate = {
        subject: 'Pipeline {{run.id}} {{run.status}}',
        body: 'Build status: {{stages.build.status}}',
        channels: ['im'],
        imChannels: [
          { type: 'dingtalk', webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx', name: 'dingtalk-channel' },
        ],
      };

      const context: NotificationContext = {
        run: { id: 'run-123', pipelineId: 'p-1', status: 'success' },
        stages: { build: { status: 'success' } },
      };

      await dispatcher.sendWithTemplate({
        template,
        context,
      });

      expect(mockIMNotifier.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dingtalk' }),
        expect.objectContaining({
          title: 'Pipeline run-123 success',
          content: expect.stringContaining('Build status: success'),
        }),
      );
    });

    test('should send to webhook channels with resolved template', async () => {
      const template: NotificationTemplate = {
        subject: 'Pipeline {{run.id}}',
        body: 'Status: {{run.status}}',
        channels: ['webhook'],
        webhookChannels: [
          { url: 'https://example.com/webhook', events: ['pipeline.complete'] },
        ],
      };

      const context: NotificationContext = {
        run: { id: 'run-456', pipelineId: 'p-2', status: 'success' },
      };

      await dispatcher.sendWithTemplate({ template, context });

      expect(mockWebhookNotifier.sendWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/webhook' }),
        expect.objectContaining({
          eventType: 'pipeline.complete',
          runId: 'run-456',
        }),
      );
    });

    test('should send to multiple channels simultaneously', async () => {
      const template: NotificationTemplate = {
        subject: 'Alert',
        body: 'Pipeline {{run.id}} completed',
        channels: ['im', 'webhook'],
        imChannels: [
          { type: 'dingtalk', webhookUrl: 'https://dingtalk.com', name: 'dt' },
        ],
        webhookChannels: [
          { url: 'https://example.com/hook', events: ['pipeline.complete'] },
        ],
      };

      const context: NotificationContext = {
        run: { id: 'run-789', pipelineId: 'p-3', status: 'success' },
      };

      await dispatcher.sendWithTemplate({ template, context });

      expect(mockIMNotifier.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockWebhookNotifier.sendWebhook).toHaveBeenCalledTimes(1);
    });

    test('should handle missing channel configs gracefully', async () => {
      const template: NotificationTemplate = {
        subject: 'Test',
        body: 'Body',
        channels: ['webhook'],
        // No webhookChannels provided
      };

      const context: NotificationContext = {
        run: { id: 'run-1', pipelineId: 'p-1', status: 'success' },
      };

      // Should not throw
      await expect(dispatcher.sendWithTemplate({ template, context })).resolves.toBeUndefined();
      expect(mockWebhookNotifier.sendWebhook).not.toHaveBeenCalled();
    });
  });
});
