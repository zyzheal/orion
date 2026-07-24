/**
 * HealingStrategyRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HealingStrategyRepository } from '../HealingStrategyRepository';

const mockQuery = jest.fn();

describe('HealingStrategyRepository', () => {
  let repo: HealingStrategyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HealingStrategyRepository({ query: mockQuery } as any);
  });

  it('should findByTriggerType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTriggerType('test-type', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should enableStrategy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.enableStrategy('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should disableStrategy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.disableStrategy('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
