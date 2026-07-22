import { KnownIssueRepository, KnownIssueEntity } from '../KnownIssueRepository';

describe('KnownIssueRepository', () => {
  let repo: KnownIssueRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new KnownIssueRepository(mockDb);
  });

  test('should create known issue', async () => {
    const mockRow = {
      id: 'ki-1',
      tenant_id: 'tenant-1',
      title: 'Memory leak in worker process',
      description: 'Known issue causing memory buildup',
      fingerprint: 'fp-mem-leak-001',
      ticket_id: null,
      resolved: false,
      resolved_at: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ tenantId: 'tenant-1', title: 'Memory leak', fingerprint: 'fp-001' } as any);
    expect(result.title).toBe('Memory leak in worker process');
    expect(result.resolved).toBe(false);
  });

  test('should find by tenant id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ki1', tenant_id: 'tenant-1', title: 'Issue 1', description: null, fingerprint: 'fp1', ticket_id: null, resolved: false, resolved_at: null, created_at: new Date() },
        { id: 'ki2', tenant_id: 'tenant-1', title: 'Issue 2', description: null, fingerprint: 'fp2', ticket_id: null, resolved: true, resolved_at: new Date(), created_at: new Date() },
      ],
    });
    const result = await repo.findByTenantId('tenant-1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('tenant-1');
  });

  test('should find open issues', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'ki1', tenant_id: 't1', title: 'Open Issue', description: null, fingerprint: 'fp1', ticket_id: null, resolved: false, resolved_at: null, created_at: new Date() }],
    });
    const result = await repo.findOpen('t1');
    expect(result.length).toBe(1);
    expect(result[0].resolved).toBe(false);
  });

  test('should resolve issue', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'ki-1', tenant_id: 't1', title: 'Issue', description: null, fingerprint: 'fp1', ticket_id: null, resolved: true, resolved_at: new Date(), created_at: new Date() }],
    });
    const result = await repo.resolve('ki-1');
    expect(result?.resolved).toBe(true);
    expect(result?.resolvedAt).toBeDefined();
  });
});