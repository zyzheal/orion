import { SbomWaiverRepository, SbomWaiverEntity } from '../SbomWaiverRepository';

describe('SbomWaiverRepository', () => {
  let repo: SbomWaiverRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new SbomWaiverRepository(mockDb);
  });

  test('should create waiver', async () => {
    const mockRow = {
      id: 'waiver-1',
      vulnerability_id: 'vuln-1',
      reason: 'Risk accepted for business need',
      approved_by: 'user-1',
      approved_at: new Date(),
      expires_at: new Date('2025-01-01'),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ vulnerabilityId: 'vuln-1', reason: 'Accepted' } as any);
    expect(result.reason).toBe('Risk accepted for business need');
  });

  test('should find by vulnerability id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'w1', vulnerability_id: 'vuln-1', reason: 'Waiver', approved_by: null, approved_at: new Date(), expires_at: new Date() }],
    });
    const result = await repo.findByVulnerabilityId('vuln-1');
    expect(result.length).toBe(1);
    expect(result[0].vulnerabilityId).toBe('vuln-1');
  });

  test('should find expired waivers', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'w1', vulnerability_id: 'v1', reason: 'Old waiver', approved_by: null, approved_at: new Date(), expires_at: new Date('2023-01-01') }],
    });
    const result = await repo.findExpired();
    expect(result.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('expires_at < NOW()'));
  });

  test('should delete by vulnerability id', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await repo.deleteByVulnerabilityId('vuln-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sbom_waivers'),
      ['vuln-1'],
    );
  });
});