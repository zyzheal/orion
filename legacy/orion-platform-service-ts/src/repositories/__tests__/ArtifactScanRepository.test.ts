import { ScanReportRepository, ScanFindingRepository, MaliciousDetectionRepository } from '../ArtifactScanRepository';

describe('ScanReportRepository', () => {
  let repo: ScanReportRepository;
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ScanReportRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });

  it('should findByArtifactId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByArtifactId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ScanFindingRepository', () => {
  let repo: ScanFindingRepository;
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ScanFindingRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });

  it('should findByReportId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByReportId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('MaliciousDetectionRepository', () => {
  let repo: MaliciousDetectionRepository;
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MaliciousDetectionRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });

  it('should findByTenantDetected', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByTenantDetected('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

