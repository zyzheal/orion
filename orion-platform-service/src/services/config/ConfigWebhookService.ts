/**
 * ConfigWebhookService — Configuration change webhook notification service
 *
 * When configuration values change, this service sends HTTP POST/PUT/PATCH
 * notifications to registered webhooks with the change event payload.
 *
 * Features:
 * - Webhook CRUD (register, list, get, update, delete)
 * - Event-based dispatch (config.created, config.updated, etc.)
 * - Domain-based filtering
 * - Retry with configurable count and timeout
 * - Secret-based HMAC signature
 */

import { createLogger } from '../../utils/logger';
import { ConfigWebhookRepository, ConfigWebhookEntity, CreateWebhookInput, UpdateWebhookInput } from '../../repositories/ConfigWebhookRepository';
import { ConfigWebhookDeliveryLogRepository } from '../../repositories/ConfigWebhookDeliveryLogRepository';
import { ConfigChangeEvent } from './ConfigEventBus';
import { createHash, createHmac } from 'crypto';
import { encryptValue, decryptValue, isEncrypted } from '../../utils/encryption';

const logger = createLogger('ConfigWebhookService');

// ==================== Types ====================

export interface WebhookResult {
  webhookId: string;
  webhookName: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
  timestamp: number;
}

export interface WebhookDispatchResult {
  triggered: number;
  results: WebhookResult[];
}

// ==================== Service ====================

export class ConfigWebhookService {
  private repository: ConfigWebhookRepository;
  private deliveryLogRepo: ConfigWebhookDeliveryLogRepository;

  constructor(repository: ConfigWebhookRepository, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = repository;
    this.deliveryLogRepo = db ? new ConfigWebhookDeliveryLogRepository(db) : null as any;
  }

  // ==================== CRUD ====================

  async createWebhook(tenantId: string, input: CreateWebhookInput): Promise<ConfigWebhookEntity> {
    logger.info({ tenantId, name: input.name }, 'Creating config webhook');
    const encryptedInput = {
      ...input,
      secret: input.secret ? encryptValue(input.secret) : undefined,
    };
    const webhook = await this.repository.create(tenantId, encryptedInput as CreateWebhookInput);
    return webhook;
  }

  async getWebhook(id: string, tenantId: string): Promise<ConfigWebhookEntity | undefined> {
    const webhook = await this.repository.findById(id, tenantId);
    if (webhook?.secret && isEncrypted(webhook.secret)) {
      webhook.secret = decryptValue(webhook.secret);
    }
    return webhook;
  }

  async listWebhooks(tenantId: string, options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ConfigWebhookEntity[]; total: number }> {
    const [data, total] = await Promise.all([
      this.repository.findByTenantId(tenantId, options),
      this.repository.countByTenantId(tenantId, options?.enabled),
    ]);

    // Decrypt secrets before returning to caller
    const decrypted = data.map((webhook) => {
      if (webhook.secret && isEncrypted(webhook.secret)) {
        return { ...webhook, secret: decryptValue(webhook.secret) };
      }
      return webhook;
    });

    return { data: decrypted, total };
  }

  async updateWebhook(id: string, tenantId: string, input: UpdateWebhookInput): Promise<ConfigWebhookEntity | undefined> {
    return this.repository.update(id, tenantId, input);
  }

  async deleteWebhook(id: string, tenantId: string): Promise<boolean> {
    return this.repository.delete(id, tenantId);
  }

  // ==================== Dispatch ====================

  /**
   * Dispatch a config change event to all matching webhooks.
   *
   * Webhooks are matched by:
   * - enabled = true
   * - event_types is empty (match all) or contains the event type
   * - domains is empty (match all) or contains the event domain
   */
  async dispatch(event: ConfigChangeEvent, tenantId: string): Promise<WebhookDispatchResult> {
    const webhooks = await this.repository.findByEvent(tenantId, event.eventType, event.domain);

    if (webhooks.length === 0) {
      logger.debug({ eventType: event.eventType, domain: event.domain, tenantId }, 'No matching webhooks found');
      return { triggered: 0, results: [] };
    }

    logger.info({ eventType: event.eventType, domain: event.domain, webhookCount: webhooks.length }, 'Dispatching config change event');

    const results: WebhookResult[] = await Promise.all(
      webhooks.map((wh: ConfigWebhookEntity) => this.sendNotification(wh, event))
    );

    const triggered = results.filter(r => r.success).length;

    return { triggered, results };
  }

  /**
   * Dispatch event to all tenants' webhooks (for broadcast events).
   * Used when tenantId is not known at dispatch time.
   */
  async dispatchBroadcast(event: ConfigChangeEvent): Promise<{ dispatched: number; errors: number }> {
    // For broadcast, we'd need to get all tenants. For now, we dispatch
    // to the tenant from the event or 'default' tenant.
    const tenantId = event.tenantId ?? 'default';
    const result = await this.dispatch(event, tenantId);
    return {
      dispatched: result.triggered,
      errors: result.results.filter(r => !r.success).length,
    };
  }

  // ==================== Private ====================

  private async sendNotification(
    webhook: ConfigWebhookEntity,
    event: ConfigChangeEvent,
  ): Promise<WebhookResult> {
    const startTime = Date.now();

    const payload = this.buildPayload(webhook, event);
    const body = JSON.stringify(payload);
    const url = webhook.url;
    const method = webhook.method;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Orion-Event-Type': event.eventType,
      'X-Orion-Event-Id': event.eventId,
      'X-Orion-Webhook-Id': webhook.id,
      ...webhook.headers,
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');
      headers['X-Orion-Signature'] = `sha256=${signature}`;
    }

    // Send with retries
    for (let attempt = 0; attempt <= webhook.retryCount; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs);

        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const durationMs = Date.now() - startTime;

        if (response.ok) {
          logger.info({ webhookId: webhook.id, url, statusCode: response.status, durationMs }, 'Webhook notification sent successfully');
          return {
            webhookId: webhook.id,
            webhookName: webhook.name,
            success: true,
            statusCode: response.status,
            durationMs,
            timestamp: Date.now(),
          };
        }

        logger.warn({ webhookId: webhook.id, url, statusCode: response.status, attempt }, 'Webhook notification failed, will retry');
      } catch (error: any) {
        if (error.name === 'AbortError') {
          logger.warn({ webhookId: webhook.id, url, timeoutMs: webhook.timeoutMs, attempt }, 'Webhook notification timed out');
        } else {
          logger.warn({ webhookId: webhook.id, url, error: error.message, attempt }, 'Webhook notification error');
        }

        // Last attempt failed
        if (attempt === webhook.retryCount) {
          const durationMs = Date.now() - startTime;
          return {
            webhookId: webhook.id,
            webhookName: webhook.name,
            success: false,
            error: error.message || 'Request failed',
            durationMs,
            timestamp: Date.now(),
          };
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 10000)));
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      webhookId: webhook.id,
      webhookName: webhook.name,
      success: false,
      error: 'Max retries exceeded',
      durationMs,
      timestamp: Date.now(),
    };
  }

  private buildPayload(webhook: ConfigWebhookEntity, event: ConfigChangeEvent): any {
    return {
      event_id: event.eventId,
      event_type: event.eventType,
      domain: event.domain,
      key: event.key,
      old_value: event.oldValue ?? null,
      new_value: event.newValue ?? null,
      changed_by: event.changedBy,
      timestamp: event.timestamp,
      version: event.version ?? null,
      tenant_id: event.tenantId ?? null,
      metadata: event.metadata ?? {},
      webhook: {
        id: webhook.id,
        name: webhook.name,
      },
    };
  }
}
