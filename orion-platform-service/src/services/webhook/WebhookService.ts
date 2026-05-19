/**
 * WebhookService - Business logic layer for Webhook operations
 *
 * Enhanced with subscription model and dispatcher (migration 061).
 */

import * as crypto from 'crypto';
import { WebhookRepository, Webhook, WebhookDelivery, WebhookRepositoryEnhanced, WebhookEndpoint, WebhookSubscription, WebhookDeliveryEnhanced } from './WebhookRepository';

export class WebhookServiceError extends Error {
  constructor(message: string, public code: string) {
    super(`${message} (${code})`);
    this.name = 'WebhookServiceError';
  }
}

export class WebhookService {
  private repository: WebhookRepository;
  constructor(repository: WebhookRepository) { this.repository = repository; }

  async create(tenantId: string, name: string, url: string, events: string[], secret?: string): Promise<Webhook> {
    if (!tenantId || !name || !url) throw new WebhookServiceError('Tenant ID, name, url required', 'INVALID_INPUT');
    return this.repository.create(tenantId, name, url, events, secret);
  }

  async list(tenantId: string): Promise<Webhook[]> {
    return this.repository.findAll(tenantId);
  }

  async get(id: string): Promise<Webhook> {
    const webhook = await this.repository.findById(id);
    if (!webhook) throw new WebhookServiceError(`Webhook not found: ${id}`, 'NOT_FOUND');
    return webhook;
  }

