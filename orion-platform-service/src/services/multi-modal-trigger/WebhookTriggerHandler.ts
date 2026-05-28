/**
 * WebhookTriggerHandler - Handles webhook-based trigger registration and processing
 *
 * Manages webhook endpoints and processes incoming webhook events to trigger pipelines.
 */

import { DatabasePool } from '../database';
import {
  WebhookEndpointRepository,
  WebhookEndpointEntity,
  TriggerEventRepository,
  TriggerEventEntity,
  TriggerRepository,
} from '../../repositories/Phase3Repository';
import { UnifiedTriggerService } from './UnifiedTriggerService';
import crypto from 'crypto';
import { OrionError, ErrorCode } from '../../../errors';

export interface WebhookConfig {
  triggerId?: string;
  path?: string;
  secret?: string;
  allowedIps?: string[];
  method?: string;
}

export interface WebhookPayload {
  headers: Record<string, string>;
  body: Record<string, any>;
  query?: Record<string, string>;
  ip?: string;
  timestamp: string;
}

export interface WebhookProcessResult {
  success: boolean;
  endpointId?: string;
  triggerId?: string;
  eventId?: string;
  error?: string;
  matched?: boolean;
}

export interface WebhookHistoryEntry {
  endpoint: WebhookEndpointEntity;
  events: TriggerEventEntity[];
}

export class WebhookTriggerHandler {
  private webhookRepo: WebhookEndpointRepository | null = null;
  private eventRepo: TriggerEventRepository | null = null;
  private triggerRepo: TriggerRepository | null = null;
  private triggerService: UnifiedTriggerService | null = null;

  constructor(db?: DatabasePool, triggerService?: UnifiedTriggerService) {
    if (db) {
      this.webhookRepo = new WebhookEndpointRepository(db);
      this.eventRepo = new TriggerEventRepository(db);
      this.triggerRepo = new TriggerRepository(db);
    }
    this.triggerService = triggerService || null;
  }

  // ==================== Webhook Registration ====================

  async registerWebhook(tenantId: string, config: WebhookConfig): Promise<WebhookEndpointEntity> {
    if (!this.webhookRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const id = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Generate a unique path if not provided
    const path = config.path || `/webhooks/${tenantId}/${id}`;

    // Generate a secret if not provided
    const secret = config.secret || crypto.randomBytes(32).toString('hex');

    const entity = await this.webhookRepo.create({
      id,
      tenant_id: tenantId,
      trigger_id: config.triggerId || null,
      path,
      secret,
      allowed_ips: config.allowedIps || [],
      method: config.method || 'POST',
      request_count: 0,
      last_request_at: null,
    });

    return entity;
  }

  async getWebhook(endpointId: string): Promise<WebhookEndpointEntity | undefined> {
    if (!this.webhookRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.webhookRepo.findById(endpointId);
  }

  async getWebhookByPath(path: string): Promise<WebhookEndpointEntity | undefined> {
    if (!this.webhookRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.webhookRepo.findByPath(path);
  }

  async listWebhooks(tenantId: string): Promise<WebhookEndpointEntity[]> {
    if (!this.webhookRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.webhookRepo.findByTenant(tenantId);
  }

  async deleteWebhook(endpointId: string): Promise<boolean> {
    if (!this.webhookRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.webhookRepo.delete(endpointId);
  }

  // ==================== Webhook Processing ====================

  async processWebhookEvent(payload: WebhookPayload): Promise<WebhookProcessResult> {
    if (!this.webhookRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    // Extract path from payload (usually from URL)
    const path = this.extractPath(payload);
    if (!path) {
      return { success: false, error: 'No path found in webhook request' };
    }

    // Find the webhook endpoint
    const endpoint = await this.webhookRepo.findByPath(path);
    if (!endpoint) {
      return { success: false, error: `Webhook endpoint not found for path: ${path}` };
    }

    // Verify signature if secret is configured
    if (endpoint.secret) {
      const signature = payload.headers['x-webhook-signature'] || payload.headers['x-signature'];
      if (signature) {
        const isValid = this.verifySignature(payload.body, endpoint.secret, signature);
        if (!isValid) {
          return { success: false, error: 'Invalid webhook signature' };
        }
      }
    }

    // Check IP whitelist
    if (endpoint.allowed_ips && endpoint.allowed_ips.length > 0) {
      const ip = payload.ip;
      if (!ip || !endpoint.allowed_ips.includes(ip)) {
        return { success: false, error: 'IP not in allowed list' };
      }
    }

    // Increment request count
    await this.webhookRepo.incrementRequestCount(endpoint.id);

    // If endpoint has an associated trigger, evaluate it
    let triggerId: string | undefined;
    let eventId: string | undefined;
    let matched = false;

    if (endpoint.trigger_id) {
      triggerId = endpoint.trigger_id;

      // Create event record
      const eventIdGen = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (this.eventRepo) {
        const triggerEvent = await this.eventRepo.create({
          id: eventIdGen,
          trigger_id: endpoint.trigger_id,
          tenant_id: endpoint.tenant_id,
          event_type: 'webhook',
          event_payload: { headers: payload.headers, body: payload.body, query: payload.query },
          evaluation_result: 'matched', // Webhook always matches its endpoint
          pipeline_run_id: null,
        });
        eventId = eventIdGen;

        // Increment trigger count
        if (this.triggerRepo) {
          await this.triggerRepo.incrementTriggerCount(endpoint.trigger_id);
        }
      }
    }

    return {
      success: true,
      endpointId: endpoint.id,
      triggerId,
      eventId,
      matched,
    };
  }

  // ==================== Webhook History ====================

  async getWebhookHistory(tenantId: string): Promise<WebhookHistoryEntry[]> {
    if (!this.webhookRepo || !this.eventRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const endpoints = await this.webhookRepo.findByTenant(tenantId);
    const history: WebhookHistoryEntry[] = [];

    for (const endpoint of endpoints) {
      const events = endpoint.trigger_id
        ? await this.eventRepo.findByTriggerId(endpoint.trigger_id, 20)
        : [];

      history.push({
        endpoint,
        events,
      });
    }

    return history;
  }

  async getWebhookEvents(endpointId: string, limit: number = 50): Promise<TriggerEventEntity[]> {
    if (!this.webhookRepo || !this.eventRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const endpoint = await this.webhookRepo.findById(endpointId);
    if (!endpoint) throw new OrionError(ErrorCode.NOT_FOUND, `Webhook endpoint not found: ${endpointId}`);

    if (!endpoint.trigger_id) return [];

    return this.eventRepo.findByTriggerId(endpoint.trigger_id, limit);
  }

  // ==================== Internal Methods ====================

  private extractPath(payload: WebhookPayload): string | null {
    // Try to extract path from query parameters first
    if (payload.query?.path) return payload.query.path;

    // Try to extract from body
    if (payload.body?.path) return payload.body.path;

    // Try to extract from headers
    if (payload.headers['x-webhook-path']) return payload.headers['x-webhook-path'];

    // Try to extract from body's _meta
    if (payload.body?._meta?.path) return payload.body._meta.path;

    return null;
  }

  private verifySignature(body: Record<string, any>, secret: string, signature: string): boolean {
    try {
      const bodyString = JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(bodyString)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
}
