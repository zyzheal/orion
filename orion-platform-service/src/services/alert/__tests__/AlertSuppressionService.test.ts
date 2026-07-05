/**
 * AlertSuppressionService 单元测试
 */

import { AlertSuppressionService } from '../AlertSuppressionService';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertSourceType,
  SuppressionRuleType,
  MaintenanceWindow,
  KnownIssue,
} from '../AlertTypes';

/** Create a stateful in-memory mock DB for testing repositories */
function createMockDb() {
  const tables = new Map<string, Map<string, any>>();

  function getTable(name: string): Map<string, any> {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  const mock = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      const p = params || [];

      // INSERT INTO <table> (...) VALUES (...)
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
          const key = row.id || row[columns[0]] || String(table.size);
          if (!row.id) row.id = key;
          table.set(key, row);
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [{ id: 'mock' }], rowCount: 1 };
      }

      // SELECT ... FROM <table> WHERE id = $1
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+id\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const row = table.get(p[0] as string);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
      }

      // SELECT ... FROM <table> WHERE resolved = false
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+resolved\s*=\s*false/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const rows = Array.from(table.values()).filter(r => r.resolved === false);
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT ... FROM <table> WHERE source_type = $1 AND status = 'firing' [AND severity = $2] ORDER BY ...
      if (text.match(/WHERE\s+source_type\s*=\s*\$1\s+AND\s+status\s*=\s*'firing'/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values()).filter(
            r => r.source_type === p[0] && r.status === 'firing'
          );
          // Check for severity filter — use ordering (>= threshold) like isSeverityAtLeast
          const sevMatch = text.match(/AND\s+severity\s*=\s*\$(\d+)/i);
          if (sevMatch) {
            const sevIdx = parseInt(sevMatch[1]) - 1;
            const threshold = p[sevIdx] as string;
            const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
            const thresholdPriority = sevOrder[threshold] ?? 99;
            rows = rows.filter(r => (sevOrder[r.severity] ?? 99) <= thresholdPriority);
          }
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT ... FROM <table> WHERE start_time <= $1 AND end_time >= $1
      if (text.match(/WHERE\s+start_time\s*<=\s*\$1\s+AND\s+end_time\s*>=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const now = p[0] as Date;
          const rows = Array.from(table.values()).filter(r => r.start_time <= now && r.end_time >= now);
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT ... FROM <table> WHERE tenant_id = $1
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+tenant_id\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values()).filter(r => r.tenant_id === p[0]);
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            rows = rows.slice(0, Number(p[parseInt(limitMatch[1]) - 1]) || rows.length);
          }
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT ... FROM <table> WHERE rule_type = $1
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+rule_type\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values()).filter(r => r.rule_type === p[0]);
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            rows = rows.slice(0, Number(p[parseInt(limitMatch[1]) - 1]) || rows.length);
          }
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT COUNT(*) ... FROM <table>
      if (text.includes('COUNT(*)')) {
        const tableMatch = text.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          if (text.includes('SUM(count)')) {
            let totalAlerts = 0;
            for (const row of table.values()) totalAlerts += row.count || 0;
            return { rows: [{ total_groups: String(table.size), total_alerts: String(totalAlerts) }], rowCount: 1 };
          }
          // COUNT(*) FILTER (WHERE status = 'firing')
          if (text.includes('FILTER')) {
            const rows = Array.from(table.values());
            const total = rows.length;
            const firing = rows.filter(r => r.status === 'firing').length;
            const resolved = rows.filter(r => r.status === 'resolved').length;
            return { rows: [{ total: String(total), firing: String(firing), resolved: String(resolved) }], rowCount: 1 };
          }
          return { rows: [{ count: String(table.size) }], rowCount: 1 };
        }
      }

      // SELECT ... FROM <table> ... ORDER BY ... LIMIT
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+.*ORDER\s+BY/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values());
          const whereMatch = text.match(/WHERE\s+(.+?)(?:\s+ORDER|\s*$)/i);
          if (whereMatch) {
            const conditions = whereMatch[1].split(/\s+AND\s+/i);
            for (const cond of conditions) {
              const condMatch = cond.match(/(\w+)\s*>=\s*\$(\d+)/i);
              if (condMatch) {
                const col = condMatch[1];
                const paramIdx = parseInt(condMatch[2]) - 1;
                rows = rows.filter(r => r[col] >= p[paramIdx]);
              }
            }
          }
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            rows = rows.slice(0, Number(p[parseInt(limitMatch[1]) - 1]) || rows.length);
          }
          return { rows, rowCount: rows.length };
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
            const setMatch = text.match(/SET\s+(.+?)\s+WHERE/i);
            if (setMatch) {
              const assignments = setMatch[1].split(',');
              for (const assignment of assignments) {
                const assignMatch = assignment.trim().match(/(\w+)\s*=\s*\$(\d+)/i);
                if (assignMatch) {
                  const col = assignMatch[1];
                  const paramIdx = parseInt(assignMatch[2]) - 1;
                  row[col] = col === 'updated_at' ? new Date() : p[paramIdx];
                }
                // Handle SET col = 'literal' pattern
                const literalMatch = assignment.trim().match(/(\w+)\s*=\s*'([^']+)'/i);
                if (literalMatch) {
                  row[literalMatch[1]] = literalMatch[2];
                }
                // Handle SET col = true/false pattern
                const boolMatch = assignment.trim().match(/(\w+)\s*=\s*(true|false)/i);
                if (boolMatch) {
                  row[boolMatch[1]] = boolMatch[2].toLowerCase() === 'true';
                }
                // Handle SET resolved_at = NOW()
                if (assignment.includes('NOW()')) {
                  const colMatch = assignment.trim().match(/(\w+)\s*=\s*NOW\(\)/i);
                  if (colMatch) row[colMatch[1]] = new Date();
                }
              }
            }
            return { rows: [row], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
      }

      // DELETE FROM <table>
      if (text.match(/DELETE\s+FROM\s+(\w+)/i)) {
        const tableMatch = text.match(/DELETE\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const whereMatch = text.match(/WHERE\s+(.+)$/i);
          if (whereMatch && p.length > 0) {
            // WHERE id = $1
            if (whereMatch[1].match(/id\s*=\s*\$1/i)) {
              const deleted = table.has(p[0] as string) ? 1 : 0;
              table.delete(p[0] as string);
              return { rows: [], rowCount: deleted };
            }
            // WHERE end_time < $1
            const timeMatch = whereMatch[1].match(/(\w+)\s*<\s*\$(\d+)/i);
            if (timeMatch) {
              const col = timeMatch[1];
              const paramIdx = parseInt(timeMatch[2]) - 1;
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
            // WHERE status = 'resolved' AND resolved_at < $1
            if (whereMatch[1].includes("status = 'resolved'")) {
              const timeMatch2 = whereMatch[1].match(/resolved_at\s*<\s*\$(\d+)/i);
              if (timeMatch2) {
                const paramIdx = parseInt(timeMatch2[1]) - 1;
                const val = p[paramIdx];
                let deleted = 0;
                for (const [key, row] of table.entries()) {
                  if (row.status === 'resolved' && row.resolved_at < val) {
                    table.delete(key);
                    deleted++;
                  }
                }
                return { rows: [], rowCount: deleted };
              }
            }
          }
          const count = table.size;
          table.clear();
          return { rows: [], rowCount: count };
        }
      }

      return { rows: [], rowCount: 0 };
    }),
  };
  return mock;
}

