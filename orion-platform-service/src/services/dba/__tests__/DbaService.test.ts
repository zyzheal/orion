/**
 * Comprehensive tests for DbaService
 * Covers: SQL order management, data source management, audit rules
 */

import { DbaService } from '../DbaService';

// We need to reset modules between describe blocks that share state
// because DbaService uses module-level Map() for storage
let DbaServiceClass: typeof DbaService;

beforeEach(() => {
  jest.resetModules();
  // Re-import after module reset to get fresh Maps
  DbaServiceClass = require('../DbaService').DbaService;
});

// Helper to create a valid order input
function makeOrderInput(overrides?: Partial<{ database: string; sql: string; comment: string; type: string }>) {
  return {
    database: 'test_db',
    sql: 'SELECT * FROM users',
    comment: 'Test query',
    ...overrides,
  };
}

// Helper to create a valid data source input
function makeDataSourceInput(overrides?: Partial<{ name: string; type: string; host: string; port: number; database: string }>) {
  return {
    name: 'Test DB',
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'test_db',
    ...overrides,
  };
}

// Helper to create a valid audit rule input
function makeAuditRuleInput(overrides?: Partial<{ name: string; pattern: string; severity: string; enabled: boolean }>) {
  return {
    name: 'No DROP tables',
    pattern: 'DROP TABLE',
    ...overrides,
  };
}

// ============================================================================
// SQL Orders
// ============================================================================

