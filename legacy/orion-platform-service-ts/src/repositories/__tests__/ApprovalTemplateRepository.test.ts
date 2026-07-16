/**
 * ApprovalTemplateRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ApprovalTemplateRepository } from '../ApprovalTemplateRepository';

const mockQuery = jest.fn();

describe('ApprovalTemplateRepository', () => {
  let repo: ApprovalTemplateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ApprovalTemplateRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findDefaultTemplate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findDefaultTemplate('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createTemplate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createTemplate('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateTemplate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateTemplate('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should unsetDefault', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.unsetDefault('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteTemplate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteTemplate('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
