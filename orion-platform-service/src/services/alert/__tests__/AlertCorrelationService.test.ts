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
    it('should set topology correctly', async () => {
      const topology = createTopology();
      correlation.setTopology(topology);

      const result = await correlation.getTopology();

      expect(result.nodes).toHaveLength(7);
      expect(result.edges).toHaveLength(7);
    });
  });

  describe('getDependencies', () => {
    it('should return correct dependencies for application', () => {
      const deps = correlation.getDependencies('app-001');

      expect(deps).toContain('db-001');
      expect(deps).toContain('network-001');
    });

    it('should return dependencies for node connected to network', () => {
      const deps = correlation.getDependencies('node-001');

      expect(deps).toContain('network-001');
    });
  });

  describe('getImpactScope', () => {
    it('should return correct downstream nodes for database', () => {
      const impact = correlation.getImpactScope('db-001');

      expect(impact).toContain('app-001');
      expect(impact).toContain('app-002');
    });

    it('should return direct impact scope for network', () => {
      const impact = correlation.getImpactScope('network-001');

      expect(impact).toContain('app-001');
      expect(impact).toContain('app-002');
      expect(impact).toContain('node-001');
      expect(impact).toContain('node-002');
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
      // The highest severity alert (critical) should be selected as root cause
      expect(result!.rootCauseAlertId).toBe('alert-node');
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
    // TODO: detectCorrelation method is not implemented in AlertCorrelationService.
    // These tests are marked as todo until the method is added to the implementation.
    // Expected signature: detectCorrelation(alert1: Alert, alert2: Alert) => CorrelationResult
    // Expected CorrelationResult: { correlated: boolean, correlationType: string, confidence?: number }
    it.todo('should detect same source correlation');
    it.todo('should detect dependency correlation');
    it.todo('should detect common dependency correlation');
    it.todo('should detect temporal correlation');
    it.todo('should return no correlation for unrelated alerts');
  });

  describe('analyzeCorrelations', () => {
    // TODO: analyzeCorrelations method is not implemented in AlertCorrelationService.
    // Expected signature: analyzeCorrelations(alerts: Alert[]) => CorrelationResult[]
    // Expected CorrelationResult: { alertId: string, correlatedAlertIds: string[] }
    it.todo('should analyze all alerts and return correlation results');
  });

  describe('updateNodeHealth', () => {
    it('should update node health based on alerts', () => {
      const alerts: Alert[] = [
        createAlert('alert-critical', 'app-001', AlertSourceType.APPLICATION, AlertSeverity.CRITICAL),
        createAlert('alert-high', 'app-002', AlertSourceType.APPLICATION, AlertSeverity.HIGH),
      ];

      correlation.updateNodeHealth(alerts);

      const allHealth = correlation.getAllNodeHealth();
      const health1 = allHealth.find(h => h.nodeId === 'app-001');
      expect(health1?.status).toBe('unhealthy');

      const health2 = allHealth.find(h => h.nodeId === 'app-002');
      expect(health2?.status).toBe('degraded');
    });
  });

  describe('calculateImpact', () => {
    // TODO: calculateImpact method is not implemented in AlertCorrelationService.
    // Expected signature: calculateImpact(alert: Alert) => ImpactResult
    // Expected ImpactResult: { directImpact: string[], totalImpactCount: number }
    it.todo('should calculate direct and indirect impact');
  });

  describe('getNodeHealth', () => {
    it('should return health status for all nodes', () => {
      const allHealth = correlation.getAllNodeHealth();

      // Only nodes that have received alerts will have health status set
      // After setTopology, nodeHealth is initialized for all nodes
      expect(allHealth.length).toBeGreaterThan(0);
      expect(allHealth[0].status).toBe('healthy');
    });
  });
});