describe('DbaService - SQL Orders', () => {
  let service: DbaService;

  beforeEach(() => {
    service = new DbaServiceClass();
  });

  describe('createOrder', () => {
    it('should create an order with all required fields', async () => {
      const input = makeOrderInput();
      const order = await service.createOrder(input, 'user-1', 'tenant-1');

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(typeof order.id).toBe('string');
      expect(order.tenantId).toBe('tenant-1');
      expect(order.userId).toBe('user-1');
      expect(order.database).toBe('test_db');
      expect(order.sql).toBe('SELECT * FROM users');
      expect(order.comment).toBe('Test query');
      expect(order.status).toBe('pending');
      expect(order.createdAt).toBeDefined();
    });

    it('should default type to "query" when not specified', async () => {
      const input = makeOrderInput({ type: undefined });
      const order = await service.createOrder(input, 'user-1', 'tenant-1');

      expect(order.type).toBe('query');
    });

    it('should use provided type when specified', async () => {
      const input = makeOrderInput({ type: 'delete' });
      const order = await service.createOrder(input, 'user-1', 'tenant-1');

      expect(order.type).toBe('delete');
    });

    it('should support all order types', async () => {
      const types = ['query', 'insert', 'update', 'delete', 'ddl'] as const;

      for (const type of types) {
        const input = makeOrderInput({ type, sql: `SQL for ${type}` });
        const order = await service.createOrder(input, 'user-1', 'tenant-1');
        expect(order.type).toBe(type);
      }
    });

    it('should generate unique IDs for multiple orders', async () => {
      const order1 = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const order2 = await service.createOrder(makeOrderInput(), 'user-2', 'tenant-1');

      expect(order1.id).not.toBe(order2.id);
    });

    it('should set createdAt as ISO string', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');

      expect(order.createdAt).toBeDefined();
      expect(() => new Date(order.createdAt)).not.toThrow();
      expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    });

    it('should initialize with pending status', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');

      expect(order.status).toBe('pending');
      expect(order.approvedBy).toBeUndefined();
      expect(order.approvedAt).toBeUndefined();
      expect(order.executedAt).toBeUndefined();
      expect(order.result).toBeUndefined();
    });
  });

  describe('getOrder', () => {
    it('should return an existing order by ID', async () => {
      const created = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const found = await service.getOrder(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.database).toBe('test_db');
    });

    it('should return undefined for non-existent order', async () => {
      const result = await service.getOrder('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string ID', async () => {
      const result = await service.getOrder('');

      expect(result).toBeUndefined();
    });
  });

  describe('listOrders', () => {
    it('should return empty list when no orders exist', async () => {
      const result = await service.listOrders();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should list all orders without filters', async () => {
      await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.createOrder(makeOrderInput({ sql: 'INSERT INTO t VALUES (1)' }), 'user-2', 'tenant-2');

      const result = await service.listOrders();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by tenantId', async () => {
      await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.createOrder(makeOrderInput(), 'user-2', 'tenant-2');

      const result = await service.listOrders({ tenantId: 'tenant-1' });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].tenantId).toBe('tenant-1');
    });

    it('should filter by status', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.approveOrder(order.id, 'admin');

      const pendingResult = await service.listOrders({ status: 'pending' });
      const approvedResult = await service.listOrders({ status: 'approved' });

      expect(pendingResult.data).toHaveLength(1);
      expect(approvedResult.data).toHaveLength(1);
    });

    it('should apply pagination with page and limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createOrder(makeOrderInput({ sql: `Query ${i}` }), 'user-1', 'tenant-1');
      }

      const page1 = await service.listOrders({ page: 1, limit: 2 });
      const page2 = await service.listOrders({ page: 2, limit: 2 });
      const page3 = await service.listOrders({ page: 3, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.data).toHaveLength(2);
      expect(page3.data).toHaveLength(1);
    });

    it('should default to page 1 and limit 20', async () => {
      for (let i = 0; i < 25; i++) {
        await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      }

      const result = await service.listOrders();

      expect(result.data).toHaveLength(20);
      expect(result.total).toBe(25);
    });

    it('should return empty data for page beyond total', async () => {
      await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');

      const result = await service.listOrders({ page: 10, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('should combine tenantId and status filters', async () => {
      await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const order2 = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.createOrder(makeOrderInput(), 'user-2', 'tenant-1');
      await service.approveOrder(order2.id, 'admin');

      const result = await service.listOrders({ tenantId: 'tenant-1', status: 'pending' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(o => o.tenantId === 'tenant-1' && o.status === 'pending')).toBe(true);
    });

    it('should handle params with only page set', async () => {
      for (let i = 0; i < 30; i++) {
        await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      }

      const result = await service.listOrders({ page: 2 });

      expect(result.data).toHaveLength(10); // 30 - 20 (limit default)
      expect(result.total).toBe(30);
    });
  });

  describe('approveOrder', () => {
    it('should approve a pending order', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const approved = await service.approveOrder(order.id, 'admin-1');

      expect(approved).toBeDefined();
      expect(approved!.status).toBe('approved');
      expect(approved!.approvedBy).toBe('admin-1');
      expect(approved!.approvedAt).toBeDefined();
    });

    it('should return undefined for non-existent order', async () => {
      const result = await service.approveOrder('non-existent', 'admin');

      expect(result).toBeUndefined();
    });

    it('should set approvedAt as ISO string', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const approved = await service.approveOrder(order.id, 'admin');

      expect(() => new Date(approved!.approvedAt!)).not.toThrow();
      expect(new Date(approved!.approvedAt!).toISOString()).toBe(approved!.approvedAt);
    });

    it('should allow approving an already approved order', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.approveOrder(order.id, 'admin-1');
      const reApproved = await service.approveOrder(order.id, 'admin-2');

      expect(reApproved).toBeDefined();
      expect(reApproved!.approvedBy).toBe('admin-2');
    });
  });

  describe('rejectOrder', () => {
    it('should reject a pending order', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const rejected = await service.rejectOrder(order.id);

      expect(rejected).toBeDefined();
      expect(rejected!.status).toBe('rejected');
    });

    it('should return undefined for non-existent order', async () => {
      const result = await service.rejectOrder('non-existent');

      expect(result).toBeUndefined();
    });

    it('should allow rejecting an already approved order', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.approveOrder(order.id, 'admin');
      const rejected = await service.rejectOrder(order.id);

      expect(rejected).toBeDefined();
      expect(rejected!.status).toBe('rejected');
    });
  });

  describe('executeOrder', () => {
    it('should execute an order and set result', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const executed = await service.executeOrder(order.id);

      expect(executed).toBeDefined();
      expect(executed!.status).toBe('completed');
      expect(executed!.executedAt).toBeDefined();
      expect(executed!.result).toBe('Execution completed (mock)');
    });

    it('should return undefined for non-existent order', async () => {
      const result = await service.executeOrder('non-existent');

      expect(result).toBeUndefined();
    });

    it('should set executedAt as ISO string', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      const executed = await service.executeOrder(order.id);

      expect(() => new Date(executed!.executedAt!)).not.toThrow();
      expect(new Date(executed!.executedAt!).toISOString()).toBe(executed!.executedAt);
    });

    it('should allow executing even without prior approval', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      // Note: service does not enforce approval before execution
      const executed = await service.executeOrder(order.id);

      expect(executed!.status).toBe('completed');
    });
  });

  describe('order lifecycle', () => {
    it('should support full order lifecycle: create -> approve -> execute', async () => {
      const order = await service.createOrder(
        makeOrderInput({ type: 'insert', sql: 'INSERT INTO users VALUES (1, "test")' }),
        'user-1',
        'tenant-1'
      );
      expect(order.status).toBe('pending');

      const approved = await service.approveOrder(order.id, 'admin');
      expect(approved!.status).toBe('approved');

      const executed = await service.executeOrder(order.id);
      expect(executed!.status).toBe('completed');
      expect(executed!.result).toBeDefined();
    });

    it('should support full order lifecycle: create -> reject', async () => {
      const order = await service.createOrder(
        makeOrderInput({ type: 'delete', sql: 'DROP TABLE users' }),
        'user-1',
        'tenant-1'
      );
      expect(order.status).toBe('pending');

      const rejected = await service.rejectOrder(order.id);
      expect(rejected!.status).toBe('rejected');
    });

    it('should persist state changes across service method calls', async () => {
      const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
      await service.approveOrder(order.id, 'admin');

      // Verify state persisted by fetching the order
      const fetched = await service.getOrder(order.id);
      expect(fetched!.status).toBe('approved');
      expect(fetched!.approvedBy).toBe('admin');
    });
  });
});

