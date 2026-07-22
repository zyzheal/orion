/**
 * BuildArtifactRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { BuildArtifactRepository } from '../BuildArtifactRepository';

const mockQuery = jest.fn();

describe('BuildArtifactRepository', () => {
  let repo: BuildArtifactRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BuildArtifactRepository({ query: mockQuery } as any);
  });

  it('should createArtifact', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createArtifact('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAll('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should count', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.count('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should recordDownload', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.recordDownload('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteArtifact', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteArtifact('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupExpired();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupByRun', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupByRun('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
