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
      cve_id: 'CVE-2024-0001',
      package_name: 'lodash',
      package_version: '4.17.20',
      reason: 'Risk accepted for business need',
      approved_by: 'user-1',
      approved_at: new Date(),
      expires_at: new Date('2025-01-01'),
      scope: 'global',
      scope_target: null,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({
      cve_id: 'CVE-2024-0001',
      package_name: 'lodash',
      package_version: '4.17.20',
      reason: 'Accepted',
    } as any);
    expect(result.reason).toBe('Risk accepted for business need');
  });

  test('should find by cve id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'w1',
        cve_id: 'CVE-2024-0001',
        package_name: 'lodash',
        package_version: '4.17.20',
        reason: 'Waiver',
        approved_by: null,
        approved_at: new Date(),
        expires_at: new Date(),
        scope: 'global',
        scope_target: null,
      }],
    });
    const result = await repo.findByCveId('CVE-2024-0001');
    expect(result.length).toBe(1);
    expect(result[0].cveId).toBe('CVE-2024-0001');
  });

  test('should find expired waivers', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'w1',
        cve_id: 'CVE-2024-0001',
        package_name: 'lodash',
        package_version: '4.17.20',
        reason: 'Old waiver',
        approved_by: null,
        approved_at: new Date(),
        expires_at: new Date('2023-01-01'),
        scope: 'global',
        scope_target: null,
      }],
    });
    const result = await repo.findExpired();
    expect(result.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('expires_at < NOW()'),
      ['__system__'],
    );
  });

  test('should find active waivers', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'w1',
        cve_id: 'CVE-2024-0001',
        package_name: 'lodash',
        package_version: '4.17.20',
        reason: 'Active waiver',
        approved_by: 'user-1',
        approved_at: new Date(),
        expires_at: new Date('2027-01-01'),
        scope: 'project',
        scope_target: 'proj-1',
      }],
    });
    const result = await repo.findActive();
    expect(result.length).toBe(1);
    expect(result[0].scope).toBe('project');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('expires_at > NOW()'),
      ['__system__'],
    );
  });
});