// ============================================================================
// Data Sources
// ============================================================================

describe('DbaService - Data Sources', () => {
  let service: DbaService;

  beforeEach(() => {
    service = new DbaServiceClass();
  });

  describe('createDataSource', () => {
    it('should create a data source with all fields', async () => {
      const input = makeDataSourceInput();
      const ds = await service.createDataSource(input);

      expect(ds).toBeDefined();
      expect(ds.id).toBeDefined();
      expect(ds.name).toBe('Test DB');
      expect(ds.type).toBe('mysql');
      expect(ds.host).toBe('localhost');
      expect(ds.port).toBe(3306);
      expect(ds.database).toBe('test_db');
      expect(ds.status).toBe('offline');
      expect(ds.lastChecked).toBeUndefined();
    });

    it('should support all database types', async () => {
      const types = ['mysql', 'postgresql', 'redis', 'mongodb'] as const;

      for (const type of types) {
        const ds = await service.createDataSource(makeDataSourceInput({ type, name: `${type}-db` }));
        expect(ds.type).toBe(type);
      }
    });

    it('should default status to offline', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());

      expect(ds.status).toBe('offline');
    });

    it('should generate unique IDs', async () => {
      const ds1 = await service.createDataSource(makeDataSourceInput({ name: 'DB 1' }));
      const ds2 = await service.createDataSource(makeDataSourceInput({ name: 'DB 2' }));

      expect(ds1.id).not.toBe(ds2.id);
    });

    it('should accept optional username and password in input', async () => {
      const input = { ...makeDataSourceInput(), username: 'admin', password: 'secret' };
      // Should not throw - these fields are in the input type but not stored on DataSource
      const ds = await service.createDataSource(input);

      expect(ds).toBeDefined();
      expect(ds.id).toBeDefined();
    });
  });

  describe('getDataSource', () => {
    it('should return existing data source by ID', async () => {
      const created = await service.createDataSource(makeDataSourceInput());
      const found = await service.getDataSource(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Test DB');
    });

    it('should return undefined for non-existent data source', async () => {
      const result = await service.getDataSource('non-existent');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string ID', async () => {
      const result = await service.getDataSource('');

      expect(result).toBeUndefined();
    });
  });

  describe('listDataSources', () => {
    it('should return empty list when no data sources exist', async () => {
      const result = await service.listDataSources();

      expect(result).toEqual([]);
    });

    it('should list all data sources', async () => {
      await service.createDataSource(makeDataSourceInput({ name: 'DB 1' }));
      await service.createDataSource(makeDataSourceInput({ name: 'DB 2' }));

      const result = await service.listDataSources();

      expect(result).toHaveLength(2);
    });

    it('should accept tenantId parameter without error', async () => {
      await service.createDataSource(makeDataSourceInput());

      // Note: current implementation does not filter by tenantId
      const result = await service.listDataSources('tenant-1');

      expect(result).toHaveLength(1);
    });

    it('should list data sources of all types', async () => {
      await service.createDataSource(makeDataSourceInput({ type: 'mysql' }));
      await service.createDataSource(makeDataSourceInput({ type: 'postgresql' }));
      await service.createDataSource(makeDataSourceInput({ type: 'redis' }));

      const result = await service.listDataSources();

      expect(result).toHaveLength(3);
      const types = result.map(ds => ds.type);
      expect(types).toContain('mysql');
      expect(types).toContain('postgresql');
      expect(types).toContain('redis');
    });
  });

  describe('updateDataSource', () => {
    it('should update existing data source fields', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      const updated = await service.updateDataSource(ds.id, { name: 'Updated DB', port: 5432 });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated DB');
      expect(updated!.port).toBe(5432);
    });

    it('should return undefined for non-existent data source', async () => {
      const result = await service.updateDataSource('non-existent', { name: 'Test' });

      expect(result).toBeUndefined();
    });

    it('should allow partial updates', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      const originalHost = ds.host;

      const updated = await service.updateDataSource(ds.id, { name: 'New Name' });

      expect(updated!.name).toBe('New Name');
      expect(updated!.host).toBe(originalHost);
    });

    it('should allow updating status', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      const updated = await service.updateDataSource(ds.id, { status: 'online' });

      expect(updated!.status).toBe('online');
    });

    it('should persist updates when retrieved later', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      await service.updateDataSource(ds.id, { name: 'Persisted Name' });

      const fetched = await service.getDataSource(ds.id);
      expect(fetched!.name).toBe('Persisted Name');
    });
  });

  describe('deleteDataSource', () => {
    it('should delete an existing data source', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      const result = await service.deleteDataSource(ds.id);

      expect(result).toBe(true);

      const found = await service.getDataSource(ds.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent data source', async () => {
      const result = await service.deleteDataSource('non-existent');

      expect(result).toBe(false);
    });

    it('should not affect other data sources', async () => {
      const ds1 = await service.createDataSource(makeDataSourceInput({ name: 'DB 1' }));
      const ds2 = await service.createDataSource(makeDataSourceInput({ name: 'DB 2' }));

      await service.deleteDataSource(ds1.id);

      const found = await service.getDataSource(ds2.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('DB 2');
    });

    it('should reduce list count after deletion', async () => {
      await service.createDataSource(makeDataSourceInput({ name: 'DB 1' }));
      const ds2 = await service.createDataSource(makeDataSourceInput({ name: 'DB 2' }));

      const beforeDelete = await service.listDataSources();
      expect(beforeDelete).toHaveLength(2);

      await service.deleteDataSource(ds2.id);

      const afterDelete = await service.listDataSources();
      expect(afterDelete).toHaveLength(1);
    });
  });

  describe('testConnection', () => {
    it('should return success for existing data source', async () => {
      const ds = await service.createDataSource(makeDataSourceInput({ host: 'db.example.com', port: 5432 }));
      const result = await service.testConnection(ds.id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected to db.example.com:5432');
    });

    it('should update data source status to online', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      await service.testConnection(ds.id);

      const updated = await service.getDataSource(ds.id);
      expect(updated!.status).toBe('online');
    });

    it('should set lastChecked timestamp', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      const result = await service.testConnection(ds.id);

      const updated = await service.getDataSource(ds.id);
      expect(updated!.lastChecked).toBeDefined();
      expect(() => new Date(updated!.lastChecked!)).not.toThrow();
    });

    it('should return failure for non-existent data source', async () => {
      const result = await service.testConnection('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Data source not found');
    });

    it('should return success with correct host:port in message', async () => {
      const ds = await service.createDataSource(makeDataSourceInput({ host: '192.168.1.100', port: 6379 }));
      const result = await service.testConnection(ds.id);

      expect(result.message).toBe('Connected to 192.168.1.100:6379');
    });
  });

  describe('data source lifecycle', () => {
    it('should support full lifecycle: create -> update -> test -> delete', async () => {
      const ds = await service.createDataSource(makeDataSourceInput());
      expect(ds.status).toBe('offline');

      const updated = await service.updateDataSource(ds.id, { host: 'new-host.example.com' });
      expect(updated!.host).toBe('new-host.example.com');

      const testResult = await service.testConnection(ds.id);
      expect(testResult.success).toBe(true);

      const deleted = await service.deleteDataSource(ds.id);
      expect(deleted).toBe(true);

      const found = await service.getDataSource(ds.id);
      expect(found).toBeUndefined();
    });
  });
});

