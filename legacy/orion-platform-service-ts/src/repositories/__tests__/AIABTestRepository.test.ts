/**
 * AIABTestRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AIABTestRepository } from '../AIABTestRepository';

const mockQuery = jest.fn();

describe('AIABTestRepository', () => {
  let repo: AIABTestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AIABTestRepository({ query: mockQuery } as any);
  });

  it('should findByModelId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByModelId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRunning', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRunning();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateMetrics', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateMetrics('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
