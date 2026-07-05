/**
 * ApiContractRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ApiContractRepository, ApiContractViolationRepository } from '../ApiContractRepository';

const mockQuery = jest.fn();

describe('ApiContractRepository', () => {
  let repo: ApiContractRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ApiContractRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEndpoint', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEndpoint('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createContract', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createContract('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateContract', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateContract('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteContract', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteContract('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ApiContractViolationRepository', () => {
  let repo: ApiContractViolationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ApiContractViolationRepository({ query: mockQuery } as any);
  });

  it('should findByContract', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByContract('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createViolation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createViolation('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByContract', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByContract('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
