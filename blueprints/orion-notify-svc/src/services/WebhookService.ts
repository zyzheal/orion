import { WebhookRepository } from './WebhookRepository';

export class WebhookServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WebhookServiceError';
  }
}

export class WebhookService {
  constructor(private repo: WebhookRepository) {}

  async create(tenantId: string, name: string, url: string, events: string[], secret?: string) {
    return this.repo.create(tenantId, name, url, events, secret);
  }

  async list(tenantId: string) {
    return this.repo.findAll(tenantId);
  }

  async get(id: string) {
    const webhook = await this.repo.findById(id);
    if (!webhook) throw new WebhookServiceError(`Webhook ${id} not found`, 'NOT_FOUND');
    return webhook;
  }

  async update(id: string, input: { name?: string; url?: string; events?: string[]; enabled?: boolean }) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new WebhookServiceError(`Webhook ${id} not found`, 'NOT_FOUND');
    const updated = await this.repo.update(id, input);
    if (!updated) throw new WebhookServiceError(`Failed to update webhook ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new WebhookServiceError(`Webhook ${id} not found`, 'NOT_FOUND');
    return this.repo.delete(id);
  }

  async trigger(id: string, event: string, payload: Record<string, any>) {
    const webhook = await this.get(id);
    if (!webhook.enabled) throw new WebhookServiceError(`Webhook ${id} is disabled`, 'DISABLED');
    const delivery = await this.repo.recordDelivery(id, event, payload);
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...payload }),
      });
      await this.repo.updateDeliveryStatus(delivery.id, response.ok ? 'delivered' : 'failed', response.status, JSON.stringify({ status: response.status }));
      return { success: response.ok, statusCode: response.status, delivery };
    } catch (err: any) {
      await this.repo.updateDeliveryStatus(delivery.id, 'failed', 0, err.message);
      throw err;
    }
  }

  async triggerEvent(tenantId: string, event: string, payload: Record<string, any>): Promise<number> {
    const webhooks = await this.repo.findAll(tenantId);
    const matching = webhooks.filter((wh) => wh.enabled && wh.events.includes(event));
    let count = 0;
    for (const wh of matching) {
      try {
        await this.trigger(wh.id, event, payload);
        count++;
      } catch {}
    }
    return count;
  }

  async getDeliveries(webhookId: string, limit: number = 50) {
    await this.get(webhookId);
    return this.repo.findDeliveriesByWebhook(webhookId, limit);
  }
}
