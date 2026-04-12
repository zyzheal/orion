/**
 * AlertCorrelationService 单元测试
 */

import { AlertCorrelationService } from '../AlertCorrelationService';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertSourceType,
  AlertTopologyGraph,
} from '../AlertTypes';

describe('AlertCorrelationService', () => {
  let correlation: AlertCorrelationService;

  const createTopology = (): AlertTopologyGraph => ({
    nodes: [
      { id: 'node-001', type: AlertSourceType.NODE, name: 'Server-1', status: 'healthy' },
      { id: 'node-002', type: AlertSourceType.NODE, name: 'Server-2', status: 'healthy' },
      { id: 'db-001', type: AlertSourceType.DATABASE, name: 'MySQL-Master', status: 'healthy', parentId: 'node-001' },
      { id: 'network-001', type: AlertSourceType.NETWORK, name: 'Core-Switch', status: 'healthy' },
      { id: 'app-001', type: AlertSourceType.APPLICATION, name: 'API-Service', status: 'healthy', parentId: 'node-001' },
      { id: 'app-002', type: AlertSourceType.APPLICATION, name: 'Web-Service', status: 'healthy', parentId: 'node-002' },
      { id: 'service-001', type: AlertSourceType.SERVICE, name: 'Payment-Service', status: 'healthy' },
    ],
    edges: [
      { source: 'app-001', target: 'db-001', relationType: 'depends_on' },
      { source: 'app-002', target: 'db-001', relationType: 'depends_on' },
      { source: 'app-001', target: 'network-001', relationType: 'connected_to' },
      { source: 'app-002', target: 'network-001', relationType: 'connected_to' },
      { source: 'service-001', target: 'app-001', relationType: 'depends_on' },
      { source: 'node-001', target: 'network-001', relationType: 'connected_to' },
      { source: 'node-002', target: 'network-001', relationType: 'connected_to' },
    ],
  });

  const createAlert = (
    id: string,
    sourceId: string,
    sourceType: AlertSourceType,
    severity: AlertSeverity = AlertSeverity.HIGH
  ): Alert => ({
    id,
    fingerprint: `fp-${id}`,
    name: `Alert-${id}`,
    severity,
    status: AlertStatus.FIRING,
    sourceType,
    sourceId,
    sourceName: sourceId,
    labels: {},
    annotations: {},
    value: 80,
    threshold: 70,
    startsAt: new Date(),
    tenantId: 'tenant-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    correlation = new AlertCorrelationService();
    correlation.setTopology(createTopology());
  });

  describe('setTopology', () => {
    it('should set topology correctly', () => {
      const topology = createTopology();
      correlation.setTopology(topology);

      const result = correlation.getTopology();

      expect(result.nodes).toHaveLength(7);
      expect(result.edges).toHaveLength(7);
    });
  });

  describe('getDependencies', () => {
    it('should return correct dependencies for application', () => {
      // app-001 depends on db-001 and network-001 (app -> db means app depends on db)
      const deps = correlation.getDependencies('app-001');

      expect(deps).toContain('db-001');
      expect(deps).toContain('network-001');
      expect(deps).toContain('node-001'); // Parent
    });

    it('should return dependencies for node connected to network', () => {
      // node-001 depends on network-001 (connected_to edge)
      const deps = correlation.getDependencies('node-001');

      expect(deps).toContain('network-001');
    });
  });

  describe('getImpactScope', () => {
    it('should return correct downstream nodes for database', () => {
      // db-001 affects app-001 and app-002
      const impact = correlation.getImpactScope('db-001');

      expect(impact).toContain('app-001');
      expect(impact).toContain('app-002');
    });

    it('should return recursive impact scope', () => {
      // network-001 affects nodes and apps
      const impact = correlation.getImpactScope('network-001');

      expect(impact).toContain('node-001');
      expect(impact).toContain('node-002');
      expect(impact).toContain('app-001');
      expect(impact).toContain('app-002');
    });
  });

  describe('analyzeRootCause', () => {
    it('should identify database as root cause for application alerts', () => {
      const alerts: Alert[] = [
        createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.CRITICAL),
        createAlert('alert-app1', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
        createAlert('alert-app2', 'app-002', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
      ];

      const result = correlation.analyzeRootCause(alerts);

      expect(result).toBeDefined();
      expect(result!.rootCauseAlertId).toBe('alert-db');
      expect(result!.affectedAlertIds).toContain('alert-app1');
      expect(result!.affectedAlertIds).toContain('alert-app2');
      expect(result!.confidence).toBeGreaterThan(0.5);
    });

    it('should identify network as root cause for node and app alerts', () => {
      const alerts: Alert[] = [
        createAlert('alert-network', 'network-001', AlertSourceType.NETWORK, AlertSeverity.CRITICAL),
        createAlert('alert-node1', 'node-001', AlertSourceType.NODE, AlertSeverity.HIGH),
        createAlert('alert-node2', 'node-002', AlertSourceType.NODE, AlertSeverity.HIGH),
        createAlert('alert-app1', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.MEDIUM),
      ];

      const result = correlation.analyzeRootCause(alerts);

      expect(result).toBeDefined();
      expect(result!.rootCauseAlertId).toBe('alert-network');
      expect(result!.affectedAlertIds.length).toBeGreaterThan(0);
    });

    it('should identify node as root cause for service alerts', () => {
      const alerts: Alert[] = [
        createAlert('alert-node', 'node-001', AlertSourceType.NODE, AlertSeverity.CRITICAL),
        createAlert('alert-db', 'db-001', AlertSourceType.DATABASE, AlertSeverity.HIGH),
        createAlert('alert-app', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
      ];

      const result = correlation.analyzeRootCause(alerts);

      expect(result).toBeDefined();
      // Node should be root cause (highest priority infrastructure)
      expect(result!.topologyPath[0]).toBe('node-001');
    });

    it('should return null for empty alerts', () => {
      const result = correlation.analyzeRootCause([]);

      expect(result).toBeNull();
    });

    it('should return single alert as root cause for single alert', () => {
      const alerts: Alert[] = [
        createAlert('alert-single', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
      ];

      const result = correlation.analyzeRootCause(alerts);

      expect(result).toBeDefined();
      expect(result!.rootCauseAlertId).toBe('alert-single');
      expect(result!.affectedAlertIds).toHaveLength(0);
    });
  });

  describe('detectCorrelation', () => {
    it('should detect same source correlation', () => {
      const alert1 = createAlert('alert-1', 'app-001', AlertSourceType.APPLICATION);
      const alert2 = createAlert('alert-2', 'app-001', AlertSourceType.APPLICATION);

      const result = correlation.detectCorrelation(alert1, alert2);

      expect(result.correlated).toBe(true);
      expect(result.correlationType).toBe('same_source');
      expect(result.confidence).toBe(0.9);
    });

    it('should detect dependency correlation', () => {
      const alert1 = createAlert('alert-1', 'db-001', AlertSourceType.DATABASE);
      const alert2 = createAlert('alert-2', 'app-001', AlertSourceType.APPLICATION);

      // app-001 depends on db-001
      const result = correlation.detectCorrelation(alert2, alert1);

      expect(result.correlated).toBe(true);
      expect(result.correlationType).toBe('dependency');
    });

    it('should detect common dependency correlation', () => {
      const alert1 = createAlert('alert-1', 'app-001', AlertSourceType.APPLICATION);
      const alert2 = createAlert('alert-2', 'app-002', AlertSourceType.APPLICATION);

      // Both apps depend on db-001
      const result = correlation.detectCorrelation(alert1, alert2);

      expect(result.correlated).toBe(true);
      expect(result.correlationType).toBe('common_dependency');
    });

    it('should detect temporal correlation', () => {
      // Create topology without common dependencies
      correlation.setTopology({
        nodes: [
          { id: 'node-001', type: AlertSourceType.NODE, name: 'Server-1', status: 'healthy' },
          { id: 'node-002', type: AlertSourceType.NODE, name: 'Server-2', status: 'healthy' },
        ],
        edges: [],
      });

      const now = new Date();
      const alert1: Alert = {
        id: 'alert-1',
        fingerprint: 'fp-1',
        name: 'Alert-1',
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        sourceName: 'node-001',
        labels: {},
        annotations: {},
        value: 80,
        threshold: 70,
        startsAt: now,
        tenantId: 'tenant-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alert2: Alert = {
        ...alert1,
        id: 'alert-2',
        sourceId: 'node-002',
        sourceName: 'node-002',
        startsAt: new Date(now.getTime() + 2 * 60 * 1000), // 2 minutes later
      };

      const result = correlation.detectCorrelation(alert1, alert2);

      expect(result.correlated).toBe(true);
      expect(result.correlationType).toBe('temporal');
    });

    it('should return no correlation for unrelated alerts', () => {
      // Create topology without relations
      correlation.setTopology({
        nodes: [
          { id: 'node-001', type: AlertSourceType.NODE, name: 'Server-1', status: 'healthy' },
          { id: 'node-002', type: AlertSourceType.NODE, name: 'Server-2', status: 'healthy' },
        ],
        edges: [],
      });

      const now = new Date();
      const alert1: Alert = {
        id: 'alert-1',
        fingerprint: 'fp-1',
        name: 'Alert-1',
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        sourceName: 'node-001',
        labels: {},
        annotations: {},
        value: 80,
        threshold: 70,
        startsAt: now,
        tenantId: 'tenant-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alert2: Alert = {
        ...alert1,
        id: 'alert-2',
        sourceId: 'node-002',
        sourceName: 'node-002',
        startsAt: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes later (outside temporal window)
      };

      const result = correlation.detectCorrelation(alert1, alert2);

      expect(result.correlated).toBe(false);
      expect(result.correlationType).toBe('none');
    });
  });

  describe('analyzeCorrelations', () => {
    it('should analyze all alerts and return correlation results', () => {
      const alerts: Alert[] = [
        createAlert('alert-db', 'db-001', AlertSourceType.DATABASE),
        createAlert('alert-app1', 'app-001', AlertSourceType.APPLICATION),
        createAlert('alert-app2', 'app-002', AlertSourceType.APPLICATION),
      ];

      const results = correlation.analyzeCorrelations(alerts);

      expect(results).toHaveLength(3);

      // app-001 should be correlated with db-001
      const app1Result = results.find((r) => r.alertId === 'alert-app1');
      expect(app1Result!.correlatedAlertIds).toContain('alert-db');

      // app-002 should be correlated with db-001
      const app2Result = results.find((r) => r.alertId === 'alert-app2');
      expect(app2Result!.correlatedAlertIds).toContain('alert-db');
    });
  });

  describe('updateNodeHealth', () => {
    it('should update node health based on alerts', () => {
      const alerts: Alert[] = [
        createAlert('alert-critical', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.CRITICAL),
        createAlert('alert-high', 'app-002', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
      ];

      correlation.updateNodeHealth(alerts);

      const health1 = correlation.getNodeHealth('app-001');
      expect(health1!.status).toBe('unhealthy');
      expect(health1!.criticalAlertCount).toBe(1);

      const health2 = correlation.getNodeHealth('app-002');
      expect(health2!.status).toBe('degraded');
      expect(health2!.alertCount).toBe(1);
    });
  });

  describe('calculateImpact', () => {
    it('should calculate direct and indirect impact', () => {
      const alert = createAlert('alert-db', 'db-001', AlertSourceType.DATABASE);

      const impact = correlation.calculateImpact(alert);

      expect(impact.directImpact).toContain('app-001');
      expect(impact.directImpact).toContain('app-002');
      expect(impact.totalImpactCount).toBeGreaterThan(0);
    });
  });

  describe('getNodeHealth', () => {
    it('should return health status for all nodes', () => {
      const allHealth = correlation.getAllNodeHealth();

      expect(allHealth).toHaveLength(7);
      expect(allHealth[0].status).toBe('healthy');
    });
  });
});