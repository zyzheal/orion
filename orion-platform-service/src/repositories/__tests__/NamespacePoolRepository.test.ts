/**
 * NamespacePoolRepository 单元测试
 */

import { NamespacePoolRepository, NamespacePoolEntity } from '../NamespacePoolRepository';

describe('NamespacePoolRepository', () => {
  let repo: NamespacePoolRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new NamespacePoolRepository(mockDb);
  });

  test('should create namespace pool', async () => {
    const mockRow = {
      id: 'pool-1',
      tenant_id: 'tenant-1',
      name: 'dev-pool',
      namespace: 'dev-namespace',
      resource_type: 'kubernetes',
      capacity: { cpu: 4, memory: 8192 },
      used: { cpu: 0, memory: 0 },
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({
      tenantId: 'tenant-1',
      name: 'dev-pool',
      namespace: 'dev-namespace',
      resourceType: 'kubernetes',
      capacity: { cpu: 4, memory: 8192 },
      used: { cpu: 0, memory: 0 },
      status: 'active'
    } as any);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.any(Array));
    expect(result.tenantId).toBe('tenant-1');
    expect(result.name).toBe('dev-pool');
  });

  test('should find by tenant', async () => {
    const mockRows = [
      { id: 'pool-1', tenant_id: 'tenant-1', name: 'pool-1', namespace: 'ns-1', resource_type: 'k8s', capacity: {}, used: {}, status: 'active', created_at: new Date(), updated_at: new Date() },
      { id: 'pool-2', tenant_id: 'tenant-1', name: 'pool-2', namespace: 'ns-2', resource_type: 'k8s', capacity: {}, used: {}, status: 'active', created_at: new Date(), updated_at: new Date() }
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });
    const result = await repo.findByTenant('tenant-1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('tenant-1');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('tenant_id'), ['tenant-1']);
  });

  test('should find by namespace', async () => {
    const mockRow = {
      id: 'pool-1',
      tenant_id: 'tenant-1',
      name: 'dev-pool',
      namespace: 'dev-namespace',
      resource_type: 'kubernetes',
      capacity: { cpu: 4, memory: 8192 },
      used: { cpu: 2, memory: 4096 },
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.findByNamespace('dev-namespace');
    expect(result).toBeDefined();
    expect(result?.namespace).toBe('dev-namespace');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('namespace'), ['dev-namespace']);
  });

  test('should update usage', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'pool-1', used: { cpu: 2, memory: 4096 } }] });
    await repo.updateUsage('pool-1', { cpu: 2, memory: 4096 });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.arrayContaining([expect.any(String), 'pool-1'])
    );
  });
});