describe('AlertSuppressionService', () => {
  let suppression: AlertSuppressionService;
  let mockDb: ReturnType<typeof createMockDb>;

  const createAlert = (
    id: string,
    sourceId: string,
    sourceType: AlertSourceType,
    severity: AlertSeverity = AlertSeverity.HIGH,
    labels: Record<string, string> = {}
  ): Alert => ({
    id,
    fingerprint: `fp-${id}`,
    name: `Alert-${id}`,
    severity,
    status: AlertStatus.FIRING,
    sourceType,
    sourceId,
    sourceName: sourceId,
    labels,
    annotations: {},
    value: 80,
    threshold: 70,
    startsAt: new Date(),
    tenantId: 'tenant-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    mockDb = createMockDb();
    suppression = new AlertSuppressionService(undefined, undefined, undefined, mockDb as any);
    await suppression.clearAll();

    // Set up topology for correlation analysis
    await suppression.setTopology({
      nodes: [
        { id: 'node-001', type: AlertSourceType.NODE, name: 'Server-1' },
        { id: 'node-002', type: AlertSourceType.NODE, name: 'Server-2' },
        { id: 'db-001', type: AlertSourceType.DATABASE, name: 'MySQL-Master', parentId: 'node-001' },
        { id: 'network-001', type: AlertSourceType.NETWORK, name: 'Core-Switch' },
        { id: 'app-001', type: AlertSourceType.APPLICATION, name: 'API-Service', parentId: 'node-001' },
        { id: 'app-002', type: AlertSourceType.APPLICATION, name: 'Web-Service', parentId: 'node-002' },
        { id: 'service-001', type: AlertSourceType.SERVICE, name: 'Payment-Service' },
      ],
      edges: [
        { source: 'app-001', target: 'db-001', relationType: 'depends_on' },
        { source: 'app-002', target: 'db-001', relationType: 'depends_on' },
        { source: 'app-001', target: 'network-001', relationType: 'connected_to' },
        { source: 'app-002', target: 'network-001', relationType: 'connected_to' },
        { source: 'app-001', target: 'node-001', relationType: 'runs_on' },
        { source: 'app-002', target: 'node-002', relationType: 'runs_on' },
        { source: 'service-001', target: 'app-001', relationType: 'depends_on' },
        { source: 'node-001', target: 'network-001', relationType: 'connected_to' },
        { source: 'node-002', target: 'network-001', relationType: 'connected_to' },
      ],
    });
  });

  afterEach(() => {
    suppression.stop();
  });

  describe('Suppression Rule 1: Maintenance Window', () => {
    it('should suppress alerts during maintenance window', async () => {
      // Add maintenance window covering app-001
      const window = await suppression.addMaintenanceWindow({
        name: 'Scheduled Maintenance',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 60 * 60 * 1000), // Started 1 hour ago
        endTime: new Date(Date.now() + 60 * 60 * 1000), // Ends in 1 hour
        scope: {
          sourceIds: ['app-001'],
        },
        createdBy: 'admin',
      });

      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);

      const result = await suppression.processAlert(alert);

      expect(result.suppressed).toBe(true);
      expect(result.ruleType).toBe(SuppressionRuleType.MAINTENANCE_WINDOW);
      expect(result.maintenanceWindowId).toBe(window.id);
    });

    it('should not suppress alerts outside maintenance window', async () => {
      // Add maintenance window that has ended
      await suppression.addMaintenanceWindow({
        name: 'Past Maintenance',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // Started 3 hours ago
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // Ended 1 hour ago
        scope: {
          sourceIds: ['app-001'],
        },
        createdBy: 'admin',
      });

      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);

      const result = await suppression.processAlert(alert);

      expect(result.suppressed).toBe(false);
    });

    it('should filter by source types in maintenance window', async () => {
      await suppression.addMaintenanceWindow({
        name: 'DB Maintenance',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: {
          sourceTypes: [AlertSourceType.DATABASE],
        },
        createdBy: 'admin',
      });

      const dbAlert = createAlert('alert-db', 'db-001', AlertSourceType.DATABASE);
      const appAlert = createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION);

      const dbResult = await suppression.processAlert(dbAlert);
      const appResult = await suppression.processAlert(appAlert);

      expect(dbResult.suppressed).toBe(true);
      expect(appResult.suppressed).toBe(false);
    });

    it('should filter by labels in maintenance window', async () => {
      await suppression.addMaintenanceWindow({
        name: 'Production Maintenance',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: {
          labelSelectors: { environment: 'production' },
        },
        createdBy: 'admin',
      });

      const prodAlert = createAlert('alert-prod', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH, { environment: 'production' });
      const devAlert = createAlert('alert-dev', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH, { environment: 'development' });

      const prodResult = await suppression.processAlert(prodAlert);
      const devResult = await suppression.processAlert(devAlert);

      expect(prodResult.suppressed).toBe(true);
      expect(devResult.suppressed).toBe(false);
    });
  });

  describe('Suppression Rule 2: Known Issue', () => {
    it('should suppress alerts matching known issue', async () => {
      await suppression.addKnownIssue({
        title: 'Known Database Connection Issue',
        description: 'Temporary connection issue',
        tenantId: 'tenant-001',
        labelSelectors: { issue: 'db-connection' },
        silenceDuration: 60 * 60 * 1000, // 1 hour
        status: 'open',
        createdBy: 'admin',
      });

      const alert = createAlert('alert-001', 'db-001', AlertSourceType.DATABASE, AlertSeverity.HIGH, { issue: 'db-connection' });

      const result = await suppression.processAlert(alert);

      expect(result.suppressed).toBe(true);
      expect(result.ruleType).toBe(SuppressionRuleType.KNOWN_ISSUE);
      expect(result.silencedUntil).toBeDefined();
    });

    it('should not suppress alerts when issue is resolved', async () => {
      const issue = await suppression.addKnownIssue({
        title: 'Resolved Issue',
        tenantId: 'tenant-001',
        labelSelectors: { issue: 'resolved' },
        silenceDuration: 60 * 60 * 1000,
        status: 'open',
        createdBy: 'admin',
      });

      // Resolve the issue
      await suppression.resolveKnownIssue(issue.id);

      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH, { issue: 'resolved' });

      const result = await suppression.processAlert(alert);

      expect(result.suppressed).toBe(false);
    });
  });

  describe('Suppression Rule 3: Duplication', () => {
    it('should suppress duplicate alerts', async () => {
      // Same name, same source, same labels = duplicate
      const alert1 = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);
      const alert2 = createAlert('alert-002', 'app-001', AlertSourceType.APPLICATION);

      // Note: createAlert generates name based on id, so we need to set same name for duplicates
      alert1.name = 'HighCPU';
      alert2.name = 'HighCPU';

      // First alert - not duplicate
      const result1 = await suppression.processAlert(alert1);
      expect(result1.suppressed).toBe(false);

      // Second alert - duplicate (same name, same source, same labels)
      const result2 = await suppression.processAlert(alert2);
      expect(result2.suppressed).toBe(true);
      expect(result2.ruleType).toBe(SuppressionRuleType.DUPLICATION);
    });

    it('should not suppress alerts from different sources', async () => {
      const alert1 = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);
      const alert2 = createAlert('alert-002', 'app-002', AlertSourceType.APPLICATION);

      const result1 = await suppression.processAlert(alert1);
      const result2 = await suppression.processAlert(alert2);

      expect(result1.suppressed).toBe(false);
      expect(result2.suppressed).toBe(false);
    });
  });

  describe('Suppression Rule 4: Root Cause (Cascade)', () => {
    it('should suppress downstream alerts when root cause exists', async () => {
      // Create database alert (root cause)
      const dbAlert = createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.CRITICAL);

      // Create application alerts (cascade failures)
      const appAlert1 = createAlert('alert-app1', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH);
      const appAlert2 = createAlert('alert-app2', 'app-002', AlertSourceType.APPLICATION, AlertSeverity.HIGH);

      // Batch process with root cause analysis
      const result = await suppression.batchProcess([dbAlert, appAlert1, appAlert2]);

      expect(result.rootCauseAnalysis).toBeDefined();
      expect(result.rootCauseAnalysis!.rootCauseAlertId).toBe('alert-db');
      expect(result.suppressed).toBeGreaterThan(0); // Some alerts should be suppressed
    });
  });

  describe('Suppression Rule 5: Node Failure', () => {
    it('should suppress alerts from services on failed node', async () => {
      // Create node failure alert first
      const nodeAlert = createAlert('alert-node', 'node-001', AlertSourceType.NODE, AlertSeverity.CRITICAL);
      await suppression.processAlert(nodeAlert);

      // Create application alert on same node
      const appAlert = createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH);

      const result = await suppression.processAlert(appAlert);

      // app-001 runs on node-001, should be suppressed
      expect(result.suppressed).toBe(true);
      expect(result.ruleType).toBe(SuppressionRuleType.NODE_FAILURE);
    });

    it('should not suppress node alerts themselves', async () => {
      const nodeAlert = createAlert('alert-node', 'node-001', AlertSourceType.NODE, AlertSeverity.CRITICAL);

      const result = await suppression.processAlert(nodeAlert);

      expect(result.suppressed).toBe(false);
    });
  });

  describe('Suppression Rule 6: Database Failure', () => {
    it('should suppress application alerts when database fails', async () => {
      // Create database failure alert first
      const dbAlert = createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.CRITICAL);
      await suppression.processAlert(dbAlert);

      // Create application alert that depends on database
      const appAlert = createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH);

      const result = await suppression.processAlert(appAlert);

      // app-001 depends on db-001, should be suppressed
      expect(result.suppressed).toBe(true);
      expect(result.ruleType).toBe(SuppressionRuleType.DATABASE_FAILURE);
    });

    it('should not suppress database alerts themselves', async () => {
      const dbAlert = createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.CRITICAL);

      const result = await suppression.processAlert(dbAlert);

      expect(result.suppressed).toBe(false);
    });
  });

  describe('Suppression Rule 7: Network Failure', () => {
    it('should suppress downstream alerts when network fails', async () => {
      // Create network failure alert first
      const networkAlert = createAlert('alert-network', 'network-001', AlertSourceType.NETWORK, AlertSeverity.CRITICAL);
      await suppression.processAlert(networkAlert);

      // Create application alert that depends on network
      const appAlert = createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH);

      const result = await suppression.processAlert(appAlert);

      // app-001 connected to network-001, should be suppressed
      expect(result.suppressed).toBe(true);
      expect(result.ruleType).toBe(SuppressionRuleType.NETWORK_FAILURE);
    });
  });

  describe('batchProcess', () => {
    it('should process multiple alerts with root cause analysis', async () => {
      const alerts: Alert[] = [
        createAlert('alert-node', 'node-001', AlertSourceType.NODE, AlertSeverity.CRITICAL),
        createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.HIGH),
        createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
        createAlert('alert-service', 'service-001', AlertSourceType.SERVICE, AlertSeverity.MEDIUM),
      ];

      const result = await suppression.batchProcess(alerts);

      expect(result.processed).toBe(4);
      expect(result.rootCauseAnalysis).toBeDefined();
      expect(result.rootCauseAnalysis!.rootCauseAlertId).toBe('alert-node'); // Node is highest priority
    });

    it('should return results for each alert', async () => {
      const alerts: Alert[] = [
        createAlert('alert-1', 'app-001', AlertSourceType.APPLICATION),
        createAlert('alert-2', 'app-002', AlertSourceType.APPLICATION),
      ];

      const result = await suppression.batchProcess(alerts);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].alertId).toBe('alert-1');
      expect(result.results[1].alertId).toBe('alert-2');
    });
  });

  describe('Management APIs', () => {
    it('should add and remove maintenance windows', async () => {
      const window = await suppression.addMaintenanceWindow({
        name: 'Test Window',
        tenantId: 'tenant-001',
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: {},
        createdBy: 'admin',
      });

      expect(window.id).toBeDefined();

      const activeWindows = await suppression.getActiveMaintenanceWindows();
      expect(activeWindows).toHaveLength(1);

      const removed = await suppression.removeMaintenanceWindow(window.id);
      expect(removed).toBe(true);

      const remainingWindows = await suppression.getActiveMaintenanceWindows();
      expect(remainingWindows).toHaveLength(0);
    });

    it('should add and resolve known issues', async () => {
      const issue = await suppression.addKnownIssue({
        title: 'Test Issue',
        tenantId: 'tenant-001',
        silenceDuration: 60 * 60 * 1000,
        status: 'open',
        createdBy: 'admin',
      });

      expect(issue.id).toBeDefined();

      const openIssues = await suppression.getOpenKnownIssues();
      expect(openIssues).toHaveLength(1);

      const resolved = await suppression.resolveKnownIssue(issue.id);
      expect(resolved).toBe(true);

      const remainingIssues = await suppression.getOpenKnownIssues();
      expect(remainingIssues).toHaveLength(0);
    });

    it('should track suppression log', async () => {
      await suppression.addMaintenanceWindow({
        name: 'Test Window',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: { sourceIds: ['app-001'] },
        createdBy: 'admin',
      });

      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);
      await suppression.processAlert(alert);

      const log = await suppression.getSuppressionLog();

      expect(log).toHaveLength(1);
      expect(log[0].alertId).toBe('alert-001');
      expect(log[0].ruleType).toBe(SuppressionRuleType.MAINTENANCE_WINDOW);
    });

    it('should return correct stats', async () => {
      // Add some data
      await suppression.addMaintenanceWindow({
        name: 'Window',
        tenantId: 'tenant-001',
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: {},
        createdBy: 'admin',
      });

      await suppression.addKnownIssue({
        title: 'Issue',
        tenantId: 'tenant-001',
        silenceDuration: 60 * 60 * 1000,
        status: 'open',
        createdBy: 'admin',
      });

      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);
      await suppression.processAlert(alert);

      const stats = await suppression.getStats();

      expect(stats.activeAlerts).toBe(1);
      expect(stats.maintenanceWindows).toBe(1);
      expect(stats.knownIssues).toBe(1);
    });
  });

  describe('clearAlert', () => {
    it('should clear resolved alerts', async () => {
      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);
      await suppression.processAlert(alert);

      expect((await suppression.getStats()).activeAlerts).toBe(1);

      const cleared = await suppression.clearAlert('alert-001');
      expect(cleared).toBe(true);

      expect((await suppression.getStats()).activeAlerts).toBe(0);
    });
  });

  describe('Priority of suppression rules', () => {
    it('should apply maintenance window before other rules', async () => {
      // Add maintenance window
      await suppression.addMaintenanceWindow({
        name: 'Window',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: { sourceIds: ['app-001'] },
        createdBy: 'admin',
      });

      // Create database alert that would normally suppress app alerts
      const dbAlert = createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.CRITICAL);
      await suppression.processAlert(dbAlert);

      // Create app alert - should be suppressed by maintenance window, not database
      const appAlert = createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH);

      const result = await suppression.processAlert(appAlert);

      expect(result.ruleType).toBe(SuppressionRuleType.MAINTENANCE_WINDOW);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled configuration', async () => {
      const customSuppression = new AlertSuppressionService(undefined, undefined, {
        maintenanceWindowCheckEnabled: false,
      }, mockDb as any);

      customSuppression.setTopology({
        nodes: [{ id: 'app-001', type: AlertSourceType.APPLICATION, name: 'App' }],
        edges: [],
      });

      await customSuppression.addMaintenanceWindow({
        name: 'Window',
        tenantId: 'tenant-001',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: { sourceIds: ['app-001'] },
        createdBy: 'admin',
      });

      const alert = createAlert('alert-001', 'app-001', AlertSourceType.APPLICATION);

      const result = await customSuppression.processAlert(alert);

      // Maintenance window check disabled, should not suppress
      expect(result.suppressed).toBe(false);

      customSuppression.stop();
    });
  });
});