// ============================================================================
// Audit Rules
// ============================================================================

describe('DbaService - Audit Rules', () => {
  let service: DbaService;

  beforeEach(() => {
    service = new DbaServiceClass();
  });

  describe('createAuditRule', () => {
    it('should create an audit rule with all fields', async () => {
      const input = makeAuditRuleInput();
      const rule = await service.createAuditRule(input, 'tenant-1');

      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(rule.tenantId).toBe('tenant-1');
      expect(rule.name).toBe('No DROP tables');
      expect(rule.pattern).toBe('DROP TABLE');
      expect(rule.severity).toBe('warning');
      expect(rule.enabled).toBe(true);
    });

    it('should default severity to warning', async () => {
      const input = makeAuditRuleInput({ severity: undefined });
      const rule = await service.createAuditRule(input, 'tenant-1');

      expect(rule.severity).toBe('warning');
    });

    it('should use provided severity when specified', async () => {
      const input = makeAuditRuleInput({ severity: 'error' });
      const rule = await service.createAuditRule(input, 'tenant-1');

      expect(rule.severity).toBe('error');
    });

    it('should support all severity levels', async () => {
      const severities = ['info', 'warning', 'error'] as const;

      for (const severity of severities) {
        const input = makeAuditRuleInput({ name: `Rule ${severity}`, severity });
        const rule = await service.createAuditRule(input, 'tenant-1');
        expect(rule.severity).toBe(severity);
      }
    });

    it('should default enabled to true', async () => {
      const input = makeAuditRuleInput({ enabled: undefined });
      const rule = await service.createAuditRule(input, 'tenant-1');

      expect(rule.enabled).toBe(true);
    });

    it('should respect explicit enabled=false', async () => {
      const input = makeAuditRuleInput({ enabled: false });
      const rule = await service.createAuditRule(input, 'tenant-1');

      expect(rule.enabled).toBe(false);
    });

    it('should generate unique IDs', async () => {
      const rule1 = await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 1' }), 'tenant-1');
      const rule2 = await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 2' }), 'tenant-1');

      expect(rule1.id).not.toBe(rule2.id);
    });
  });

  describe('listAuditRules', () => {
    it('should return empty list when no rules exist', async () => {
      const result = await service.listAuditRules();

      expect(result).toEqual([]);
    });

    it('should list all rules without tenantId filter', async () => {
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 1' }), 'tenant-1');
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 2' }), 'tenant-2');

      const result = await service.listAuditRules();

      expect(result).toHaveLength(2);
    });

    it('should filter by tenantId', async () => {
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 1' }), 'tenant-1');
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 2' }), 'tenant-2');
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 3' }), 'tenant-1');

      const result = await service.listAuditRules('tenant-1');

      expect(result).toHaveLength(2);
      expect(result.every(r => r.tenantId === 'tenant-1')).toBe(true);
    });

    it('should return empty for non-matching tenantId', async () => {
      await service.createAuditRule(makeAuditRuleInput(), 'tenant-1');

      const result = await service.listAuditRules('non-existent-tenant');

      expect(result).toHaveLength(0);
    });

    it('should return all rules when tenantId is empty string', async () => {
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 1' }), 'tenant-1');
      await service.createAuditRule(makeAuditRuleInput({ name: 'Rule 2' }), 'tenant-2');

      // Empty string is falsy, so no filter applied
      const result = await service.listAuditRules('');

      expect(result).toHaveLength(2);
    });
  });

  describe('updateAuditRule', () => {
    it('should update existing audit rule fields', async () => {
      const rule = await service.createAuditRule(makeAuditRuleInput(), 'tenant-1');
      const updated = await service.updateAuditRule(rule.id, {
        name: 'Updated Rule',
        pattern: 'TRUNCATE TABLE',
        severity: 'error',
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Rule');
      expect(updated!.pattern).toBe('TRUNCATE TABLE');
      expect(updated!.severity).toBe('error');
    });

    it('should return undefined for non-existent rule', async () => {
      const result = await service.updateAuditRule('non-existent', { name: 'Test' });

      expect(result).toBeUndefined();
    });

    it('should allow partial updates', async () => {
      const rule = await service.createAuditRule(makeAuditRuleInput(), 'tenant-1');
      const originalPattern = rule.pattern;

      const updated = await service.updateAuditRule(rule.id, { name: 'New Name' });

      expect(updated!.name).toBe('New Name');
      expect(updated!.pattern).toBe(originalPattern);
    });

    it('should allow toggling enabled status', async () => {
      const rule = await service.createAuditRule(makeAuditRuleInput({ enabled: true }), 'tenant-1');

      const disabled = await service.updateAuditRule(rule.id, { enabled: false });
      expect(disabled!.enabled).toBe(false);

      const reEnabled = await service.updateAuditRule(rule.id, { enabled: true });
      expect(reEnabled!.enabled).toBe(true);
    });

    it('should persist updates when retrieved later', async () => {
      const rule = await service.createAuditRule(makeAuditRuleInput(), 'tenant-1');
      await service.updateAuditRule(rule.id, { name: 'Persisted Name' });

      const rules = await service.listAuditRules('tenant-1');
      const found = rules.find(r => r.id === rule.id);
      expect(found!.name).toBe('Persisted Name');
    });
  });
});

// ============================================================================
// Edge cases and integration scenarios
// ============================================================================

describe('DbaService - Edge Cases', () => {
  let service: DbaService;

  beforeEach(() => {
    service = new DbaServiceClass();
  });

  it('should handle concurrent order creation', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      service.createOrder(makeOrderInput({ sql: `Query ${i}` }), `user-${i}`, 'tenant-1')
    );

    const orders = await Promise.all(promises);

    expect(orders).toHaveLength(10);
    const ids = new Set(orders.map(o => o.id));
    expect(ids.size).toBe(10); // all unique
  });

  it('should handle concurrent data source creation', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      service.createDataSource(makeDataSourceInput({ name: `DB ${i}` }))
    );

    const sources = await Promise.all(promises);

    expect(sources).toHaveLength(5);
    const ids = new Set(sources.map(ds => ds.id));
    expect(ids.size).toBe(5);
  });

  it('should handle large pagination values gracefully', async () => {
    await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');

    const result = await service.listOrders({ page: 999, limit: 1000 });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  it('should treat zero limit as default (20) due to falsy check', async () => {
    for (let i = 0; i < 3; i++) {
      await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
    }

    // limit=0 is falsy, so `params?.limit || 20` falls back to 20
    const result = await service.listOrders({ page: 1, limit: 0 });

    expect(result.data).toHaveLength(3); // all 3 items returned (limit defaulted to 20)
    expect(result.total).toBe(3);
  });

  it('should handle special characters in SQL and comment', async () => {
    const input = makeOrderInput({
      sql: "SELECT * FROM users WHERE name = 'O''Brien'; DROP TABLE --",
      comment: 'Test with "quotes" and \'escapes\' and <html> tags',
    });

    const order = await service.createOrder(input, 'user-1', 'tenant-1');

    expect(order.sql).toBe("SELECT * FROM users WHERE name = 'O''Brien'; DROP TABLE --");
    expect(order.comment).toBe('Test with \"quotes\" and \'escapes\' and <html> tags');
  });

  it('should handle special characters in data source fields', async () => {
    const input = makeDataSourceInput({
      name: 'DB with spaces & special chars (prod)',
      host: 'db-server.internal.company.com',
      database: 'my-database_v2.0',
    });

    const ds = await service.createDataSource(input);

    expect(ds.name).toBe('DB with spaces & special chars (prod)');
    expect(ds.host).toBe('db-server.internal.company.com');
    expect(ds.database).toBe('my-database_v2.0');
  });

  it('should handle very long SQL strings', async () => {
    const longSql = 'SELECT * FROM users WHERE '.repeat(100) + 'id = 1';
    const input = makeOrderInput({ sql: longSql });

    const order = await service.createOrder(input, 'user-1', 'tenant-1');

    expect(order.sql).toBe(longSql);
    expect(order.sql.length).toBeGreaterThan(1000);
  });

  it('should handle multiple approve/reject operations on same order', async () => {
    const order = await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');

    await service.approveOrder(order.id, 'admin-1');
    await service.rejectOrder(order.id);
    await service.approveOrder(order.id, 'admin-2');

    const final = await service.getOrder(order.id);
    expect(final!.status).toBe('approved');
    expect(final!.approvedBy).toBe('admin-2');
  });

  it('should handle delete then re-create data source with same name', async () => {
    const ds1 = await service.createDataSource(makeDataSourceInput({ name: 'Same Name' }));
    await service.deleteDataSource(ds1.id);

    const ds2 = await service.createDataSource(makeDataSourceInput({ name: 'Same Name' }));

    expect(ds2.id).not.toBe(ds1.id);
    expect(ds2.name).toBe('Same Name');

    const list = await service.listDataSources();
    expect(list).toHaveLength(1);
  });
});

