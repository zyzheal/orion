import { MaintenanceWindowRepository, MaintenanceWindowEntity } from '../MaintenanceWindowRepository';

describe('MaintenanceWindowRepository', () => {
  let repo: MaintenanceWindowRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new MaintenanceWindowRepository(mockDb);
  });

  test('should create maintenance window', async () => {
    const mockRow = {
      id: 'mw-1',
      tenant_id: 'tenant-1',
      name: 'System Upgrade',
      start_time: new Date('2025-01-01T00:00:00Z'),
      end_time: new Date('2025-01-01T04:00:00Z'),
      affected_services: ['api', 'worker'],
      created_by: 'user-1',
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ tenantId: 'tenant-1', name: 'System Upgrade' } as any);
    expect(result.name).toBe('System Upgrade');
    expect(result.affectedServices).toEqual(['api', 'worker']);
  });

  test('should find by tenant id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'mw1', tenant_id: 'tenant-1', name: 'Window 1', start_time: new Date(), end_time: new Date(), affected_services: [], created_by: null, created_at: new Date() },
        { id: 'mw2', tenant_id: 'tenant-1', name: 'Window 2', start_time: new Date(), end_time: new Date(), affected_services: ['api'], created_by: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByTenantId('tenant-1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('tenant-1');
  });

  test('should find active windows', async () => {
    const now = new Date();
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'mw1', tenant_id: 't1', name: 'Active Window', start_time: new Date(now.getTime() - 3600000), end_time: new Date(now.getTime() + 3600000), affected_services: [], created_by: null, created_at: new Date() }],
    });
    const result = await repo.findActive(now);
    expect(result.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('start_time <= $1 AND end_time >= $1'),
      [now],
    );
  });

  test('should delete expired windows', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 5 });
    const result = await repo.deleteExpired(new Date('2025-01-02'));
    expect(result).toBe(5);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM maintenance_windows'),
      expect.any(Array),
    );
  });
});