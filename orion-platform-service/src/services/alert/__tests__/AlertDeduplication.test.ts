/**
 * AlertDeduplication 单元测试
 */

import { AlertDeduplication } from '../AlertDeduplication';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertSourceType,
} from '../AlertTypes';

/** Create a stateful in-memory mock DB for testing repositories */
function createMockDb() {
  const tables = new Map<string, Map<string, any>>();

  function getTable(name: string): Map<string, any> {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  const mockDb = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      const p = params || [];


      // INSERT INTO <table> (...) VALUES (...) RETURNING *
      if (text.match(/INSERT\s+INTO\s+(\w+)/i)) {
        const tableMatch = text.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const columns = tableMatch[2].split(',').map((c: string) => c.trim());
          const table = getTable(tableName);
          const row: any = {};
          columns.forEach((col: string, i: number) => {
            row[col] = p[i] !== undefined ? p[i] : null;
          });
          // Use first column (usually id) as key
          const key = row[columns[0]] || String(table.size);
          table.set(key, row);
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [{ id: 'mock' }], rowCount: 1 };
      }

      // SELECT ... FROM <table> WHERE id = $1 (findByFingerprint / findById)
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+id\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const row = table.get(p[0] as string);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
      }

      // SELECT COUNT(*) ... FROM <table>
      if (text.includes('COUNT(*)')) {
        const tableMatch = text.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          // Check for SUM(count) pattern
          if (text.includes('SUM(count)')) {
            let totalAlerts = 0;
            for (const row of table.values()) {
              totalAlerts += row.count || 0;
            }
            return { rows: [{ total_groups: String(table.size), total_alerts: String(totalAlerts) }], rowCount: 1 };
          }
          return { rows: [{ count: String(table.size) }], rowCount: 1 };
        }
      }

      // SELECT ... FROM <table> ... ORDER BY ... LIMIT ... (findActive / getTopFingerprints)
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+[\s\S]*ORDER\s+BY/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values());

          // Parse WHERE conditions if present
          const whereMatch = text.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER|\s*$)/i);
          if (whereMatch) {
            const conditions = whereMatch[1].split(/\s+AND\s+/i);
            for (const cond of conditions) {
              const condMatch = cond.match(/(\w+)\s*>=\s*\$(\d+)/i);
              if (condMatch) {
                const col = condMatch[1];
                const paramIdx = parseInt(condMatch[2]) - 1;
                const val = p[paramIdx];
                rows = rows.filter(r => r[col] >= val);
              }
            }
          }

          // Extract LIMIT
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            const limitIdx = parseInt(limitMatch[1]) - 1;
            rows = rows.slice(0, Number(p[limitIdx]) || rows.length);
          }

          return { rows, rowCount: rows.length };
        }
      }

      // SELECT id as fingerprint, count FROM <table>
      if (text.match(/SELECT\s+id\s+as\s+fingerprint/i)) {
        const tableMatch = text.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values()).map(r => ({ fingerprint: r.id, count: r.count }));
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            rows = rows.slice(0, Number(p[parseInt(limitMatch[1]) - 1]) || rows.length);
          }
          return { rows, rowCount: rows.length };
        }
      }

      // DELETE FROM <table>
      if (text.match(/DELETE\s+FROM\s+(\w+)/i)) {
        const tableMatch = text.match(/DELETE\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          // DELETE with WHERE
          const whereMatch = text.match(/WHERE\s+(.+)$/i);
          if (whereMatch && p.length > 0) {
            const condMatch = whereMatch[1].match(/(\w+)\s*<\s*\$(\d+)/i);
            if (condMatch) {
              const col = condMatch[1];
              const paramIdx = parseInt(condMatch[2]) - 1;
              const val = p[paramIdx];
              let deleted = 0;
              for (const [key, row] of table.entries()) {
                if (row[col] < val) {
                  table.delete(key);
                  deleted++;
                }
              }
              return { rows: [], rowCount: deleted };
            }
            // id = $1
            const idMatch = whereMatch[1].match(/id\s*=\s*\$1/i);
            if (idMatch) {
              const deleted = table.has(p[0] as string) ? 1 : 0;
              table.delete(p[0] as string);
              return { rows: [], rowCount: deleted };
            }
          }
          // DELETE without WHERE - clear all
          const count = table.size;
          table.clear();
          return { rows: [], rowCount: count };
        }
      }

      // UPDATE <table> SET ... WHERE id = $N
      if (text.match(/UPDATE\s+\w+\s+SET/i)) {
        const tableMatch = text.match(/UPDATE\s+(\w+)\s+SET/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const idIdx = p.length - 1;
          const id = p[idIdx] as string;
          const row = table.get(id);
          if (row) {
            // Parse SET clauses
            const setMatch = text.match(/SET\s+(.+?)\s+WHERE/i);
            if (setMatch) {
              const assignments = setMatch[1].split(',');
              for (const assignment of assignments) {
                const assignMatch = assignment.trim().match(/(\w+)\s*=\s*\$(\d+)/i);
                if (assignMatch) {
                  const col = assignMatch[1];
                  const paramIdx = parseInt(assignMatch[2]) - 1;
                  if (col !== 'updated_at') {
                    row[col] = p[paramIdx];
                  } else {
                    row[col] = new Date();
                  }
                }
              }
            }
            return { rows: [row], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
      }

      return { rows: [], rowCount: 0 };
    }),
  };

  return mockDb;
}

