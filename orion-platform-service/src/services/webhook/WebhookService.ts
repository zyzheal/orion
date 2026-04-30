/**
 * WebhookService - Business logic layer for Webhook operations
 */

import { WebhookRepository, Webhook, WebhookDelivery } from './WebhookRepository';

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