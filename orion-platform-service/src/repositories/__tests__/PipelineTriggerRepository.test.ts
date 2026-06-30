/**
 * PipelineTriggerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PipelineTriggerRepository } from '../PipelineTriggerRepository';

const mockQuery = jest.fn();

describe('PipelineTriggerRepository', () => {
  let repo: PipelineTriggerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PipelineTriggerRepository({ query: mockQuery } as any);
  });

  it('should findByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabledByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabledByType('test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should toggleEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.toggleEnabled('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
