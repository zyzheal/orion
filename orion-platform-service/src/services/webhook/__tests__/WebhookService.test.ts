/**
 * WebhookService unit tests
 */

import { WebhookService, WebhookServiceError } from '../WebhookService';
import { WebhookRepository, Webhook, WebhookDelivery } from '../WebhookRepository';

// Mock repository
function createMockRepo(): jest.Mocked<WebhookRepository> {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    recordDelivery: jest.fn(),
    markDelivered: jest.fn(),
    findDeliveriesByWebhook: jest.fn(),
    findByTenantAndName: jest.fn(),
  } as unknown as jest.Mocked<WebhookRepository>;
}

const MOCK_WEBHOOK: Webhook = {
  id: 'wh-001',
  tenant_id: 'tenant-1',
  name: 'test-webhook',
  url: 'https://example.com/hook',
  events: ['pipeline.run', 'deploy.success'],
  secret: 'secret-123',
  enabled: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const MOCK_DELIVERY: WebhookDelivery = {
  id: 'del-001',
  webhook_id: 'wh-001',
  event: 'pipeline.run',
  payload: { runId: 'run-1' },
  status: 'pending',
  response_code: null,
  response_body: null,
  attempt: 1,
  next_retry_at: null,
  attempted_at: new Date('2026-01-01'),
};

describe('WebhookService', () => {
  let repo: jest.Mocked<WebhookRepository>;
  let service: WebhookService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new WebhookService(repo);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a webhook successfully', async () => {
      repo.create.mockResolvedValue(MOCK_WEBHOOK);

      const result = await service.create('tenant-1', 'test-webhook', 'https://example.com/hook', ['pipeline.run']);

      expect(result).toEqual(MOCK_WEBHOOK);
      expect(repo.create).toHaveBeenCalledWith('tenant-1', 'test-webhook', 'https://example.com/hook', ['pipeline.run'], undefined);
    });

    it('should reject if tenantId is missing', async () => {
      await expect(service.create('', 'name', 'url', [])).rejects.toThrow(WebhookServiceError);
    });

    it('should reject if name is missing', async () => {
      await expect(service.create('t1', '', 'url', [])).rejects.toThrow(WebhookServiceError);
    });

    it('should reject if url is missing', async () => {
      await expect(service.create('t1', 'name', '', [])).rejects.toThrow(WebhookServiceError);
    });
  });

  describe('list', () => {
    it('should return all webhooks for a tenant', async () => {
      repo.findAll.mockResolvedValue([MOCK_WEBHOOK]);

      const result = await service.list('tenant-1');

      expect(result).toHaveLength(1);
      expect(repo.findAll).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('get', () => {
    it('should return webhook by id', async () => {
      repo.findById.mockResolvedValue(MOCK_WEBHOOK);

      const result = await service.get('wh-001');

      expect(result).toEqual(MOCK_WEBHOOK);
    });

    it('should throw NOT_FOUND if webhook does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.get('nonexistent')).rejects.toThrow(WebhookServiceError);
      await expect(service.get('nonexistent')).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('update', () => {
    it('should update webhook fields', async () => {
      repo.findById.mockResolvedValue(MOCK_WEBHOOK);
      repo.update.mockResolvedValue({ ...MOCK_WEBHOOK, name: 'updated-name' });

      const result = await service.update('wh-001', { name: 'updated-name' });

      expect(result.name).toBe('updated-name');
    });

    it('should throw NOT_FOUND if webhook does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow(WebhookServiceError);
    });
  });

  describe('delete', () => {
    it('should delete existing webhook', async () => {
      repo.findById.mockResolvedValue(MOCK_WEBHOOK);
      repo.delete.mockResolvedValue(true);

      const result = await service.delete('wh-001');

      expect(result).toBe(true);
    });

    it('should throw NOT_FOUND if webhook does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(WebhookServiceError);
    });
  });

  describe('trigger', () => {
    it('should trigger enabled webhook and record delivery', async () => {
      repo.findById.mockResolvedValue(MOCK_WEBHOOK);
      repo.recordDelivery.mockResolvedValue(MOCK_DELIVERY);
      repo.markDelivered.mockResolvedValue(undefined);

      const result = await service.trigger('wh-001', 'pipeline.run', { runId: 'run-1' });

      expect(result.webhook_id).toBe('wh-001');
      expect(repo.recordDelivery).toHaveBeenCalled();
    });

    it('should throw DISABLED if webhook is disabled', async () => {
      repo.findById.mockResolvedValue({ ...MOCK_WEBHOOK, enabled: false });

      await expect(service.trigger('wh-001', 'pipeline.run', {})).rejects.toThrow(WebhookServiceError);
      await expect(service.trigger('wh-001', 'pipeline.run', {})).rejects.toThrow('DISABLED');
    });

    it('should throw NOT_FOUND if webhook does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.trigger('nonexistent', 'event', {})).rejects.toThrow(WebhookServiceError);
    });
  });

  describe('triggerEvent', () => {
    it('should trigger all matching enabled webhooks', async () => {
      repo.findAll.mockResolvedValue([
        { ...MOCK_WEBHOOK, id: 'wh-1', events: ['deploy.success'] },
        { ...MOCK_WEBHOOK, id: 'wh-2', events: ['deploy.success', 'pipeline.run'] },
        { ...MOCK_WEBHOOK, id: 'wh-3', events: ['pipeline.run'], enabled: false },
      ]);
      repo.findById.mockResolvedValue(MOCK_WEBHOOK);
      repo.recordDelivery.mockResolvedValue(MOCK_DELIVERY);
      repo.markDelivered.mockResolvedValue(undefined);

      const count = await service.triggerEvent('tenant-1', 'deploy.success', {});

      expect(count).toBe(2);
    });

    it('should return 0 if no matching webhooks', async () => {
      repo.findAll.mockResolvedValue([]);

      const count = await service.triggerEvent('tenant-1', 'unknown.event', {});

      expect(count).toBe(0);
    });
  });

  describe('getDeliveries', () => {
    it('should return delivery logs for a webhook', async () => {
      repo.findDeliveriesByWebhook.mockResolvedValue([MOCK_DELIVERY]);

      const result = await service.getDeliveries('wh-001', 10);

      expect(result).toHaveLength(1);
      expect(repo.findDeliveriesByWebhook).toHaveBeenCalledWith('wh-001', 10);
    });
  });
});