// ============================================================================
// Cross-module integration
// ============================================================================

describe('DbaService - Cross-module Integration', () => {
  let service: DbaService;

  beforeEach(() => {
    service = new DbaServiceClass();
  });

  it('should manage orders and data sources independently', async () => {
    await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
    await service.createDataSource(makeDataSourceInput());

    const orders = await service.listOrders();
    const sources = await service.listDataSources();

    expect(orders.data).toHaveLength(1);
    expect(sources).toHaveLength(1);
  });

  it('should manage audit rules independently of orders', async () => {
    await service.createOrder(makeOrderInput(), 'user-1', 'tenant-1');
    await service.createAuditRule(makeAuditRuleInput(), 'tenant-1');

    const orders = await service.listOrders();
    const rules = await service.listAuditRules();

    expect(orders.data).toHaveLength(1);
    expect(rules).toHaveLength(1);
  });

  it('should support a complete DBA workflow', async () => {
    // 1. Set up audit rules
    const rule = await service.createAuditRule(
      makeAuditRuleInput({ name: 'Block DROP', pattern: 'DROP TABLE', severity: 'error' }),
      'tenant-1'
    );
    expect(rule.enabled).toBe(true);

    // 2. Register data source
    const ds = await service.createDataSource(
      makeDataSourceInput({ name: 'Production DB', type: 'postgresql', host: 'prod-db.example.com', port: 5432 })
    );
    expect(ds.status).toBe('offline');

    // 3. Test connection
    const connResult = await service.testConnection(ds.id);
    expect(connResult.success).toBe(true);

    // 4. Create SQL order
    const order = await service.createOrder(
      makeOrderInput({ database: 'production', sql: 'SELECT count(*) FROM orders', type: 'query' }),
      'dba-user',
      'tenant-1'
    );
    expect(order.status).toBe('pending');

    // 5. Approve order
    const approved = await service.approveOrder(order.id, 'senior-dba');
    expect(approved!.status).toBe('approved');

    // 6. Execute order
    const executed = await service.executeOrder(order.id);
    expect(executed!.status).toBe('completed');
    expect(executed!.result).toBeDefined();

    // 7. Verify final state
    const finalOrder = await service.getOrder(order.id);
    expect(finalOrder!.status).toBe('completed');
    expect(finalOrder!.approvedBy).toBe('senior-dba');
    expect(finalOrder!.result).toBe('Execution completed (mock)');
  });

  it('should handle multiple tenants independently', async () => {
    // Create orders for different tenants
    await service.createOrder(makeOrderInput({ sql: 'Tenant1 query' }), 'user-1', 'tenant-1');
    await service.createOrder(makeOrderInput({ sql: 'Tenant2 query' }), 'user-2', 'tenant-2');
    await service.createOrder(makeOrderInput({ sql: 'Tenant1 query 2' }), 'user-3', 'tenant-1');

    // Create audit rules for different tenants
    await service.createAuditRule(makeAuditRuleInput({ name: 'Rule T1' }), 'tenant-1');
    await service.createAuditRule(makeAuditRuleInput({ name: 'Rule T2' }), 'tenant-2');

    // Verify isolation
    const t1Orders = await service.listOrders({ tenantId: 'tenant-1' });
    const t2Orders = await service.listOrders({ tenantId: 'tenant-2' });
    const t1Rules = await service.listAuditRules('tenant-1');
    const t2Rules = await service.listAuditRules('tenant-2');

    expect(t1Orders.data).toHaveLength(2);
    expect(t2Orders.data).toHaveLength(1);
    expect(t1Rules).toHaveLength(1);
    expect(t2Rules).toHaveLength(1);
  });
});
