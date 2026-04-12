/**
 * TASK-703: AlertRuleEngine Unit Tests
 */

import { MetricCollector } from '../MetricCollector';
import { AlertRuleEngine } from '../AlertRuleEngine';

describe('AlertRuleEngine', () => {
  let collector: MetricCollector;
  let engine: AlertRuleEngine;

  beforeEach(() => {
    collector = new MetricCollector();
    engine = new AlertRuleEngine(collector);
  });

  // ==================== Rule Management ====================

  describe('addRule', () => {
    it('should add a rule', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'High CPU',
        metric: 'system.cpu.usage',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 300000,
      });

      const rules = engine.getAllRules();
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe('High CPU');
    });

    it('should allow updating a rule', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 60000,
      });

      const updated = engine.updateRule('rule-1', { threshold: 90, severity: 'critical' });

      expect(updated).not.toBeNull();
      expect(updated!.threshold).toBe(90);
      expect(updated!.severity).toBe('critical');
    });

    it('should return null when updating non-existent rule', () => {
      const result = engine.updateRule('nonexistent', { threshold: 50 });
      expect(result).toBeNull();
    });

    it('should allow removing a rule', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Test',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 60000,
      });

      const removed = engine.removeRule('rule-1');
      expect(removed).toBe(true);
      expect(engine.getAllRules().length).toBe(0);
    });

    it('should allow toggling a rule', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Test',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 60000,
      });

      engine.toggleRule('rule-1', false);
      const rule = engine.getRule('rule-1');
      expect(rule!.enabled).toBe(false);
    });
  });

  // ==================== Alert Suppression ====================

  describe('suppression', () => {
    it('should suppress a rule', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Test',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0, // No cooldown for testing
      });

      engine.suppressRule('rule-1');
      expect(engine.isRuleSuppressed('rule-1')).toBe(true);
    });

    it('should not evaluate suppressed rules', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-1',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });

      engine.suppressRule('rule-1');
      const alerts = engine.evaluateRules();

      expect(alerts.length).toBe(0);
    });

    it('should allow unsuppressing a rule', () => {
      engine.suppressRule('rule-1');
      engine.unsuppressRule('rule-1');

      expect(engine.isRuleSuppressed('rule-1')).toBe(false);
    });
  });

  // ==================== Alert Evaluation ====================

  describe('evaluateRules', () => {
    it('should create alert when threshold exceeded (>)', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });

      const alerts = engine.evaluateRules();

      expect(alerts.length).toBe(1);
      expect(alerts[0].ruleId).toBe('rule-cpu');
      expect(alerts[0].metric).toBe('cpu');
      expect(alerts[0].value).toBe(95);
      expect(alerts[0].threshold).toBe(80);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].status).toBe('triggered');
    });

    it('should create alert when threshold below (<)', () => {
      collector.recordMetric('disk.space', 5);

      engine.addRule({
        id: 'rule-disk',
        name: 'Low Disk',
        metric: 'disk.space',
        condition: '<',
        threshold: 10,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
      });

      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(1);
    });

    it('should not create alert when condition not met', () => {
      collector.recordMetric('cpu', 50);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });

      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(0);
    });

    it('should not evaluate disabled rules', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: false,
        cooldownMs: 0,
      });

      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(0);
    });

    it('should respect cooldown period', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 60000, // 1 minute
      });

      // First evaluation should trigger
      const firstAlerts = engine.evaluateRules();
      expect(firstAlerts.length).toBe(1);

      // Second evaluation within cooldown should not trigger
      const secondAlerts = engine.evaluateRules();
      expect(secondAlerts.length).toBe(0);
    });

    it('should generate alert message', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });

      const alerts = engine.evaluateRules();
      expect(alerts[0].message).toContain('High CPU');
      expect(alerts[0].message).toContain('cpu');
      expect(alerts[0].message).toContain('95');
    });

    it('should trigger alert callback', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });

      let callbackAlert: any = null;
      engine.onAlert = (alert) => {
        callbackAlert = alert;
      };

      engine.evaluateRules();

      expect(callbackAlert).not.toBeNull();
      expect(callbackAlert.ruleId).toBe('rule-cpu');
    });

    it('should evaluate single rule', () => {
      collector.recordMetric('cpu', 95);

      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
      });

      engine.addRule({
        id: 'rule-mem',
        name: 'High Memory',
        metric: 'memory',
        condition: '>',
        threshold: 90,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
      });

      const alert = engine.evaluateRule('rule-cpu');
      expect(alert).not.toBeNull();
      expect(alert!.ruleId).toBe('rule-cpu');
    });
  });

  // ==================== Rate of Change Detection ====================

  describe('rate_of_change condition', () => {
    it('should detect sudden spikes', () => {
      collector.recordMetric('requests', 100);
      collector.recordMetric('requests', 500);

      engine.addRule({
        id: 'rule-spike',
        name: 'Request Spike',
        metric: 'requests',
        condition: 'rate_of_change',
        threshold: 200, // 200% change
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
        rateOfChangePercent: 200,
      });

      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(1);
    });

    it('should not trigger when change is within threshold', () => {
      collector.recordMetric('requests', 100);
      collector.recordMetric('requests', 110);

      engine.addRule({
        id: 'rule-spike',
        name: 'Request Spike',
        metric: 'requests',
        condition: 'rate_of_change',
        threshold: 50,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
        rateOfChangePercent: 50,
      });

      const alerts = engine.evaluateRules();
      // Change is only 10%, which is below 50% threshold
      expect(alerts.length).toBe(0);
    });
  });

  // ==================== Alert Management ====================

  describe('alert management', () => {
    beforeEach(() => {
      engine.addRule({
        id: 'rule-1',
        name: 'Test Rule',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });
    });

    it('should resolve an alert', () => {
      collector.recordMetric('cpu', 95);
      const alerts = engine.evaluateRules();

      const resolved = engine.resolveAlert(alerts[0].id);
      expect(resolved).not.toBeNull();
      expect(resolved!.status).toBe('resolved');
      expect(resolved!.resolvedAt).toBeDefined();
    });

    it('should acknowledge an alert', () => {
      collector.recordMetric('cpu', 95);
      const alerts = engine.evaluateRules();

      const acked = engine.acknowledgeAlert(alerts[0].id, 'user-1');
      expect(acked).not.toBeNull();
      expect(acked!.status).toBe('acknowledged');
      expect(acked!.acknowledgedBy).toBe('user-1');
      expect(acked!.acknowledgedAt).toBeDefined();
    });

    it('should not acknowledge a resolved alert', () => {
      collector.recordMetric('cpu', 95);
      const alerts = engine.evaluateRules();
      engine.resolveAlert(alerts[0].id);

      const acked = engine.acknowledgeAlert(alerts[0].id, 'user-1');
      expect(acked).toBeNull();
    });

    it('should suppress an alert', () => {
      collector.recordMetric('cpu', 95);
      const alerts = engine.evaluateRules();

      const suppressed = engine.suppressAlert(alerts[0].id);
      expect(suppressed).not.toBeNull();
      expect(suppressed!.status).toBe('suppressed');
    });

    it('should get alerts with filters', () => {
      collector.recordMetric('cpu', 95);
      collector.recordMetric('memory', 95);

      engine.addRule({
        id: 'rule-mem',
        name: 'High Memory',
        metric: 'memory',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
      });

      engine.evaluateRules();

      const allAlerts = engine.getAlerts();
      expect(allAlerts.length).toBe(2);

      const criticalAlerts = engine.getAlerts({ severity: 'critical' as any });
      expect(criticalAlerts.length).toBe(1);
    });

    it('should get active alerts only', () => {
      collector.recordMetric('cpu', 95);
      const alerts = engine.evaluateRules();
      engine.resolveAlert(alerts[0].id);

      const active = engine.getActiveAlerts();
      expect(active.length).toBe(0);
    });

    it('should count alerts by severity', () => {
      collector.recordMetric('cpu', 95);
      engine.evaluateRules();

      const counts = engine.getAlertCountsBySeverity();
      expect(counts.critical).toBe(1);
      expect(counts.warning).toBe(0);
      expect(counts.info).toBe(0);
    });

    it('should get alert history', () => {
      collector.recordMetric('cpu', 95);
      engine.evaluateRules();

      const history = engine.getAlertHistory();
      expect(history.length).toBe(1);
    });

    it('should limit alert history', () => {
      collector.recordMetric('cpu', 95);
      engine.evaluateRules();
      collector.recordMetric('memory', 95);
      engine.addRule({
        id: 'rule-mem',
        name: 'High Memory',
        metric: 'memory',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 0,
      });
      engine.evaluateRules();

      const history = engine.getAlertHistory(1);
      expect(history.length).toBe(1);
    });
  });

  // ==================== Condition Evaluation ====================

  describe('condition evaluation', () => {
    const baseRule = {
      id: 'rule-test',
      name: 'Test',
      metric: 'test',
      threshold: 50,
      severity: 'warning' as const,
      enabled: true,
      cooldownMs: 0,
    };

    it('should evaluate >= condition', () => {
      collector.recordMetric('test', 50);

      engine.addRule({ ...baseRule, condition: '>=' });
      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(1);
    });

    it('should evaluate <= condition', () => {
      collector.recordMetric('test', 50);

      engine.addRule({ ...baseRule, condition: '<=' });
      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(1);
    });

    it('should evaluate == condition', () => {
      collector.recordMetric('test', 50);

      engine.addRule({ ...baseRule, condition: '==' });
      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(1);
    });

    it('should evaluate != condition', () => {
      collector.recordMetric('test', 60);

      engine.addRule({ ...baseRule, condition: '!=' });
      const alerts = engine.evaluateRules();
      expect(alerts.length).toBe(1);
    });
  });

  // ==================== Clear Operations ====================

  describe('clear operations', () => {
    it('should clear all alerts', () => {
      collector.recordMetric('cpu', 95);
      engine.addRule({
        id: 'rule-cpu',
        name: 'High CPU',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0,
      });
      engine.evaluateRules();

      engine.clearAlerts();
      expect(engine.getAlerts().length).toBe(0);
    });

    it('should clear all rules', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Test',
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldownMs: 60000,
      });

      engine.clearRules();
      expect(engine.getAllRules().length).toBe(0);
    });
  });
});
