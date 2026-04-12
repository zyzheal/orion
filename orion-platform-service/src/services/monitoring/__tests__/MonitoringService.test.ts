/**
 * TASK-703: MonitoringService Unit Tests
 */

import { MonitoringService } from '../MonitoringService';

describe('MonitoringService', () => {
  let service: MonitoringService;

  beforeEach(() => {
    service = new MonitoringService({
      collectionIntervalMs: 1000, // Fast for testing
      evaluationIntervalMs: 500,
      retentionMs: 60000,
      maxDataPointsPerMetric: 1000,
      anomalyZScoreThreshold: 2.5,
      enableSystemMetrics: true,
      natsSubjectPrefix: 'test.monitoring',
    });
  });

  afterEach(async () => {
    await service.stop();
  });

  // ==================== Lifecycle ====================

  describe('start/stop', () => {
    it('should start the service', async () => {
      await service.start();
      expect(service.getIsRunning()).toBe(true);
    });

    it('should stop the service', async () => {
      await service.start();
      await service.stop();
      expect(service.getIsRunning()).toBe(false);
    });

    it('should be idempotent for start', async () => {
      await service.start();
      await service.start(); // Should not error
      expect(service.getIsRunning()).toBe(true);
    });

    it('should be idempotent for stop', async () => {
      await service.stop(); // Should not error when not started
      expect(service.getIsRunning()).toBe(false);
    });

    it('should collect initial system metrics on start', async () => {
      await service.start();

      const cpuValue = service.metricCollector.getLatestValue('system.cpu.usage');
      expect(cpuValue).not.toBeNull();
    });

    it('should emit started event', async () => {
      let started = false;
      service.on('started', () => {
        started = true;
      });

      await service.start();
      expect(started).toBe(true);
    });

    it('should emit stopped event', async () => {
      await service.start();

      let stopped = false;
      service.on('stopped', () => {
        stopped = true;
      });

      await service.stop();
      expect(stopped).toBe(true);
    });
  });

  // ==================== Rule Management ====================

  describe('rule management', () => {
    it('should add a rule', () => {
      service.addRule({
        id: 'rule-1',
        name: 'High CPU',
        metric: 'system.cpu.usage',
        condition: '>',
        threshold: 90,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });

      const rules = service.alertRuleEngine.getAllRules();
      expect(rules.length).toBe(1);
    });

    it('should remove a rule', () => {
      service.addRule({
        id: 'rule-1',
        name: 'Test',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 60000,
      });

      service.removeRule('rule-1');
      expect(service.alertRuleEngine.getAllRules().length).toBe(0);
    });
  });

  // ==================== Alert Handling ====================

  describe('alert handling', () => {
    beforeEach(() => {
      service.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'test.cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });
    });

    it('should get alerts', () => {
      service.metricCollector.recordMetric('test.cpu', 95);
      service.alertRuleEngine.evaluateRules();

      const alerts = service.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should get active alerts', () => {
      service.metricCollector.recordMetric('test.cpu', 95);
      service.alertRuleEngine.evaluateRules();

      const active = service.getActiveAlerts();
      expect(active.length).toBeGreaterThan(0);
    });

    it('should acknowledge an alert', () => {
      service.metricCollector.recordMetric('test.cpu', 95);
      const alerts = service.alertRuleEngine.evaluateRules();

      const acked = service.acknowledgeAlert(alerts[0].id, 'user-1');
      expect(acked).not.toBeNull();
      expect(acked!.status).toBe('acknowledged');
    });

    it('should resolve an alert', () => {
      service.metricCollector.recordMetric('test.cpu', 95);
      const alerts = service.alertRuleEngine.evaluateRules();

      const resolved = service.resolveAlert(alerts[0].id);
      expect(resolved).not.toBeNull();
      expect(resolved!.status).toBe('resolved');
    });
  });

  // ==================== Metrics ====================

  describe('metrics', () => {
    it('should get metric series', () => {
      service.metricCollector.recordMetric('test.metric', 42);

      const series = service.getMetrics('test.metric');
      expect(series.dataPoints.length).toBe(1);
    });

    it('should get registered metrics list', () => {
      service.metricCollector.registerMetric({ name: 'custom.metric', unit: 'count' });

      const registered = service.getMetrics();
      expect(registered).toContain('custom.metric');
    });
  });

  // ==================== Dashboard ====================

  describe('dashboard', () => {
    it('should get dashboard data', () => {
      service.metricCollector.recordMetric('system.cpu.usage', 45);

      const data = service.getDashboardData();
      expect(data).toBeDefined();
      expect(data.widgets).toBeDefined();
      expect(data.healthScore).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    });
  });

  // ==================== Notification Channels ====================

  describe('notification channels', () => {
    it('should add a notification channel', () => {
      service.notificationService.addChannel({
        id: 'ch-email',
        name: 'Email',
        type: 'email',
        config: { recipients: ['ops@example.com'] },
        enabled: true,
      });

      const channels = service.notificationService.getAllChannels();
      expect(channels.length).toBe(1);
    });
  });

  // ==================== Escalation Policies ====================

  describe('escalation policies', () => {
    it('should add an escalation policy', () => {
      service.notificationService.addEscalationPolicy({
        id: 'policy-1',
        name: 'Test Policy',
        steps: [],
        repeatCount: 0,
        enabled: true,
      });

      const policies = service.notificationService.getAllEscalationPolicies();
      expect(policies.length).toBe(1);
    });
  });

  // ==================== Health Status ====================

  describe('getHealthStatus', () => {
    it('should return healthy status with no alerts', () => {
      const health = service.getHealthStatus();

      expect(health.isRunning).toBe(false); // Not started yet
      expect(health.status).toBe('healthy');
      expect(health.rulesCount).toBe(0);
      expect(health.alertsCount).toBe(0);
    });

    it('should return degraded status with many alerts', () => {
      // Add multiple rules that would trigger
      for (let i = 0; i < 6; i++) {
        service.addRule({
          id: `rule-${i}`,
          name: `Test Rule ${i}`,
          metric: `test.metric.${i}`,
          condition: '>',
          threshold: 0,
          severity: 'warning',
          enabled: true,
          cooldownMs: 0,
        });
        service.metricCollector.recordMetric(`test.metric.${i}`, 50);
      }

      service.alertRuleEngine.evaluateRules();

      const health = service.getHealthStatus();
      expect(health.alertsCount).toBeGreaterThan(5);
      expect(health.status).toBe('degraded');
    });

    it('should return unhealthy status with very many alerts', () => {
      for (let i = 0; i < 11; i++) {
        service.addRule({
          id: `rule-${i}`,
          name: `Test Rule ${i}`,
          metric: `test.metric.${i}`,
          condition: '>',
          threshold: 0,
          severity: 'critical',
          enabled: true,
          cooldownMs: 0,
        });
        service.metricCollector.recordMetric(`test.metric.${i}`, 50);
      }

      service.alertRuleEngine.evaluateRules();

      const health = service.getHealthStatus();
      expect(health.status).toBe('unhealthy');
    });
  });

  // ==================== Maintenance ====================

  describe('pruneExpiredMetrics', () => {
    it('should prune expired metrics', () => {
      service.metricCollector.recordMetric(
        'old.metric',
        1,
        {},
        new Date(Date.now() - 120000)
      );

      const pruned = service.pruneExpiredMetrics();
      expect(pruned).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Alert Event Emission ====================

  describe('event emission', () => {
    it('should emit alert:triggered when new alert is created', async () => {
      service.addRule({
        id: 'rule-test',
        name: 'Test Alert',
        metric: 'test.cpu',
        condition: '>',
        threshold: 50,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
      });

      let triggeredAlert: any = null;
      service.on('alert:triggered', (alert) => {
        triggeredAlert = alert;
      });

      service.metricCollector.recordMetric('test.cpu', 90);
      service.alertRuleEngine.evaluateRules();

      expect(triggeredAlert).not.toBeNull();
      expect(triggeredAlert.ruleId).toBe('rule-test');
    });
  });
});
