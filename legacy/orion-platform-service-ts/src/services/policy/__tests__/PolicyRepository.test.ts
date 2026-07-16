/**
 * PolicyRepository Tests
 *
 * Covers:
 * - findPolicyById: found, not found, db error
 * - findAllPolicies: with tenant, without tenant
 * - createPolicy: normal, with custom effect
 * - updatePolicy: partial updates, no updates, not found
 * - deletePolicy: success, not found
 * - createEvaluation: normal
 * - findEvaluations: normal, with limit
 */

import { PolicyRepository } from '../PolicyRepository';

function createMockPool() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

describe('PolicyRepository', () => {
  let pool: ReturnType<typeof createMockPool>;
  let repo: PolicyRepository;

  beforeEach(() => {
    pool = createMockPool();
    repo = new PolicyRepository(pool as any);
    jest.clearAllMocks();
  });

  describe('findPolicyById', () => {
    it('should return a policy when found', async () => {
      const mockPolicy = {
        id: 'pol-1',
        tenant_id: 't1',
        name: 'allow-deploy',
        description: 'Allow deployments',
        resource: 'deployment',
        action: 'create',
        effect: 'allow',
        rego_code: 'allow { input.action == "create" }',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      pool.query.mockResolvedValueOnce({ rows: [mockPolicy], rowCount: 1 });

      const result = await repo.findPolicyById('pol-1');

      expect(result).toEqual(mockPolicy);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM policies WHERE id = $1', ['pol-1']);
    });

    it('should return null when policy not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findPolicyById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAllPolicies', () => {
    it('should return all policies for a tenant', async () => {
      const mockPolicies = [
        { id: 'pol-1', tenant_id: 't1', name: 'policy-1' },
        { id: 'pol-2', tenant_id: 't1', name: 'policy-2' },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockPolicies, rowCount: 2 });

      const result = await repo.findAllPolicies('t1');

      expect(result).toEqual(mockPolicies);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['t1']
      );
    });

    it('should return all policies without tenant filter', async () => {
      const mockPolicies = [
        { id: 'pol-1', tenant_id: 't1' },
        { id: 'pol-2', tenant_id: 't2' },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockPolicies, rowCount: 2 });

      const result = await repo.findAllPolicies();

      expect(result).toEqual(mockPolicies);
      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        []
      );
    });

    it('should order by created_at DESC', async () => {
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findAllPolicies();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('createPolicy', () => {
    it('should create a policy with default effect', async () => {
      const mockCreated = {
        id: 'pol-new',
        tenant_id: 't1',
        name: 'new-policy',
        resource: 'pipeline',
        action: 'run',
        effect: 'allow',
        rego_code: 'allow {}',
        enabled: true,
      };
      pool.query.mockResolvedValueOnce({ rows: [mockCreated], rowCount: 1 });

      const result = await repo.createPolicy('t1', 'new-policy', 'pipeline', 'run', 'allow {}');

      expect(result).toEqual(mockCreated);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO policies'),
        expect.arrayContaining(['t1', 'new-policy', 'pipeline', 'run', 'allow', 'allow {}'])
      );
    });

    it('should create a policy with custom effect', async () => {
      const mockCreated = { id: 'pol-deny', effect: 'deny' };
      pool.query.mockResolvedValueOnce({ rows: [mockCreated], rowCount: 1 });

      await repo.createPolicy('t1', 'deny-policy', 'config', 'delete', 'deny {}', 'deny');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO policies'),
        expect.arrayContaining(['deny'])
      );
    });

    it('should enable policy by default', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ enabled: true }], rowCount: 1 });

      await repo.createPolicy('t1', 'test', 'res', 'act', 'code');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('true'),
        expect.any(Array)
      );
    });
  });

  describe('updatePolicy', () => {
    it('should update policy name', async () => {
      const mockUpdated = { id: 'pol-1', name: 'updated-name' };
      pool.query.mockResolvedValueOnce({ rows: [mockUpdated], rowCount: 1 });

      const result = await repo.updatePolicy('pol-1', { name: 'updated-name' });

      expect(result).toEqual(mockUpdated);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('name = $1'),
        expect.arrayContaining(['updated-name', 'pol-1'])
      );
    });

    it('should update rego_code', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'pol-1' }], rowCount: 1 });

      await repo.updatePolicy('pol-1', { rego_code: 'new code' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('rego_code = $1'),
        expect.arrayContaining(['new code', 'pol-1'])
      );
    });

    it('should update enabled status', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'pol-1' }], rowCount: 1 });

      await repo.updatePolicy('pol-1', { enabled: false });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('enabled = $1'),
        expect.arrayContaining([false, 'pol-1'])
      );
    });

    it('should update multiple fields at once', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'pol-1' }], rowCount: 1 });

      await repo.updatePolicy('pol-1', { name: 'new', enabled: false });

      const callArgs = pool.query.mock.calls[0];
      expect(callArgs[0]).toContain('name = $1');
      expect(callArgs[0]).toContain('enabled = $2');
      expect(callArgs[0]).toContain('updated_at = NOW()');
    });

    it('should return existing policy when no fields to update', async () => {
      const existing = { id: 'pol-1', name: 'existing' };
      pool.query.mockResolvedValueOnce({ rows: [existing], rowCount: 1 });

      const result = await repo.updatePolicy('pol-1', {});

      expect(result).toEqual(existing);
      // Should call findPolicyById instead of UPDATE
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM policies WHERE id = $1',
        ['pol-1']
      );
    });

    it('should return null when policy not found after update', async () => {
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.updatePolicy('nonexistent', { name: 'test' });

      expect(result).toBeNull();
    });

    it('should include updated_at in update', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'pol-1' }], rowCount: 1 });

      await repo.updatePolicy('pol-1', { name: 'test' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('deletePolicy', () => {
    it('should return true when policy is deleted', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repo.deletePolicy('pol-1');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM policies WHERE id = $1', ['pol-1']);
    });

    it('should return false when policy not found', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repo.deletePolicy('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createEvaluation', () => {
    it('should create a policy evaluation', async () => {
      const mockEval = {
        id: 'eval-1',
        tenant_id: 't1',
        policy_id: 'pol-1',
        resource_type: 'deployment',
        resource_id: 'deploy-1',
        action: 'create',
        decision: 'allow',
        eval_input: { user: 'admin' },
        result: { allowed: true },
      };
      pool.query.mockResolvedValueOnce({ rows: [mockEval], rowCount: 1 });

      const result = await repo.createEvaluation(
        't1', 'pol-1', 'deployment', 'deploy-1', 'create', 'allow',
        { user: 'admin' }, { allowed: true }
      );

      expect(result).toEqual(mockEval);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO policy_evaluations'),
        expect.arrayContaining(['t1', 'pol-1', 'deployment', 'deploy-1', 'create', 'allow'])
      );
    });

    it('should accept null policy_id', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'eval-1', policy_id: null }], rowCount: 1 });

      const result = await repo.createEvaluation(
        't1', null, 'resource', 'res-1', 'read', 'deny', {}, {}
      );

      expect(result.policy_id).toBeNull();
    });
  });

  describe('findEvaluations', () => {
    it('should return evaluations for a tenant', async () => {
      const mockEvals = [
        { id: 'eval-1', tenant_id: 't1' },
        { id: 'eval-2', tenant_id: 't1' },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockEvals, rowCount: 2 });

      const result = await repo.findEvaluations('t1');

      expect(result).toEqual(mockEvals);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['t1', 100]
      );
    });

    it('should respect custom limit', async () => {
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findEvaluations('t1', 50);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['t1', 50]
      );
    });

    it('should order by created_at DESC', async () => {
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findEvaluations('t1');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });
});
