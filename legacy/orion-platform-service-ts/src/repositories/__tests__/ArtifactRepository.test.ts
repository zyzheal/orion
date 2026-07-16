/**
 * ArtifactRepository Tests
 */
import { PostgresArtifactRepository } from '../ArtifactRepository';

const mockQuery = jest.fn();

describe('PostgresArtifactRepository', () => {
  let repo: PostgresArtifactRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresArtifactRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByNamespaceNameVersion', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByNamespaceNameVersion('test-name', 'test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should find', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.find('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should update', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.update('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should softDelete', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.softDelete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should addTag', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.addTag('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should removeTag', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.removeTag('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getTags', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getTags('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should recordDownload', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.recordDownload('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getDownloadHistory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getDownloadHistory('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should search', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.search('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getStats();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getTypeStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getTypeStats();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getNamespaces', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getNamespaces();
    expect(mockQuery).toHaveBeenCalled();
  });
});