  async update(id: string, input: { name?: string; url?: string; events?: string[]; enabled?: boolean }): Promise<Webhook> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new WebhookServiceError(`Webhook not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.update(id, input);
    return updated!;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new WebhookServiceError(`Webhook not found: ${id}`, 'NOT_FOUND');
    return this.repository.delete(id);
  }

  async trigger(webhookId: string, event: string, payload: Record<string, any>, retries: number = 3): Promise<WebhookDelivery> {
    const webhook = await this.repository.findById(webhookId);
    if (!webhook) throw new WebhookServiceError(`Webhook not found: ${webhookId}`, 'NOT_FOUND');
    if (!webhook.enabled) throw new WebhookServiceError('Webhook is disabled', 'DISABLED');

    const delivery = await this.repository.recordDelivery(webhookId, event, payload);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const responseBody = await response.text();
          await this.repository.markDelivered(delivery.id, response.status, responseBody);
          return delivery;
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      } catch (error: any) {
        lastError = error;
        // Exponential backoff: 1s, 2s, 4s
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error';
    await this.repository.markDelivered(delivery.id, 500, `Failed after ${retries} retries: ${errorMessage}`);
    return delivery;
  }

  async triggerEvent(tenantId: string, event: string, payload: Record<string, any>): Promise<number> {
    const webhooks = await this.repository.findAll(tenantId);
    const matching = webhooks.filter(w => w.enabled && w.events.includes(event));

    for (const webhook of matching) {
      try {
        await this.trigger(webhook.id, event, payload);
      } catch (e) {
        // Continue with other webhooks
      }
    }

    return matching.length;
  }

  async getDeliveries(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
    return this.repository.findDeliveriesByWebhook(webhookId, limit);
  }
}

// ============================================================
// Enhanced Webhook Service (migration 061)
// ============================================================

/** Exponential backoff delays: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s (max 1 hour = 3600000ms) */
export const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 512000, 3600000];

export class WebhookServiceEnhanced {
  private enhancedRepo: WebhookRepositoryEnhanced;

  constructor(enhancedRepo: WebhookRepositoryEnhanced) {
    this.enhancedRepo = enhancedRepo;
  }

  // ---- Endpoint Management ----

  async createEndpoint(input: {
    name: string;
    url: string;
    secret?: string;
    auth_type?: 'none' | 'bearer' | 'basic' | 'api_key';
    auth_config?: Record<string, any>;
    status?: 'active' | 'inactive' | 'disabled';
    created_by?: string;
  }): Promise<WebhookEndpoint> {
    if (!input.name || !input.url) {
      throw new WebhookServiceError('Name and URL are required', 'INVALID_INPUT');
    }
    return this.enhancedRepo.createEndpoint(input);
  }

  async listEndpoints(status?: 'active' | 'inactive' | 'disabled'): Promise<WebhookEndpoint[]> {
    return this.enhancedRepo.listEndpoints(status);
  }

  async getEndpoint(id: string): Promise<WebhookEndpoint> {
    const endpoint = await this.enhancedRepo.findEndpointById(id);
    if (!endpoint) {
      throw new WebhookServiceError(`Endpoint not found: ${id}`, 'NOT_FOUND');
    }
    return endpoint;
  }

  async updateEndpoint(
    id: string,
    input: Partial<{
      name: string;
      url: string;
      secret: string;
      auth_type: 'none' | 'bearer' | 'basic' | 'api_key';
      auth_config: Record<string, any>;
      status: 'active' | 'inactive' | 'disabled';
    }>
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.enhancedRepo.updateEndpoint(id, input);
    if (!endpoint) {
      throw new WebhookServiceError(`Endpoint not found: ${id}`, 'NOT_FOUND');
    }
    return endpoint;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    return this.enhancedRepo.deleteEndpoint(id);
  }

  // ---- Subscription Management ----

  async createSubscription(input: {
    endpoint_id: string;
    event_type: string;
    filters?: Record<string, any>;
    active?: boolean;
  }): Promise<WebhookSubscription> {
    if (!input.endpoint_id || !input.event_type) {
      throw new WebhookServiceError('Endpoint ID and event type are required', 'INVALID_INPUT');
    }
    // Verify endpoint exists
    const endpoint = await this.enhancedRepo.findEndpointById(input.endpoint_id);
    if (!endpoint) {
      throw new WebhookServiceError(`Endpoint not found: ${input.endpoint_id}`, 'NOT_FOUND');
    }
    return this.enhancedRepo.createSubscription(input);
  }

  async listSubscriptions(endpointId: string): Promise<WebhookSubscription[]> {
    return this.enhancedRepo.findSubscriptionsByEndpoint(endpointId);
  }

  async updateSubscription(
    id: string,
    input: Partial<{
      filters: Record<string, any>;
      active: boolean;
    }>
  ): Promise<WebhookSubscription> {
    const subscription = await this.enhancedRepo.updateSubscription(id, input);
    if (!subscription) {
      throw new WebhookServiceError(`Subscription not found: ${id}`, 'NOT_FOUND');
    }
    return subscription;
  }

  async deleteSubscription(id: string): Promise<boolean> {
    return this.enhancedRepo.deleteSubscription(id);
  }

  // ---- Dispatch & Delivery ----

  /**
   * Dispatch an event to all matching subscriptions.
   * Finds all active subscriptions for the event type, filters by subscription filters,
   * records deliveries, and processes them asynchronously.
   */
  async dispatch(eventType: string, eventId: string, payload: Record<string, any>): Promise<number> {
    // Find all active subscriptions for this event type
    const subscriptions = await this.enhancedRepo.findSubscriptionsByEvent(eventType, true);

    let deliveredCount = 0;

    for (const subscription of subscriptions) {
      // Get endpoint details
      const { endpoint } = await this.enhancedRepo.getEndpointWithSubscriptions(subscription.endpoint_id);

      if (!endpoint || endpoint.status !== 'active') {
        continue;
      }

      // Apply subscription filters
      if (subscription.filters && !this.matchesFilters(payload, subscription.filters)) {
        continue;
      }

      // Record delivery
      const delivery = await this.enhancedRepo.recordDelivery({
        subscription_id: subscription.id,
        event_id: eventId,
        payload,
      });

      // Process delivery asynchronously (fire and forget, but log errors)
      this.processDelivery(delivery, endpoint, payload, eventType).catch((err) => {
        console.error(`[WebhookDispatcher] Failed to process delivery ${delivery.id}:`, err);
        // In production, consider queuing failed deliveries for background retry workers
      });

      deliveredCount++;
    }

    return deliveredCount;
  }

  /**
   * Process a single delivery: HTTP POST with HMAC signature, exponential backoff retry.
   */
  async processDelivery(
    delivery: WebhookDeliveryEnhanced,
    endpoint: WebhookEndpoint,
    payload: Record<string, any>,
    eventType: string
  ): Promise<void> {
    const maxAttempts = delivery.max_attempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.sendWebhookRequest(endpoint, eventType, payload);

        if (response.ok) {
          // Success
          await this.enhancedRepo.updateDelivery(delivery.id, {
            status: 'delivered',
            response_status: response.status,
            response_body: response.body,
            delivered_at: new Date(),
          });
          return;
        }

        // HTTP error - will retry
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error: any) {
        lastError = error;
      }

      // Update attempt count
      await this.enhancedRepo.updateDelivery(delivery.id, {
        attempt,
        status: attempt < maxAttempts ? 'retrying' : 'failed',
      });

      // Exponential backoff (except on last attempt)
      if (attempt < maxAttempts) {
        const delay = Math.min(BACKOFF_DELAYS[attempt - 1] || 3600000, 3600000);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Schedule next retry
        const nextRetry = new Date(Date.now() + delay);
        await this.enhancedRepo.updateDelivery(delivery.id, {
          next_retry_at: nextRetry,
        });
      }
    }

    // All retries failed
    await this.enhancedRepo.updateDelivery(delivery.id, {
      status: 'failed',
      error_message: lastError?.message || 'Unknown error',
    });
  }

  /**
   * Send HTTP POST request to webhook endpoint with authentication and HMAC signature.
   */
  private async sendWebhookRequest(
    endpoint: WebhookEndpoint,
    eventType: string,
    payload: Record<string, any>
  ): Promise<{ ok: boolean; status: number; statusText: string; body: string }> {
    const url = endpoint.url;
    const body = JSON.stringify({
      event: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
    };

    // Add authentication headers
    if (endpoint.auth_type === 'bearer' && endpoint.auth_config?.token) {
      headers['Authorization'] = `Bearer ${endpoint.auth_config.token}`;
    } else if (endpoint.auth_type === 'basic' && endpoint.auth_config?.username && endpoint.auth_config?.password) {
      const credentials = Buffer.from(`${endpoint.auth_config.username}:${endpoint.auth_config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (endpoint.auth_type === 'api_key' && endpoint.auth_config?.header_name && endpoint.auth_config?.api_key) {
      headers[endpoint.auth_config.header_name] = endpoint.auth_config.api_key;
    }

    // Add HMAC signature if secret is configured
    if (endpoint.secret) {
      const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      };
    } catch (error: any) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Get nested value from object using dot notation path.
   * e.g., getNestedValue({a: {b: 1}}, 'a.b') => 1
   */
  getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Check if payload matches subscription filters.
   * Supports operators: eq, ne, gt, gte, lt, lte, in, nin, exists, contains
   */
  matchesFilters(payload: Record<string, any>, filters: Record<string, any>): boolean {
    for (const [path, condition] of Object.entries(filters)) {
      if (typeof condition !== 'object' || condition === null) {
        // Simple equality check
        const value = this.getNestedValue(payload, path);
        if (value !== condition) {
          return false;
        }
        continue;
      }

      const value = this.getNestedValue(payload, path);

      // Check each operator
      if ('eq' in condition) {
        if (value !== condition.eq) return false;
      }
      if ('ne' in condition) {
        if (value === condition.ne) return false;
      }
      if ('gt' in condition) {
        if (typeof value !== 'number' || value <= condition.gt) return false;
      }
      if ('gte' in condition) {
        if (typeof value !== 'number' || value < condition.gte) return false;
      }
      if ('lt' in condition) {
        if (typeof value !== 'number' || value >= condition.lt) return false;
      }
      if ('lte' in condition) {
        if (typeof value !== 'number' || value > condition.lte) return false;
      }
      if ('in' in condition) {
        if (!Array.isArray(condition.in) || !condition.in.includes(value)) return false;
      }
      if ('nin' in condition) {
        if (!Array.isArray(condition.nin) || condition.nin.includes(value)) return false;
      }
      if ('exists' in condition) {
        const exists = value !== undefined && value !== null;
        if (exists !== condition.exists) return false;
      }
      if ('contains' in condition) {
        if (typeof value !== 'string' || !value.includes(condition.contains)) return false;
      }
    }

    return true;
  }

  // ---- Delivery History ----

  async getDeliveries(subscriptionId: string, limit: number = 50): Promise<WebhookDeliveryEnhanced[]> {
    return this.enhancedRepo.findDeliveriesBySubscription(subscriptionId, limit);
  }

  async getPendingDeliveries(limit: number = 100): Promise<WebhookDeliveryEnhanced[]> {
    return this.enhancedRepo.findPendingDeliveries(limit);
  }

  /**
   * Reprocess failed deliveries (useful for manual retry).
   */
  async reprocessDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.enhancedRepo.findDeliveryById(deliveryId);
    if (!delivery) {
      throw new WebhookServiceError(`Delivery not found: ${deliveryId}`, 'NOT_FOUND');
    }

    const subscription = await this.enhancedRepo.findSubscriptionById(delivery.subscription_id);
    if (!subscription) {
      throw new WebhookServiceError(`Subscription not found: ${delivery.subscription_id}`, 'NOT_FOUND');
    }

    const { endpoint } = await this.enhancedRepo.getEndpointWithSubscriptions(subscription.endpoint_id);
    if (!endpoint) {
      throw new WebhookServiceError(`Endpoint not found: ${subscription.endpoint_id}`, 'NOT_FOUND');
    }

    // Reset delivery status and process
    await this.enhancedRepo.updateDelivery(deliveryId, {
      status: 'pending',
      attempt: 0,
      error_message: null,
    });

    const updatedDelivery = await this.enhancedRepo.findDeliveryById(deliveryId);
    await this.processDelivery(updatedDelivery!, endpoint, delivery.payload, subscription.event_type);
  }
}