/**
 * TenantQuotaRepository 单元测试
 */

import { TenantQuotaRepository, TenantQuotaEntity } from '../TenantQuotaRepository';

describe('TenantQuotaRepository', () => {
  let repo: TenantQuotaRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = { query: jest.fn() };
    repo = new TenantQuotaRepository(mockDb);
  });

  test('should find quota by tenant id', async () => {
    const mockRow = {
      id: 'quota-1', tenant_id: 'tenant-1', max_users: 100, max_projects: 50,
      max_pipelines: 200, max_storage_mb: 10240, max_api_calls_per_hour: 10000,
      max_concurrent_builds: 10, usage: {}, created_at: new Date(), updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.findByTenantId('tenant-1');
    expect(result?.tenantId).toBe('tenant-1');
    expect(result?.maxPipelines).toBe(200);
  });

  test('should return undefined when tenant not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.findByTenantId('nonexistent');
    expect(result).toBeUndefined();
  });

  test('should create quota', async () => {
    const mockRow = {
      id: 'quota-1', tenant_id: 'tenant-1', max_pipelines: 100, max_pipeline_runs_per_day: 100,
      max_concurrent_builds: 5, max_tasks_per_pipeline: 50, max_runners: 10,
      max_cpu_cores: 8, max_memory_gb: 16, max_storage_mb: 10240, max_projects: 5,
      max_users: 100, api_rate_limit: 1000, api_rate_limit_window_seconds: 60,
      usage: {}, created_at: new Date(), updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({
      id: 'quota-1', tenantId: 'tenant-1', maxPipelines: 100,
    });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.any(Array));
    expect(result.tenantId).toBe('tenant-1');
  });

  test('should increment usage', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.incrementUsage('tenant-1', 'pipelines', 10);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
  });

  test('should list quotas with pagination', async () => {
    // First call: SELECT query, second call: COUNT query
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { id: 'q1', tenant_id: 't1', max_pipelines: 10, created_at: new Date(), updated_at: new Date() },
        { id: 'q2', tenant_id: 't2', max_pipelines: 20, created_at: new Date(), updated_at: new Date() },
      ]
    });
    mockDb.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
    const result = await repo.findAll({ limit: 10 });
    expect(result.entities.length).toBe(2);
    expect(result.total).toBe(2);
  });
});