describe('AlertDeduplication', () => {
  let deduplication: AlertDeduplication;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    deduplication = new AlertDeduplication(mockDb as any);
    deduplication.clearAll();
  });

  afterEach(() => {
    deduplication.stop();
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same alert', () => {
      const alert: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high', region: 'us-east' },
      };

      const fingerprint1 = deduplication.generateFingerprint(alert);
      const fingerprint2 = deduplication.generateFingerprint(alert);

      expect(fingerprint1.fingerprint).toBe(fingerprint2.fingerprint);
      expect(fingerprint1.fingerprint.length).toBe(32);
    });

    it('should generate different fingerprints for different alerts', () => {
      const alert1: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high' },
      };

      const alert2: Partial<Alert> = {
        name: 'HighMemoryUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high' },
      };

      const fingerprint1 = deduplication.generateFingerprint(alert1);
      const fingerprint2 = deduplication.generateFingerprint(alert2);

      expect(fingerprint1.fingerprint).not.toBe(fingerprint2.fingerprint);
    });

    it('should generate same fingerprint regardless of label order', () => {
      const alert1: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high', region: 'us-east' },
      };

      const alert2: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { region: 'us-east', severity: 'high' }, // Different order
      };

      const fingerprint1 = deduplication.generateFingerprint(alert1);
      const fingerprint2 = deduplication.generateFingerprint(alert2);

      expect(fingerprint1.fingerprint).toBe(fingerprint2.fingerprint);
    });
  });

  describe('isDuplicate', () => {
    it('should detect duplicate alert within window', () => {
      const fingerprint = 'test-fingerprint-001';

      // Record fingerprint
      deduplication.recordFingerprint(fingerprint);

      // Should be duplicate
      expect(deduplication.isDuplicate(fingerprint)).toBe(true);
    });

    it('should not detect duplicate for new fingerprint', () => {
      const fingerprint = 'new-fingerprint-001';

      expect(deduplication.isDuplicate(fingerprint)).toBe(false);
    });
  });

  describe('processAlert', () => {
    const createAlert = (id: string, name: string, sourceId: string): Alert => ({
      id,
      fingerprint: '',
      name,
      severity: AlertSeverity.HIGH,
      status: AlertStatus.FIRING,
      sourceType: AlertSourceType.NODE,
      sourceId,
      sourceName: `Node ${sourceId}`,
      labels: { severity: 'high' },
      annotations: {},
      value: 80,
      threshold: 70,
      startsAt: new Date(),
      tenantId: 'tenant-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should create new group for first alert', async () => {
      const alert = createAlert('alert-001', 'HighCPU', 'node-001');

      const result = await deduplication.processAlert(alert);

      expect(result.action).toBe('create');
      expect(result.isDuplicate).toBe(false);
      expect(result.group.count).toBe(1);
      expect(result.group.alerts).toHaveLength(1);
    });

    it('should update group for subsequent alert with same fingerprint', async () => {
      const alert1 = createAlert('alert-001', 'HighCPU', 'node-001');
      const alert2 = createAlert('alert-002', 'HighCPU', 'node-001');

      // First alert
      await deduplication.processAlert(alert1);

      // Second alert (should be duplicate)
      const result = await deduplication.processAlert(alert2);

      expect(result.action).toBe('suppress');
      expect(result.isDuplicate).toBe(true);
      expect(result.group.count).toBe(2);
    });

    it('should create separate groups for different fingerprints', async () => {
      const alert1 = createAlert('alert-001', 'HighCPU', 'node-001');
      const alert2 = createAlert('alert-002', 'HighMemory', 'node-001');

      const result1 = await deduplication.processAlert(alert1);
      const result2 = await deduplication.processAlert(alert2);

      expect(result1.group.fingerprint).not.toBe(result2.group.fingerprint);
      expect(result1.group.count).toBe(1);
      expect(result2.group.count).toBe(1);
    });
  });

  describe('batchProcess', () => {
    it('should correctly count duplicates and new alerts', async () => {
      const alerts: Alert[] = [
        {
          id: 'alert-001',
          fingerprint: '',
          name: 'HighCPU',
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001',
          sourceName: 'Node 001',
          labels: { severity: 'high' },
          annotations: {},
          value: 80,
          threshold: 70,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'alert-002',
          fingerprint: '',
          name: 'HighCPU', // Same name
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001', // Same source
          labels: { severity: 'high' }, // Same labels
          annotations: {},
          value: 85,
          threshold: 70,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'alert-003',
          fingerprint: '',
          name: 'HighMemory', // Different name
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001',
          labels: { severity: 'high' },
          annotations: {},
          value: 90,
          threshold: 80,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = await deduplication.batchProcess(alerts);

      expect(result.newAlerts).toBe(2); // HighCPU (first) and HighMemory
      expect(result.duplicates).toBe(1); // HighCPU (second)
      expect(result.suppressed).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const alert: Alert = {
        id: 'alert-001',
        fingerprint: '',
        name: 'HighCPU',
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        sourceName: 'Node 001',
        labels: {},
        annotations: {},
        value: 80,
        threshold: 70,
        startsAt: new Date(),
        tenantId: 'tenant-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await deduplication.processAlert(alert);

      const stats = await deduplication.getStats();

      expect(stats.totalGroups).toBe(1);
      expect(stats.totalAlerts).toBe(1);
      expect(stats.topFingerprints).toHaveLength(1);
    });
  });

  describe('getActiveGroups', () => {
    it('should filter groups by minCount', async () => {
      // Create multiple alerts with same fingerprint
      for (let i = 0; i < 3; i++) {
        await deduplication.processAlert({
          id: `alert-${i}`,
          fingerprint: '',
          name: 'HighCPU',
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001',
          sourceName: 'Node 001',
          labels: {},
          annotations: {},
          value: 80,
          threshold: 70,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Create single alert with different fingerprint
      await deduplication.processAlert({
        id: 'alert-single',
        fingerprint: '',
        name: 'HighMemory',
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        sourceName: 'Node 001',
        labels: {},
        annotations: {},
        value: 90,
        threshold: 80,
        startsAt: new Date(),
        tenantId: 'tenant-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const groups = await deduplication.getActiveGroups({ minCount: 2 });

      expect(groups).toHaveLength(1);
      expect(groups[0].count).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should remove expired fingerprints', async () => {
      // Create deduplication with short window for testing
      const shortDedup = new AlertDeduplication(mockDb as any, {
        deduplicationWindowMs: 100, // 100ms window
      });

      shortDedup.recordFingerprint('test-fp');

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not be duplicate anymore
      expect(shortDedup.isDuplicate('test-fp')).toBe(false);

      shortDedup.stop();
    });
  });
});
