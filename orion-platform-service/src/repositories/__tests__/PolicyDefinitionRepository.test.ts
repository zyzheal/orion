/**
 * PolicyDefinitionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PolicyDefinitionRepository, PolicyBundleRepository } from '../PolicyDefinitionRepository';

const mockQuery = jest.fn();

describe('PolicyDefinitionRepository', () => {
  let repo: PolicyDefinitionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PolicyDefinitionRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByCategory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCategory('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByGateId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByGateId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createPolicy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createPolicy('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updatePolicy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updatePolicy('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deletePolicy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deletePolicy('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('PolicyBundleRepository', () => {
  let repo: PolicyBundleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PolicyBundleRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive();
    expect(mockQuery).toHaveBeenCalled();
  });
});
