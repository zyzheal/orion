/**
 * LowcodeWorkflowDefinitionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { LowcodeWorkflowDefinitionPgRepository } from '../LowcodeWorkflowDefinitionRepository';

const mockQuery = jest.fn();

describe('LowcodeWorkflowDefinitionPgRepository', () => {
  let repo: LowcodeWorkflowDefinitionPgRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new LowcodeWorkflowDefinitionPgRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });
});
