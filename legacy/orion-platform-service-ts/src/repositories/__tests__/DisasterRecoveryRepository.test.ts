/**
 * DisasterRecoveryRepository Tests
 */
import { DisasterRecoveryRepository } from '../DisasterRecoveryRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: DisasterRecoveryRepository;

const samplePlanRow = {
  id: 'dr-1', tenant_id: 'test-tenant', plan_name: 'Full DR', description: 'Full DR plan',
  rpo_minutes: 60, rto_minutes: 120, priority: 'critical', enabled: true,
  backup_strategy: 'full', replication_type: 'sync', test_frequency: 'monthly',
  last_tested_at: null, last_success_at: null, created_by: 'admin',
  created_at: new Date(), updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new DisasterRecoveryRepository({ query: mockQuery } as any);
});

describe('DisasterRecoveryRepository', () => {
  it('should find all plans', async () => {
    mockQuery.mockResolvedValue({ rows: [samplePlanRow], rowCount: 1 });
    const result = await repo.findAllPlans('test-tenant');
    expect(result).toHaveLength(1);
    expect(result[0].plan_name).toBe('Full DR');
  });

  it('should find plan by id', async () => {
    mockQuery.mockResolvedValue({ rows: [samplePlanRow], rowCount: 1 });
    const result = await repo.findPlanById('test-tenant', 'dr-1');
    expect(result?.id).toBe('dr-1');
  });

  it('should create plan', async () => {
    mockQuery.mockResolvedValue({ rows: [samplePlanRow], rowCount: 1 });
    const result = await repo.createPlan({
      tenant_id: 'test-tenant', plan_name: 'Full DR', rpo_minutes: 60, rto_minutes: 120,
      priority: 'critical', backup_strategy: 'full', replication_type: 'sync', test_frequency: 'monthly',
    } as any);
    expect(result.id).toBe('dr-1');
  });

  it('should update last tested', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.updateLastTested('test-tenant', 'dr-1', new Date());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
  });

  it('should delete plan', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deletePlan('test-tenant', 'dr-1');
    expect(result).toBe(true);
  });
});
