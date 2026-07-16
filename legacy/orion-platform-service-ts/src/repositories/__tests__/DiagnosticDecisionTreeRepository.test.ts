/**
 * DiagnosticDecisionTreeRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DiagnosticDecisionTreeRepository } from '../DiagnosticDecisionTreeRepository';

const mockQuery = jest.fn();

describe('DiagnosticDecisionTreeRepository', () => {
  let repo: DiagnosticDecisionTreeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DiagnosticDecisionTreeRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findLeafNodes', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findLeafNodes('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByParentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByParentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
