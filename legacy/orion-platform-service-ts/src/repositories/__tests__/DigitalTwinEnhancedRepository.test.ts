/**
 * DigitalTwinEnhancedRepository Tests
 */
import { TwinConfigRepository, SandboxRepository } from '../DigitalTwinEnhancedRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();

const sampleTwinRow = {
  id: 'tc-1', tenant_id: 'test-tenant', twin_name: 'prod-twin', description: 'desc',
  environment: 'prod', services: '["svc-a"]', sync_interval: 30, data_retention_days: 90,
  status: 'active', health_score: 95, service_states: '{"svc-a":{"status":"ok","latency":10}}',
  last_sync_at: null, created_at: new Date(), updated_at: new Date(),
};

const sampleSandboxRow = {
  id: 'sb-1', tenant_id: 'test-tenant', twin_id: 'tc-1', sandbox_name: 'test-sb',
  status: 'running', endpoint: 'http://sb-1.local', snapshot_id: null,
  resources: '{"cpu":"500m","memory":"512Mi","replicas":1}',
  env_vars: '{}', network_isolation: true, health_status: 'healthy',
  last_health_check: null, started_at: new Date(), stopped_at: null,
  created_at: new Date(), updated_at: new Date(),
};

describe('TwinConfigRepository', () => {
  let repo: TwinConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TwinConfigRepository({ query: mockQuery } as any);
  });

  it('should find by tenant', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleTwinRow], rowCount: 1 });
    const result = await repo.findByTenant('test-tenant');
    expect(result).toHaveLength(1);
    expect(result[0].twinName).toBe('prod-twin');
  });

  it('should insert twin config', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleTwinRow], rowCount: 1 });
    const result = await repo.insert({
      tenant_id: 'test-tenant', twin_name: 'prod-twin', environment: 'prod',
      services: ['svc-a'], sync_interval: 30, data_retention_days: 90,
    });
    expect(result.twinName).toBe('prod-twin');
  });

  it('should update status', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleTwinRow], rowCount: 1 });
    await repo.updateStatus('tc-1', 'syncing', new Date().toISOString());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
  });

  it('should delete by id', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deleteById('tc-1');
    expect(result).toBe(true);
  });
});

describe('SandboxRepository', () => {
  let repo: SandboxRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SandboxRepository({ query: mockQuery } as any);
  });

  it('should find by twin', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleSandboxRow], rowCount: 1 });
    const result = await repo.findByTwin('tc-1');
    expect(result).toHaveLength(1);
  });

  it('should insert sandbox', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleSandboxRow], rowCount: 1 });
    const result = await repo.insert({
      tenant_id: 'test-tenant', twin_id: 'tc-1', sandbox_name: 'test-sb',
      status: 'running', endpoint: 'http://sb-1.local',
      resources: { cpu: '500m', memory: '512Mi', replicas: 1 },
      env_vars: {}, network_isolation: true, health_status: 'healthy',
    });
    expect(result.id).toBe('sb-1');
  });
});
