/**
 * IMNotificationChannelRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { IMNotificationChannelRepository } from '../IMNotificationChannelRepository';

const mockQuery = jest.fn();

describe('IMNotificationChannelRepository', () => {
  let repo: IMNotificationChannelRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IMNotificationChannelRepository({ query: mockQuery } as any);
  });

  it('should createChannel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createChannel('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPlatform', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPlatform('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabledByPlatform', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabledByPlatform('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateEnabled('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateWebhookUrl', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateWebhookUrl('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
