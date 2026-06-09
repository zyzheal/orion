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

describe('AlertSuppressionService', () => {
  let suppression: AlertSuppressionService;

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

  beforeEach(() => {
    suppression = new AlertSuppressionService();
    suppression.clearAll();

    // Set up topology for correlation analysis
    suppression.setTopology({
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
      suppression.addMaintenanceWindow({
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
      suppression.addMaintenanceWindow({
        name: 'Window',
        tenantId: 'tenant-001',
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        scope: {},
        createdBy: 'admin',
      });

      suppression.addKnownIssue({
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
      suppression.addMaintenanceWindow({
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
      });

      customSuppression.setTopology({
        nodes: [{ id: 'app-001', type: AlertSourceType.APPLICATION, name: 'App' }],
        edges: [],
      });

      customSuppression.addMaintenanceWindow({
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