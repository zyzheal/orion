/**
 * RLSPolicyManager Tests
 *
 * Covers:
 * - setTenantSessionVariable: normal, disabled, db error
 * - clearTenantSessionVariable: normal, db error
 * - getCurrentTenantId: normal, empty, null, db error
 * - checkRLSStatus: normal, table not found, db error
 * - checkAllRLSStatus: iterates all tables
 * - createRLSPolicy: normal, disabled, invalid table name, db error
 * - disableRLSPolicy: normal, invalid table name, db error
 * - validateRLSIsolation: normal, invalid table name, db error
 * - enable/disable/isEnabled
 * - getRLSTableList
 * - getSessionVariableName
 * - generateSessionSetSQL / generateSessionClearSQL
 * - createRLSPolicyManager factory
 */

import { RLSPolicyManager, createRLSPolicyManager } from '../RLSPolicyManager';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

describe('RLSPolicyManager', () => {
  let db: ReturnType<typeof createMockDb>;
  let manager: RLSPolicyManager;

  beforeEach(() => {
    db = createMockDb();
    manager = new RLSPolicyManager(db);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default session variable name', () => {
      expect(manager.getSessionVariableName()).toBe('app.current_tenant_id');
    });

    it('should accept custom session variable name', () => {
      const custom = new RLSPolicyManager(db, { sessionVariableName: 'custom.var' });
      expect(custom.getSessionVariableName()).toBe('custom.var');
    });
  });

  describe('setTenantSessionVariable', () => {
    it('should set session variable for tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [{}] });

      const result = await manager.setTenantSessionVariable(42);

      expect(result).toEqual({
        variableName: 'app.current_tenant_id',
        value: '42',
        success: true,
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('set_config'),
        expect.arrayContaining(['app.current_tenant_id', '42', 'app.tenant_isolation', 'true'])
      );
    });

    it('should return success when disabled', async () => {
      manager.disable();

      const result = await manager.setTenantSessionVariable(42);

      expect(result).toEqual({
        variableName: 'app.current_tenant_id',
        value: '',
        success: true,
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return failure on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('connection refused'));

      const result = await manager.setTenantSessionVariable(42);

      expect(result).toEqual({
        variableName: 'app.current_tenant_id',
        value: '',
        success: false,
      });
    });
  });

  describe('clearTenantSessionVariable', () => {
    it('should clear session variables', async () => {
      db.query.mockResolvedValueOnce({ rows: [{}] });

      await manager.clearTenantSessionVariable();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('set_config'),
        expect.arrayContaining(['app.current_tenant_id', '', 'app.tenant_isolation', 'false'])
      );
    });

    it('should not throw on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('connection lost'));

      await expect(manager.clearTenantSessionVariable()).resolves.toBeUndefined();
    });
  });

  describe('getCurrentTenantId', () => {
    it('should return tenant id from session', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ tenant_id: '7' }] });

      const result = await manager.getCurrentTenantId();

      expect(result).toBe(7);
    });

    it('should return null when session variable is empty', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ tenant_id: '' }] });

      const result = await manager.getCurrentTenantId();

      expect(result).toBeNull();
    });

    it('should return null when no rows returned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await manager.getCurrentTenantId();

      expect(result).toBeNull();
    });

    it('should return null on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('timeout'));

      const result = await manager.getCurrentTenantId();

      expect(result).toBeNull();
    });
  });

  describe('checkRLSStatus', () => {
    it('should return RLS status for a table', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ relname: 'sessions', relrowsecurity: true, relforcerowsecurity: true }] })
        .mockResolvedValueOnce({ rows: [{ polname: 'tenant_isolation_sessions' }] });

      const result = await manager.checkRLSStatus('sessions');

      expect(result).toEqual({
        tableName: 'sessions',
        rlsEnabled: true,
        rlsForced: true,
        policyCount: 1,
        policies: ['tenant_isolation_sessions'],
      });
    });

    it('should return defaults when table not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await manager.checkRLSStatus('nonexistent');

      expect(result).toEqual({
        tableName: 'nonexistent',
        rlsEnabled: false,
        rlsForced: false,
        policyCount: 0,
        policies: [],
      });
    });

    it('should return defaults on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('permission denied'));

      const result = await manager.checkRLSStatus('sessions');

      expect(result.rlsEnabled).toBe(false);
      expect(result.policyCount).toBe(0);
    });
  });

  describe('checkAllRLSStatus', () => {
    it('should check status for all RLS tables', async () => {
      const tables = manager.getRLSTableList();
      // Each table triggers 2 queries
      db.query.mockResolvedValue({ rows: [] });

      const results = await manager.checkAllRLSStatus();

      expect(results).toHaveLength(tables.length);
      // 2 queries per table
      expect(db.query).toHaveBeenCalledTimes(tables.length * 2);
    });
  });

  describe('createRLSPolicy', () => {
    it('should create RLS policy for a valid table', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await manager.createRLSPolicy('sessions');

      expect(result).toBe(true);
      // Should execute: ENABLE, FORCE, CREATE POLICY, CREATE INDEX
      expect(db.query).toHaveBeenCalledTimes(4);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ENABLE ROW LEVEL SECURITY'));
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FORCE ROW LEVEL SECURITY'));
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('CREATE POLICY'));
    });

    it('should return true when disabled', async () => {
      manager.disable();

      const result = await manager.createRLSPolicy('sessions');

      expect(result).toBe(true);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should reject invalid table name to prevent SQL injection', async () => {
      const result = await manager.createRLSPolicy('DROP TABLE users;--');

      expect(result).toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return false on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('permission denied'));

      const result = await manager.createRLSPolicy('sessions');

      expect(result).toBe(false);
    });

    it('should accept table names with underscores', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await manager.createRLSPolicy('pipeline_runs');

      expect(result).toBe(true);
    });
  });

  describe('createAllRLSPolicies', () => {
    it('should create policies for all tables', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await manager.createAllRLSPolicies();

      expect(results.length).toBe(manager.getRLSTableList().length);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('disableRLSPolicy', () => {
    it('should disable RLS for a table', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await manager.disableRLSPolicy('sessions');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DISABLE ROW LEVEL SECURITY'));
    });

    it('should reject invalid table name', async () => {
      const result = await manager.disableRLSPolicy('sessions; DROP TABLE users');

      expect(result).toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return false on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('access denied'));

      const result = await manager.disableRLSPolicy('sessions');

      expect(result).toBe(false);
    });
  });

  describe('validateRLSIsolation', () => {
    it('should validate RLS isolation for a table', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await manager.validateRLSIsolation(1, 'sessions');

      expect(result).toBe(true);
      // Should set session, query count, clear session
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('should reject invalid table name', async () => {
      const result = await manager.validateRLSIsolation(1, '123invalid');

      expect(result).toBe(false);
    });

    it('should return false on db error during count query', async () => {
      // setTenantSessionVariable succeeds, but the count query fails
      db.query
        .mockResolvedValueOnce({ rows: [{}] }) // setTenantSessionVariable
        .mockRejectedValueOnce(new Error('query failed')); // COUNT query

      const result = await manager.validateRLSIsolation(1, 'sessions');

      expect(result).toBe(false);
    });
  });

  describe('enable/disable/isEnabled', () => {
    it('should be enabled by default', () => {
      expect(manager.isEnabled()).toBe(true);
    });

    it('should disable the manager', () => {
      manager.disable();
      expect(manager.isEnabled()).toBe(false);
    });

    it('should re-enable the manager', () => {
      manager.disable();
      manager.enable();
      expect(manager.isEnabled()).toBe(true);
    });
  });

  describe('getRLSTableList', () => {
    it('should return a copy of the RLS table list', () => {
      const list = manager.getRLSTableList();
      expect(Array.isArray(list)).toBe(true);
      expect(list).toContain('sessions');
      expect(list).toContain('audit_logs');
      expect(list).toContain('pipelines');
    });

    it('should return a new copy each time', () => {
      const list1 = manager.getRLSTableList();
      const list2 = manager.getRLSTableList();
      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });

  describe('generateSessionSetSQL', () => {
    it('should generate SQL for setting session variable', () => {
      const sql = manager.generateSessionSetSQL(42);
      expect(sql).toContain('app.current_tenant_id');
      expect(sql).toContain('42');
      expect(sql).toContain('app.tenant_isolation');
    });
  });

  describe('generateSessionClearSQL', () => {
    it('should generate SQL for clearing session variable', () => {
      const sql = manager.generateSessionClearSQL();
      expect(sql).toContain('app.current_tenant_id');
      expect(sql).toContain("''");
      expect(sql).toContain("'false'");
    });
  });
});

describe('createRLSPolicyManager', () => {
  it('should create a new RLSPolicyManager instance', () => {
    const db = createMockDb();
    const manager = createRLSPolicyManager(db);
    expect(manager).toBeInstanceOf(RLSPolicyManager);
  });
});
