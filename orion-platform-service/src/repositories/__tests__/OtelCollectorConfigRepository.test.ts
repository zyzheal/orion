/**
 * OtelCollectorConfigRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { OtelCollectorConfigRepository } from '../OtelCollectorConfigRepository';

const mockQuery = jest.fn();

describe('OtelCollectorConfigRepository', () => {
  let repo: OtelCollectorConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new OtelCollectorConfigRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByType('test-id', 'test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
