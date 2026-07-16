/**
 * SbomDocumentRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SbomDocumentRepository, SbomPackageRepository, SbomAttestationRepository } from '../SbomDocumentRepository';

const mockQuery = jest.fn();

describe('SbomDocumentRepository', () => {
  let repo: SbomDocumentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SbomDocumentRepository({ query: mockQuery } as any);
  });

  it('should list', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.list('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByBuildId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByBuildId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPipelineRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPipelineRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should incrementPackageCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.incrementPackageCount('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('SbomPackageRepository', () => {
  let repo: SbomPackageRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SbomPackageRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySbomId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySbomId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteBySbomId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteBySbomId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('SbomAttestationRepository', () => {
  let repo: SbomAttestationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SbomAttestationRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySbomId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySbomId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should verify', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.verify('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteBySbomId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteBySbomId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
