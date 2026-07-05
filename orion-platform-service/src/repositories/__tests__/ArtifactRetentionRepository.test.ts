/**
 * ArtifactRetentionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RetentionPolicyRepository, RetentionEvaluationRepository } from '../ArtifactRetentionRepository';

const mockQuery = jest.fn();

describe('RetentionPolicyRepository', () => {
  let repo: RetentionPolicyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RetentionPolicyRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantAndEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantAndEnabled('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('RetentionEvaluationRepository', () => {
  let repo: RetentionEvaluationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RetentionEvaluationRepository({ query: mockQuery } as any);
  });

  it('should findByPolicy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPolicy('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findLatestByPolicy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findLatestByPolicy('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
