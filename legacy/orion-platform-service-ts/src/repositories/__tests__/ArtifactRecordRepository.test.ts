/**
 * ArtifactRecordRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ArtifactRecordRepository } from '../ArtifactRecordRepository';

const mockQuery = jest.fn();

describe('ArtifactRecordRepository', () => {
  let repo: ArtifactRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ArtifactRecordRepository({ query: mockQuery } as any);
  });

  it('should createRecord', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createRecord('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStage', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStage('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-id', 'test-id', 'test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteExpired('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
