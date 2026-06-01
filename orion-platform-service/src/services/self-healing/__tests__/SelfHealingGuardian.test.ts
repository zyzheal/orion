/**
 * SelfHealingGuardian - Unit Tests
 *
 * Tests for the self-healing safety guardrail:
 * 1. Operation audit logging
 * 2. Storm suppression
 * 3. High-risk dual approval
 */

import { SelfHealingGuardian, HealingAuditEntry, StormSuppressionRule, DualApprovalConfig, HealingRiskLevel } from '../SelfHealingGuardian';

describe('SelfHealingGuardian', () => {
  let guardian: SelfHealingGuardian;

  beforeEach(() => {
    guardian = new SelfHealingGuardian();
  });

  // ==================== 1. Audit Logging ====================

  describe('recordAudit', () => {
    it('should record an audit entry with auto-generated id and timestamp', async () => {
      const entry = await guardian.recordAudit({
        incidentId: 'inc-1',
        actionType: 'restart',
        target: 'test-app',
        environment: 'dev',
        riskLevel: 'low',
        approvers: [],
        executor: 'system',
        status: 'executed',
        reason: 'Auto-restart on crash',
      });

      expect(entry.id).toBeDefined();
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.incidentId).toBe('inc-1');
      expect(entry.actionType).toBe('restart');
      expect(entry.target).toBe('test-app');
      expect(entry.environment).toBe('dev');
      expect(entry.riskLevel).toBe('low');
      expect(entry.executor).toBe('system');
      expect(entry.status).toBe('executed');
    });

    it('should persist multiple audit entries', async () => {
      await guardian.recordAudit({
        incidentId: 'inc-1',
        actionType: 'restart',
        target: 'app-1',
        environment: 'dev',
        riskLevel: 'low',
        approvers: [],
        executor: 'system',
        status: 'executed',
        reason: 'test',
      });

      await guardian.recordAudit({
        incidentId: 'inc-2',
        actionType: 'scale',
        target: 'app-2',
        environment: 'staging',
        riskLevel: 'medium',
        approvers: ['admin'],
        executor: 'admin',
        status: 'approved',
        reason: 'manual approval',
      });

      const stats = await guardian.getAuditStats();
      expect(stats.total).toBe(2);
    });
  });

  describe('queryAudit', () => {
    beforeEach(async () => {
      // Seed audit data
      await guardian.recordAudit({
        incidentId: 'inc-1',
        actionType: 'restart',
        target: 'app-1',
        environment: 'dev',
        riskLevel: 'low',
        approvers: [],
        executor: 'system',
        status: 'executed',
        reason: 'test1',
      });
      await guardian.recordAudit({
        incidentId: 'inc-2',
        actionType: 'scale',
        target: 'app-2',
        environment: 'production',
        riskLevel: 'high',
        approvers: ['admin'],
        executor: 'admin',
        status: 'approved',
        reason: 'test2',
      });
      await guardian.recordAudit({
        incidentId: 'inc-1',
        actionType: 'restart',
        target: 'app-1',
        environment: 'dev',
        riskLevel: 'low',
        approvers: [],
        executor: 'system',
        status: 'blocked',
        reason: 'test3',
      });
    });

    it('should return all entries without filters', async () => {
      const entries = await guardian.queryAudit();
      expect(entries.length).toBe(3);
    });

    it('should filter by incidentId', async () => {
      const entries = await guardian.queryAudit({ incidentId: 'inc-1' });
      expect(entries.length).toBe(2);
      expect(entries.every(e => e.incidentId === 'inc-1')).toBe(true);
    });

    it('should filter by actionType', async () => {
      const entries = await guardian.queryAudit({ actionType: 'scale' });
      expect(entries.length).toBe(1);
      expect(entries[0].actionType).toBe('scale');
    });

    it('should filter by environment', async () => {
      const entries = await guardian.queryAudit({ environment: 'production' });
      expect(entries.length).toBe(1);
      expect(entries[0].environment).toBe('production');
    });

    it('should filter by status', async () => {
      const entries = await guardian.queryAudit({ status: 'blocked' });
      expect(entries.length).toBe(1);
      expect(entries[0].status).toBe('blocked');
    });

    it('should respect limit option', async () => {
      const entries = await guardian.queryAudit({ limit: 1 });
      expect(entries.length).toBe(1);
    });

    it('should return most recent entries first', async () => {
      const entries = await guardian.queryAudit();
      // Most recent first (reversed from insertion order)
      expect(entries[0].reason).toBe('test3');
    });
  });

  describe('getAuditStats', () => {
    it('should return zero stats for empty log', async () => {
      const stats = await guardian.getAuditStats();
      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byStatus).length).toBe(0);
    });

    it('should aggregate stats correctly', async () => {
      await guardian.recordAudit({
        incidentId: 'inc-1',
        actionType: 'restart',
        target: 'app-1',
        environment: 'dev',
        riskLevel: 'low',
        approvers: [],
        executor: 'system',
        status: 'executed',
        reason: 'test',
      });
      await guardian.recordAudit({
        incidentId: 'inc-2',
        actionType: 'scale',
        target: 'app-2',
        environment: 'production',
        riskLevel: 'high',
        approvers: [],
        executor: 'system',
        status: 'executed',
        reason: 'test',
      });
      await guardian.recordAudit({
        incidentId: 'inc-3',
        actionType: 'restart',
        target: 'app-1',
        environment: 'dev',
        riskLevel: 'low',
        approvers: [],
        executor: 'system',
        status: 'blocked',
        reason: 'test',
      });

      const stats = await guardian.getAuditStats();

      expect(stats.total).toBe(3);
      expect(stats.byStatus['executed']).toBe(2);
      expect(stats.byStatus['blocked']).toBe(1);
      expect(stats.byRiskLevel['low']).toBe(2);
      expect(stats.byRiskLevel['high']).toBe(1);
      expect(stats.byEnvironment['dev']).toBe(2);
      expect(stats.byEnvironment['production']).toBe(1);
    });
  });

  // ==================== 2. Storm Suppression ====================

  describe('shouldSuppress', () => {
    it('should not suppress first alert', () => {
      const result = guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'dev',
        alertType: 'pod_crash',
      });
      expect(result).toBe(false);
    });

    it('should suppress second identical alert within window', () => {
      // First alert - not suppressed
      const first = guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'dev',
        alertType: 'pod_crash',
      });
      expect(first).toBe(false);

      // Second identical alert - suppressed by default rule (1 per 5 min)
      const second = guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'dev',
        alertType: 'pod_crash',
      });
      expect(second).toBe(true);
    });

    it('should not suppress different app alerts', () => {
      guardian.shouldSuppress({
        appName: 'app-1',
        environment: 'dev',
        alertType: 'pod_crash',
      });

      const result = guardian.shouldSuppress({
        appName: 'app-2',
        environment: 'dev',
        alertType: 'pod_crash',
      });
      expect(result).toBe(false);
    });

    it('should not suppress different environment alerts', () => {
      guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'dev',
        alertType: 'pod_crash',
      });

      const result = guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'production',
        alertType: 'pod_crash',
      });
      expect(result).toBe(false);
    });

    it('should not suppress different alert types', () => {
      guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'dev',
        alertType: 'pod_crash',
      });

      const result = guardian.shouldSuppress({
        appName: 'test-app',
        environment: 'dev',
        alertType: 'high_cpu',
      });
      expect(result).toBe(false);
    });

    it('should handle custom storm rules', () => {
      const customGuardian = new SelfHealingGuardian({
        stormRules: [
          { windowMs: 60000, maxExecutions: 3, groupBy: ['appName'] },
        ],
      });

      // First 3 should not be suppressed
      expect(customGuardian.shouldSuppress({ appName: 'app', environment: 'dev', alertType: 'test' })).toBe(false);
      expect(customGuardian.shouldSuppress({ appName: 'app', environment: 'dev', alertType: 'test' })).toBe(false);
      expect(customGuardian.shouldSuppress({ appName: 'app', environment: 'dev', alertType: 'test' })).toBe(false);

      // 4th should be suppressed
      expect(customGuardian.shouldSuppress({ appName: 'app', environment: 'dev', alertType: 'test' })).toBe(true);
    });
  });

  describe('getStormStatus', () => {
    it('should return empty status initially', () => {
      const status = guardian.getStormStatus();
      expect(status.activeWindows).toBe(0);
      expect(status.suppressedCount).toBe(0);
    });

    it('should track active windows after alerts', () => {
      guardian.shouldSuppress({ appName: 'app-1', environment: 'dev', alertType: 'type-1' });

      const status = guardian.getStormStatus();
      expect(status.activeWindows).toBeGreaterThan(0);
    });
  });

  // ==================== 3. Dual Approval ====================

  describe('requiresDualApproval', () => {
    it('should require dual approval for critical risk (default config)', () => {
      expect(guardian.requiresDualApproval('critical')).toBe(true);
    });

    it('should not require dual approval for non-critical risk (default config)', () => {
      expect(guardian.requiresDualApproval('low')).toBe(false);
      expect(guardian.requiresDualApproval('medium')).toBe(false);
      expect(guardian.requiresDualApproval('high')).toBe(false);
    });

    it('should respect custom config', () => {
      const customGuardian = new SelfHealingGuardian({
        dualApprovalConfig: {
          requireDualApproval: ['high', 'critical'],
          autoBlock: [],
        },
      });

      expect(customGuardian.requiresDualApproval('high')).toBe(true);
      expect(customGuardian.requiresDualApproval('critical')).toBe(true);
      expect(customGuardian.requiresDualApproval('medium')).toBe(false);
    });
  });

  describe('shouldAutoBlock', () => {
    it('should not auto block by default', () => {
      expect(guardian.shouldAutoBlock('low')).toBe(false);
      expect(guardian.shouldAutoBlock('medium')).toBe(false);
      expect(guardian.shouldAutoBlock('high')).toBe(false);
      expect(guardian.shouldAutoBlock('critical')).toBe(false);
    });

    it('should auto block configured risk levels', () => {
      const customGuardian = new SelfHealingGuardian({
        dualApprovalConfig: {
          requireDualApproval: [],
          autoBlock: ['critical'],
        },
      });

      expect(customGuardian.shouldAutoBlock('critical')).toBe(true);
      expect(customGuardian.shouldAutoBlock('high')).toBe(false);
    });
  });

  describe('validateDualApproval', () => {
    it('should approve with single approver for non-critical risk', () => {
      const result = guardian.validateDualApproval(['admin'], 'low');
      expect(result.approved).toBe(true);
      expect(result.reason).toContain('Single approval');
    });

    it('should reject with no approver for non-critical risk', () => {
      const result = guardian.validateDualApproval([], 'low');
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('No approver');
    });

    it('should require 2 approvers for critical risk', () => {
      const result = guardian.validateDualApproval(['admin-1'], 'critical');
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('1/2');
    });

    it('should approve with 2 different approvers for critical risk', () => {
      const result = guardian.validateDualApproval(['admin-1', 'admin-2'], 'critical');
      expect(result.approved).toBe(true);
      expect(result.reason).toContain('Dual approval complete');
    });

    it('should reject same person approving twice', () => {
      const result = guardian.validateDualApproval(['admin-1', 'admin-1'], 'critical');
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('2 different approvers');
    });

    it('should auto block when configured', () => {
      const customGuardian = new SelfHealingGuardian({
        dualApprovalConfig: {
          requireDualApproval: ['critical'],
          autoBlock: ['critical'],
        },
      });

      const result = customGuardian.validateDualApproval(['admin-1', 'admin-2'], 'critical');
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('auto-blocked');
    });
  });
});
