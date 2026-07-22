/**
 * NotificationDispatcher - Multi-channel notification dispatcher with template support
 *
 * Routes notifications to IM and Webhook channels using parameterizable templates.
 * Mirrors NeatLogic's notification strategy pattern.
 *
 * P3 feature from neatlogic-autoexec comparison analysis.
 */

import { IMNotifier, IMNotificationConfig, IMNotificationPayload } from './IMNotifier';
import { WebhookNotifier, WebhookConfig, WebhookPayload } from './WebhookNotifier';

/**
 * Notification template with variable placeholders.
 *
 * Supported template syntax:
 * - {{stages.<name>.status}} - stage execution status
 * - {{tasks.<name>.outputs.<key>}} - task output values
 * - {{run.<field>}} - pipeline run metadata
 * - {{pipeline.<field>}} - pipeline metadata
 */
export interface NotificationTemplate {
  /** Subject/title template */
  subject: string;
  /** Body template (supports markdown) */
  body: string;
  /** Target channels */
  channels: ('im' | 'webhook')[];
  /** IM channel configurations (for 'im' channel) */
  imChannels?: IMNotificationConfig[];
  /** Webhook configurations (for 'webhook' channel) */
  webhookChannels?: WebhookConfig[];
}

export interface NotificationContext {
  /** Pipeline/run metadata */
  run: {
    id: string;
    pipelineId: string;
    status: 'success' | 'failed' | 'cancelled';
    durationMs?: number;
    triggerBy?: string;
  };
  /** Stage results keyed by stage name */
  stages?: Record<string, { status: string; durationMs?: number }>;
  /** Task outputs keyed by task name */
  tasks?: Record<string, Record<string, unknown>>;
  /** Pipeline metadata */
  pipeline?: Record<string, unknown>;
}

export interface SendWithTemplateOptions {
  /** Template to use */
  template: NotificationTemplate;
  /** Runtime context for variable resolution */
  context: NotificationContext;
}

/**
 * NotificationDispatcher - Route notifications through templates
 *
 * Supports runtime variable substitution in notification templates:
 * - {{stages.<name>.status}} - stage execution status
 * - {{tasks.<name>.outputs.<key>}} - task output values
 * - {{run.<field>}} - pipeline run metadata
 */
export class NotificationDispatcher {
  private imNotifier: IMNotifier;
  private webhookNotifier: WebhookNotifier;

  constructor(imNotifier?: IMNotifier, webhookNotifier?: WebhookNotifier) {
    this.imNotifier = imNotifier || new IMNotifier();
    this.webhookNotifier = webhookNotifier || new WebhookNotifier();
  }

  /**
   * Send notification using a template with runtime context.
   *
   * Resolves template variables from the context and dispatches to configured channels.
   */
  async sendWithTemplate(options: SendWithTemplateOptions): Promise<void> {
    const { template, context } = options;

    const subject = this.resolveTemplate(template.subject, context);
    const body = this.resolveTemplate(template.body, context);

    const promises: Promise<void>[] = [];

    // Send to IM channels
    if (template.channels.includes('im') && template.imChannels) {
      for (const channel of template.imChannels) {
        const payload: IMNotificationPayload = {
          title: subject,
          content: body,
          pipelineName: context.run.pipelineId,
          runId: context.run.id,
          status: context.run.status,
          duration: context.run.durationMs ? `${Math.floor(context.run.durationMs / 1000)}s` : undefined,
          triggerBy: context.run.triggerBy,
        };
        promises.push(this.imNotifier.sendNotification(channel, payload));
      }
    }

    // Send to Webhook channels
    if (template.channels.includes('webhook') && template.webhookChannels) {
      for (const config of template.webhookChannels) {
        const payload: WebhookPayload = {
          eventType: this.mapStatusToEventType(context.run.status),
          runId: context.run.id,
          pipelineId: context.run.pipelineId,
          status: context.run.status,
          timestamp: new Date(),
          durationMs: context.run.durationMs,
          triggerBy: context.run.triggerBy,
          metadata: context.pipeline,
        };
        promises.push(this.webhookNotifier.sendWebhook(config, payload));
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Resolve template variables from context.
   *
   * Supports:
   * - {{stages.<name>.status}}
   * - {{tasks.<name>.outputs.<key>}}
   * - {{run.<field>}}
   * - {{pipeline.<key>}}
   */
  resolveTemplate(template: string, context: NotificationContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolvePath(path.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve a dot-notation path from the context.
   */
  private resolvePath(path: string, context: NotificationContext): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Map run status to webhook event type.
   */
  private mapStatusToEventType(status: string): 'pipeline.complete' | 'pipeline.failed' | 'pipeline.cancelled' {
    switch (status) {
      case 'success':
        return 'pipeline.complete';
      case 'failed':
        return 'pipeline.failed';
      case 'cancelled':
        return 'pipeline.cancelled';
      default:
        return 'pipeline.complete';
    }
  }
}
