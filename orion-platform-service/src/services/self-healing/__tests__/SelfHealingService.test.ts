/**
 * Self-Healing Engine - Unit Tests
 *
 * Tests for all self-healing components:
 * - HealingStrategyEngine
 * - HealingActionExecutor
 * - HealingDecisionMaker
 * - SelfHealingService (with mock repository)
 *
 * TASK-702: Self-Healing Engine (self-healing rules/executions backed by PostgreSQL)
 */

import { HealingStrategyEngine } from '../HealingStrategyEngine';
import { HealingActionExecutor } from '../HealingActionExecutor';
import {
  HealingDecisionMaker,
  type IRiskAssessor,
} from '../HealingDecisionMaker';
import { SelfHealingService } from '../SelfHealingService';
import { SelfHealingRepository, HealingIncidentRow, ApprovalRequestRow } from '../SelfHealingRepository';
import {
  HealingStrategy,
  HealingAction,
  IncidentType,
  IncidentSeverity,
  HealingIncident,
} from '../types';

// ==================== Mock Repository ====================

class MockSelfHealingRepository {
  private incidents: Map<string, HealingIncidentRow> = new Map();
  private approvals: Map<string, ApprovalRequestRow> = new Map();
  private rules: Map<string, any> = new Map();
  private executions: Map<string, any> = new Map();

  // Rules methods (stubs)
  async findRuleById(id: string): Promise<any | null> { return this.rules.get(id) || null; }
  async findAllRules(tenantId?: string): Promise<any[]> { return Array.from(this.rules.values()); }
  async createRule(tenantId: string, name: string, triggerCondition: any, action: any): Promise<any> {
    const rule = { id: `rule-${Date.now()}`, tenant_id: tenantId, name, trigger_condition: triggerCondition, action, enabled: true, execution_count: 0, last_executed: null, created_at: new Date(), updated_at: new Date() };
    this.rules.set(rule.id, rule);
    return rule;
  }
  async updateRule(id: string, input: any): Promise<any | null> {
    const existing = this.rules.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...input, updated_at: new Date() };
    this.rules.set(id, updated);
    return updated;
  }
  async deleteRule(id: string): Promise<boolean> { return this.rules.delete(id); }
  async incrementExecutionCount(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (rule) { rule.execution_count++; }
  }
  async createExecution(ruleId: string, triggerEvent: any): Promise<any> {
    const exec = { id: `exec-${Date.now()}`, rule_id: ruleId, trigger_event: triggerEvent, status: 'running', result: null, error_message: null, started_at: new Date(), completed_at: null };
    this.executions.set(exec.id, exec);
    return exec;
  }
  async completeExecution(id: string, status: string, result?: any, errorMessage?: string): Promise<any | null> {
    const exec = this.executions.get(id);
    if (!exec) return null;
    const updated = { ...exec, status, result, error_message: errorMessage, completed_at: new Date() };
    this.executions.set(id, updated);
    return updated;
  }
  async findExecutions(ruleId: string, limit: number = 10): Promise<any[]> {
    return Array.from(this.executions.values()).filter(e => e.rule_id === ruleId).slice(0, limit);
  }

  // Incident methods
  async createIncident(incident: any): Promise<HealingIncidentRow> {
    const row: HealingIncidentRow = {
      id: incident.id || `incident-${Date.now()}-${Math.random()}`,
      alert_id: incident.alert_id || null,
      type: incident.type,
      severity: incident.severity,
      app_name: incident.app_name,
      environment: incident.environment,
      strategy_id: incident.strategy_id || null,
      strategy_name: incident.strategy_name || null,
      actions: incident.actions || [],
      status: incident.status || 'new',
      attempts: incident.attempts ?? 0,
      approval_status: incident.approval_status || null,
      approval_request_id: incident.approval_request_id || null,
      result: null,
      error: null,
      tags: incident.tags || null,
      started_at: new Date(),
      completed_at: null,
    };
    this.incidents.set(row.id, row);
    return row;
  }

  async findIncidentById(id: string): Promise<HealingIncidentRow | null> {
    return this.incidents.get(id) || null;
  }

  async findIncidents(filters: any): Promise<{ rows: HealingIncidentRow[]; total: number }> {
    let rows = Array.from(this.incidents.values());

    if (filters.appName) rows = rows.filter(r => r.app_name === filters.appName);
    if (filters.environment) rows = rows.filter(r => r.environment === filters.environment);
    if (filters.type) rows = rows.filter(r => r.type === filters.type);
    if (filters.status) rows = rows.filter(r => r.status === filters.status);
    if (filters.severity) rows = rows.filter(r => r.severity === filters.severity);
    if (filters.startDate) rows = rows.filter(r => r.started_at >= filters.startDate);
    if (filters.endDate) rows = rows.filter(r => r.started_at <= filters.endDate);

    const total = rows.length;
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    rows = rows.slice(offset, offset + limit);

    return { rows, total };
  }

  async updateIncident(id: string, updates: any): Promise<HealingIncidentRow | null> {
    const existing = this.incidents.get(id);
    if (!existing) return null;
    // Only apply non-undefined updates
    const updated = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (updated as any)[key] = value;
      }
    }
    this.incidents.set(id, updated);
    return updated;
  }

  // Approval methods
  async createApprovalRequest(approval: any): Promise<ApprovalRequestRow> {
    const row: ApprovalRequestRow = {
      id: `approval-${Date.now()}-${Math.random()}`,
      incident_id: approval.incident_id,
      title: approval.title,
      description: approval.description || null,
      risk_level: approval.risk_level,
      recommended_actions: approval.recommended_actions || [],
      status: approval.status || 'pending',
      requested_by: approval.requested_by || 'system',
      approved_by: null,
      approval_reason: null,
      requested_at: new Date(),
      responded_at: null,
      expires_at: approval.expires_at || null,
    };
    this.approvals.set(row.id, row);
    return row;
  }

  async findApprovalById(id: string): Promise<ApprovalRequestRow | null> {
    return this.approvals.get(id) || null;
  }

  async findApprovalsByStatus(status?: string): Promise<ApprovalRequestRow[]> {
    let rows = Array.from(this.approvals.values());
    if (status) rows = rows.filter(r => r.status === status);
    return rows.sort((a, b) => b.requested_at.getTime() - a.requested_at.getTime());
  }

  async updateApprovalRequest(id: string, updates: any): Promise<ApprovalRequestRow | null> {
    const existing = this.approvals.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.approvals.set(id, updated);
    return updated;
  }

  async markExpiredApprovals(): Promise<number> {
    let count = 0;
    for (const [id, row] of this.approvals.entries()) {
      if (row.status === 'pending' && row.expires_at && new Date() > row.expires_at) {
        row.status = 'expired';
        this.approvals.set(id, row);
        count++;
      }
    }
    return count;
  }
}

// Cast mock to repository type
const mockRepo = new MockSelfHealingRepository() as unknown as SelfHealingRepository;

// ==================== Helper Functions ====================

function createStrategy(
  overrides?: Partial<HealingStrategy>
): HealingStrategy {
  return {
    id: `strategy-${Date.now()}`,
    name: 'Test Strategy',
    triggerType: 'pod_crash',
    confidence: 80,
    enabled: true,
    actions: [
      {
        type: 'restart',
        params: { target: 'test-app', graceful: true },
        timeout: 60000,
        rollback: true,
      },
    ],
    ...overrides,
  };
}

function createAction(
  overrides?: Partial<HealingAction>
): HealingAction {
  return {
    type: 'restart',
    params: { target: 'test-app' },
    timeout: 60000,
    ...overrides,
  };
}

function createIncident(
  overrides?: Partial<HealingIncident>
): HealingIncident {
  return {
    id: `incident-${Date.now()}`,
    type: 'pod_crash',
    severity: 'warning',
    appName: 'test-app',
    environment: 'staging',
    actions: [createAction()],
    status: 'new',
    startedAt: new Date(),
    attempts: 0,
    ...overrides,
  };
}

// ==================== HealingStrategyEngine Tests ====================

describe('HealingStrategyEngine', () => {
  let engine: HealingStrategyEngine;

  beforeEach(() => {
    engine = new HealingStrategyEngine();
  });

  describe('Built-in Strategies', () => {
    it('should register built-in strategies on construction', async () => {
      const strategies = await engine.getAllStrategies();
      expect(strategies.length).toBeGreaterThanOrEqual(8);
    });

    it('should have restart-on-crash strategy', async () => {
      const strategy = await engine.getStrategy('restart-on-crash');
      expect(strategy).toBeDefined();
      expect(strategy?.triggerType).toBe('pod_crash');
      expect(strategy?.confidence).toBe(90);
    });

    it('should have scale-on-high-cpu strategy', async () => {
      const strategy = await engine.getStrategy('scale-on-high-cpu');
      expect(strategy).toBeDefined();
      expect(strategy?.triggerType).toBe('high_cpu');
    });

    it('should have failover-on-node-failure strategy', async () => {
      const strategy = await engine.getStrategy('failover-on-node-failure');
      expect(strategy).toBeDefined();
      expect(strategy?.triggerType).toBe('node_failure');
    });

    it('should have rollback-on-deployment-failure strategy', async () => {
      const strategy = await engine.getStrategy('rollback-on-deployment-failure');
      expect(strategy).toBeDefined();
      expect(strategy?.triggerType).toBe('deployment_failure');
    });
  });

  describe('registerStrategy', () => {
    it('should register a new strategy', async () => {
      const strategy = createStrategy({ id: 'custom-strategy' });
      await engine.registerStrategy(strategy);

      const found = await engine.getStrategy('custom-strategy');
      expect(found).toBeDefined();
      expect(found?.id).toBe('custom-strategy');
    });

    it('should make strategy available in getAllStrategies', async () => {
      const count = (await engine.getAllStrategies()).length;
      await engine.registerStrategy(createStrategy({ id: 'new-strategy' }));

      expect((await engine.getAllStrategies()).length).toBe(count + 1);
    });
  });

  describe('unregisterStrategy', () => {
    it('should remove a registered strategy', async () => {
      await engine.registerStrategy(createStrategy({ id: 'to-remove' }));

      const result = await engine.unregisterStrategy('to-remove');
      expect(result).toBe(true);
      expect(await engine.getStrategy('to-remove')).toBeUndefined();
    });

    it('should return false for non-existent strategy', async () => {
      const result = await engine.unregisterStrategy('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('enableStrategy / disableStrategy', () => {
    it('should enable a disabled strategy', async () => {
      const strategy = createStrategy({ id: 'toggle-test', enabled: false });
      await engine.registerStrategy(strategy);

      const result = await engine.enableStrategy('toggle-test');
      expect(result).toBe(true);
      expect((await engine.getStrategy('toggle-test'))?.enabled).toBe(true);
    });

    it('should disable an enabled strategy', async () => {
      await engine.disableStrategy('restart-on-crash');
      expect((await engine.getStrategy('restart-on-crash'))?.enabled).toBe(false);
    });

    it('should return false for non-existent strategy', async () => {
      expect(await engine.enableStrategy('non-existent')).toBe(false);
      expect(await engine.disableStrategy('non-existent')).toBe(false);
    });
  });

  describe('matchStrategies', () => {
    it('should match strategies by incident type', async () => {
      const matches = await engine.matchStrategies('pod_crash');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every((s) => s.triggerType === 'pod_crash' || s.triggerType === 'any')).toBe(true);
    });

    it('should return empty array for unmatched type', async () => {
      await engine.disableStrategy('high_latency' as any);
      const matches = await engine.matchStrategies('custom');
      expect(matches.length).toBe(0);
    });

    it('should only return enabled strategies', async () => {
      await engine.disableStrategy('restart-on-crash');

      const matches = await engine.matchStrategies('pod_crash');
      expect(matches.every((s) => s.id !== 'restart-on-crash')).toBe(true);
    });

    it('should match strategies with "any" trigger type', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'any-trigger',
        triggerType: 'any',
        confidence: 50,
      }));

      const matches = await engine.matchStrategies('pod_crash');
      const anyStrategy = matches.find((s) => s.id === 'any-trigger');
      expect(anyStrategy).toBeDefined();
    });

    it('should filter by conditions', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'conditional',
        triggerType: 'pod_crash',
        conditions: [
          { field: 'severity', operator: '==', value: 'critical' },
        ],
      }));

      const criticalMatches = await engine.matchStrategies('pod_crash', { severity: 'critical' });
      expect(criticalMatches.some((s) => s.id === 'conditional')).toBe(true);

      const warningMatches = await engine.matchStrategies('pod_crash', { severity: 'warning' });
      expect(warningMatches.some((s) => s.id === 'conditional')).toBe(false);
    });
  });

  describe('selectBestStrategy', () => {
    it('should select strategy with highest confidence', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'low-conf',
        triggerType: 'pod_crash',
        confidence: 30,
      }));

      const best = await engine.selectBestStrategy('pod_crash');
      expect(best?.id).toBe('restart-on-crash');
    });

    it('should return null when no strategies match', async () => {
      const best = await engine.selectBestStrategy('custom');
      expect(best).toBeNull();
    });

    it('should prefer strategies with more retries on tie', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'tie-a',
        triggerType: 'custom',
        confidence: 50,
        maxRetries: 3,
      }));
      await engine.registerStrategy(createStrategy({
        id: 'tie-b',
        triggerType: 'custom',
        confidence: 50,
        maxRetries: 1,
      }));

      const best = await engine.selectBestStrategy('custom');
      expect(best?.id).toBe('tie-a');
    });
  });
});

// ==================== HealingActionExecutor Tests ====================

describe('HealingActionExecutor', () => {
  let executor: HealingActionExecutor;

  beforeEach(() => {
    executor = new HealingActionExecutor();
  });

  describe('executeAction', () => {
    it('should execute restart action successfully', async () => {
      const action = createAction({ type: 'restart', timeout: 100 });
      const result = await executor.executeAction(action);

      expect(result.type).toBe('restart');
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.executedAt).toBeDefined();
    });

    it('should execute scale action successfully', async () => {
      const action = createAction({
        type: 'scale',
        timeout: 100,
        params: { target: 'test-app', direction: 'up', increment: 2 },
      });
      const result = await executor.executeAction(action);

      expect(result.type).toBe('scale');
      expect(result.success).toBe(true);
    });

    it('should execute failover action successfully', async () => {
      const action = createAction({
        type: 'failover',
        timeout: 100,
        params: { target: 'test-app', sourceNode: 'node-1' },
      });
      const result = await executor.executeAction(action);

      expect(result.type).toBe('failover');
      expect(result.success).toBe(true);
    });

    it('should execute rollback action successfully', async () => {
      const action = createAction({
        type: 'rollback',
        timeout: 100,
        params: { target: 'test-app', targetVersion: '1.0.0' },
      });
      const result = await executor.executeAction(action);

      expect(result.type).toBe('rollback');
      expect(result.success).toBe(true);
    });

    it('should handle unknown action type', async () => {
      const action = createAction({
        type: 'unknown' as any,
        params: {},
      });
      const result = await executor.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('verifyAction', () => {
    it('should verify restart action', async () => {
      const verified = await executor.verifyAction('restart', { target: 'test-app' });
      expect(verified).toBe(true);
    });

    it('should verify scale action', async () => {
      const verified = await executor.verifyAction('scale', { target: 'test-app' });
      expect(verified).toBe(true);
    });

    it('should verify failover action', async () => {
      const verified = await executor.verifyAction('failover', { target: 'test-app' });
      expect(verified).toBe(true);
    });

    it('should verify rollback action', async () => {
      const verified = await executor.verifyAction('rollback', { target: 'test-app' });
      expect(verified).toBe(true);
    });
  });

  describe('rollbackAction', () => {
    it('should rollback a restart action', async () => {
      const action = createAction({ type: 'restart', timeout: 100 });
      const result = await executor.rollbackAction(action);

      expect(result.type).toBe('restart');
      expect(result.rollbackNeeded).toBe(true);
    });

    it('should rollback a scale action', async () => {
      const action = createAction({
        type: 'scale',
        timeout: 100,
        params: { direction: 'up', increment: 2 },
      });
      const result = await executor.rollbackAction(action);

      expect(result.type).toBe('scale');
      expect(result.rollbackNeeded).toBe(true);
    });

    it('should rollback a failover action', async () => {
      const action = createAction({ type: 'failover', timeout: 100, params: {} });
      const result = await executor.rollbackAction(action);

      expect(result.type).toBe('failover');
      expect(result.rollbackNeeded).toBe(true);
    });
  });

  describe('getExecutedActions', () => {
    it('should track executed actions', async () => {
      await executor.executeAction(createAction({ type: 'restart', timeout: 100 }));
      await executor.executeAction(createAction({ type: 'scale', timeout: 100 }));

      const actions = await executor.getExecutedActions();
      expect(actions.length).toBe(2);
    });

    it('should clear executed actions', async () => {
      await executor.executeAction(createAction({ type: 'restart', timeout: 100 }));
      executor.clearExecutedActions();

      const actions = await executor.getExecutedActions();
      expect(actions.length).toBe(0);
    });
  });
});

// ==================== HealingDecisionMaker Tests ====================

describe('HealingDecisionMaker', () => {
  let decisionMaker: HealingDecisionMaker;

  beforeEach(() => {
    decisionMaker = new HealingDecisionMaker();
  });

  describe('getDecision', () => {
    it('should return auto decision for low risk scenario', async () => {
      const strategy = createStrategy({
        id: 'auto-test',
        confidence: 85,
        triggerType: 'pod_crash',
      });

      const decision = await decisionMaker.getDecision({
        strategy,
        appName: 'test-app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(decision.type).toBe('auto');
      expect(decision.requiresApproval).toBe(false);
    });

    it('should return manual decision for production environment', async () => {
      const strategy = createStrategy({
        id: 'prod-test',
        confidence: 90,
        triggerType: 'pod_crash',
      });

      const decision = await decisionMaker.getDecision({
        strategy,
        appName: 'test-app',
        environment: 'production',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(decision.type).toBe('manual');
      expect(decision.requiresApproval).toBe(true);
    });

    it('should return manual decision for low confidence', async () => {
      const strategy = createStrategy({
        id: 'low-conf-test',
        confidence: 40,
        triggerType: 'pod_crash',
      });

      const decision = await decisionMaker.getDecision({
        strategy,
        appName: 'test-app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(decision.type).toBe('manual');
      expect(decision.reason).toContain('below threshold');
    });

    it('should return manual decision for critical severity', async () => {
      const strategy = createStrategy({
        id: 'critical-test',
        confidence: 95,
        triggerType: 'pod_crash',
      });

      const decision = await decisionMaker.getDecision({
        strategy,
        appName: 'test-app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'critical',
      });

      expect(decision.type).toBe('manual');
      expect(decision.reason).toContain('Critical severity');
    });

    it('should return manual for disabled incident types', async () => {
      const dm = new HealingDecisionMaker({
        disabledIncidentTypes: ['pod_crash'],
      });

      const decision = await dm.getDecision({
        strategy: createStrategy({ id: 'disabled-type', confidence: 90, triggerType: 'pod_crash' }),
        appName: 'test-app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(decision.type).toBe('manual');
    });
  });

  describe('shouldAutoHeal', () => {
    it('should return true for auto-heal eligible', async () => {
      const should = await decisionMaker.shouldAutoHeal({
        strategy: createStrategy({ confidence: 85, triggerType: 'pod_crash' }),
        appName: 'test-app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(should).toBe(true);
    });

    it('should return false for manual decision', async () => {
      const should = await decisionMaker.shouldAutoHeal({
        strategy: createStrategy({ confidence: 85, triggerType: 'pod_crash' }),
        appName: 'test-app',
        environment: 'production',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(should).toBe(false);
    });
  });

  describe('Approval Workflow', () => {
    it('should create an approval request', () => {
      const decision = {
        type: 'manual' as const,
        reason: 'Test',
        confidence: 80,
        riskLevel: 'high' as const,
        requiresApproval: true,
        recommendedActions: [createAction()],
      };

      const request = decisionMaker.createApprovalRequest({
        incidentId: 'incident-1',
        decision,
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
        requestedBy: 'system',
      });

      expect(request.id).toBeDefined();
      expect(request.incidentId).toBe('incident-1');
      expect(request.status).toBe('pending');
      expect(request.expiresAt).toBeDefined();
    });

    it('should approve a pending request', () => {
      const request = decisionMaker.createApprovalRequest({
        incidentId: 'incident-1',
        decision: {
          type: 'manual',
          reason: 'Test',
          confidence: 80,
          riskLevel: 'high',
          requiresApproval: true,
          recommendedActions: [],
        },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      const updated = decisionMaker.respondToApproval(request.id, {
        approved: true,
        reason: 'Looks good',
        respondedBy: 'admin',
      });

      expect(updated.status).toBe('approved');
      expect(updated.approvedBy).toBe('admin');
      expect(updated.respondedAt).toBeDefined();
    });

    it('should reject a pending request', () => {
      const request = decisionMaker.createApprovalRequest({
        incidentId: 'incident-1',
        decision: {
          type: 'manual',
          reason: 'Test',
          confidence: 80,
          riskLevel: 'high',
          requiresApproval: true,
          recommendedActions: [],
        },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      const updated = decisionMaker.respondToApproval(request.id, {
        approved: false,
        reason: 'Too risky',
        respondedBy: 'admin',
      });

      expect(updated.status).toBe('rejected');
      expect(updated.approvalReason).toBe('Too risky');
    });

    it('should throw error for non-existent request', () => {
      expect(() =>
        decisionMaker.respondToApproval('non-existent', {
          approved: true,
          respondedBy: 'admin',
        })
      ).toThrow('not found');
    });

    it('should throw error for already responded request', () => {
      const request = decisionMaker.createApprovalRequest({
        incidentId: 'incident-1',
        decision: {
          type: 'manual',
          reason: 'Test',
          confidence: 80,
          riskLevel: 'high',
          requiresApproval: true,
          recommendedActions: [],
        },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      decisionMaker.respondToApproval(request.id, {
        approved: true,
        respondedBy: 'admin',
      });

      expect(() =>
        decisionMaker.respondToApproval(request.id, {
          approved: false,
          respondedBy: 'admin',
        })
      ).toThrow('not pending');
    });
  });

  describe('getApprovalRequests', () => {
    it('should return all requests when no filter', async () => {
      decisionMaker.createApprovalRequest({
        incidentId: 'incident-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });
      decisionMaker.createApprovalRequest({
        incidentId: 'incident-2',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      const requests = await decisionMaker.getApprovalRequests();
      expect(requests.length).toBe(2);
    });

    it('should filter by status', async () => {
      const req1 = decisionMaker.createApprovalRequest({
        incidentId: 'incident-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });
      decisionMaker.createApprovalRequest({
        incidentId: 'incident-2',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      decisionMaker.respondToApproval(req1.id, { approved: true, respondedBy: 'admin' });

      const pending = await decisionMaker.getApprovalRequests('pending');
      expect(pending.length).toBe(1);
    });
  });

  describe('checkExpiredRequests', () => {
    it('should mark expired requests as expired', async () => {
      const dm = new HealingDecisionMaker({
        approvalExpirationMs: 0,
      });

      const request = dm.createApprovalRequest({
        incidentId: 'incident-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'test-app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      dm.checkExpiredRequests();
      const updated = await dm.getApprovalRequest(request.id);
      expect(updated?.status).toBe('expired');
    });
  });
});

// ==================== SelfHealingService Tests ====================

describe('SelfHealingService', () => {
  let service: SelfHealingService;
  let mockRepo: SelfHealingRepository;

  beforeEach(() => {
    const repo = new MockSelfHealingRepository();
    mockRepo = repo as unknown as SelfHealingRepository;
    service = new SelfHealingService(mockRepo);
  });

  describe('handleAlert', () => {
    it('should create an incident from alert for pod_crash', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-1',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Pod crashed',
        tags: { app: 'test-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      expect(incident.id).toBeDefined();
      expect(incident.type).toBe('pod_crash');
      expect(incident.severity).toBe('warning');
      expect(incident.appName).toBe('test-app');
      expect(incident.environment).toBe('dev');
    });

    it('should select a strategy for known incident types', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-1',
        metric: 'cpu_usage',
        severity: 'warning',
        value: 95,
        threshold: 80,
        message: 'High CPU',
        tags: { app: 'test-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      expect(incident.strategy).toBeDefined();
      expect(incident.type).toBe('high_cpu');
    });

    it('should fail when no strategy found', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-unknown',
        metric: 'unknown_metric_xyz',
        severity: 'info',
        value: 0,
        threshold: 0,
        message: 'Unknown metric',
        tags: { app: 'test-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      expect(incident.status).toBe('failed');
      expect(incident.error).toContain('No matching healing strategy');
    });

    it('should map metric names to incident types', async () => {
      const testCases = [
        { metric: 'cpu_usage', expectedType: 'high_cpu' },
        { metric: 'memory_usage', expectedType: 'high_memory' },
        { metric: 'error_rate', expectedType: 'high_error_rate' },
        { metric: 'response_latency', expectedType: 'high_latency' },
        { metric: 'pod_crash_loop', expectedType: 'pod_crash' },
        { metric: 'node_failure', expectedType: 'node_failure' },
        { metric: 'service_down', expectedType: 'service_down' },
        { metric: 'disk_full', expectedType: 'disk_full' },
        { metric: 'network_timeout', expectedType: 'network_timeout' },
      ];

      for (const tc of testCases) {
        const incident = await service.handleAlert({
          alertId: `alert-${tc.metric}`,
          metric: tc.metric,
          severity: 'warning',
          value: 0,
          threshold: 0,
          message: 'Test',
          tags: { app: 'test-app', env: 'dev' },
          triggeredAt: new Date(),
        });

        expect(incident.type).toBe(tc.expectedType);
      }
    });

    it('should auto-heal for dev environment with good confidence', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-heal',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Pod crashed',
        tags: { app: 'test-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      expect(incident.status).toBe('healed');
      expect(incident.result).toBeDefined();
      expect(incident.result?.success).toBe(true);
    });

    it('should require approval for production environment', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-prod',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Pod crashed',
        tags: { app: 'test-app', env: 'production' },
        triggeredAt: new Date(),
      });

      expect(incident.status).toBe('pending_approval');
      expect(incident.approvalStatus).toBe('pending');
      expect(incident.approvalRequestId).toBeDefined();
    });
  });

  describe('respondToApproval', () => {
    it('should continue healing when approved', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-approval',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Pod crashed',
        tags: { app: 'test-app', env: 'production' },
        triggeredAt: new Date(),
      });

      expect(incident.status).toBe('pending_approval');

      const updatedIncident = await service.respondToApproval(
        incident.approvalRequestId!,
        { approved: true, reason: 'Approved by admin', respondedBy: 'admin' }
      );

      expect(updatedIncident.approvalStatus).toBe('approved');
      expect(updatedIncident.status).toBe('healed');
    });

    it('should fail when rejected', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-reject',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Pod crashed',
        tags: { app: 'test-app', env: 'production' },
        triggeredAt: new Date(),
      });

      const updatedIncident = await service.respondToApproval(
        incident.approvalRequestId!,
        { approved: false, reason: 'Too risky', respondedBy: 'admin' }
      );

      expect(updatedIncident.approvalStatus).toBe('rejected');
      expect(updatedIncident.status).toBe('failed');
    });
  });

  describe('getIncident', () => {
    it('should return incident by ID', async () => {
      const incident = await service.handleAlert({
        alertId: 'alert-get',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Pod crashed',
        tags: { app: 'test-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      const found = await service.getIncident(incident.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(incident.id);
    });

    it('should return undefined for non-existent incident', async () => {
      const found = await service.getIncident('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getHistory', () => {
    it('should return all incidents', async () => {
      await service.handleAlert({
        alertId: 'alert-hist-1',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'app-1', env: 'dev' },
        triggeredAt: new Date(),
      });
      await service.handleAlert({
        alertId: 'alert-hist-2',
        metric: 'high_cpu',
        severity: 'warning',
        value: 95,
        threshold: 80,
        message: 'Test',
        tags: { app: 'app-2', env: 'dev' },
        triggeredAt: new Date(),
      });

      const history = await service.getHistory({});
      expect(history.total).toBe(2);
      expect(history.data.length).toBe(2);
    });

    it('should filter by app name', async () => {
      await service.handleAlert({
        alertId: 'alert-filter-1',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'filter-app', env: 'dev' },
        triggeredAt: new Date(),
      });
      await service.handleAlert({
        alertId: 'alert-filter-2',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'other-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      const history = await service.getHistory({ appName: 'filter-app' });
      expect(history.total).toBe(1);
    });

    it('should filter by status', async () => {
      await service.handleAlert({
        alertId: 'alert-status-1',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'app-1', env: 'dev' },
        triggeredAt: new Date(),
      });

      await service.handleAlert({
        alertId: 'alert-status-2',
        metric: 'completely_unknown_metric',
        severity: 'info',
        value: 0,
        threshold: 0,
        message: 'Test',
        tags: { app: 'app-1', env: 'dev' },
        triggeredAt: new Date(),
      });

      const healedHistory = await service.getHistory({ status: 'healed' });
      expect(healedHistory.total).toBeGreaterThanOrEqual(1);

      const escalatedHistory = await service.getHistory({ status: 'failed' });
      expect(escalatedHistory.total).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await service.handleAlert({
          alertId: `alert-page-${i}`,
          metric: 'pod_crash',
          severity: 'warning',
          value: 1,
          threshold: 0,
          message: 'Test',
          tags: { app: 'page-app', env: 'dev' },
          triggeredAt: new Date(),
        });
      }

      const page1 = await service.getHistory({ limit: 2, offset: 0 });
      expect(page1.data.length).toBe(2);
      expect(page1.total).toBeGreaterThanOrEqual(5);

      const page2 = await service.getHistory({ limit: 2, offset: 2 });
      expect(page2.data.length).toBe(2);
    });
  });

  describe('getEffectiveness', () => {
    it('should return effectiveness metrics', async () => {
      await service.handleAlert({
        alertId: 'alert-eff-1',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'eff-app', env: 'dev' },
        triggeredAt: new Date(),
      });
      await service.handleAlert({
        alertId: 'alert-eff-2',
        metric: 'high_cpu',
        severity: 'warning',
        value: 95,
        threshold: 80,
        message: 'Test',
        tags: { app: 'eff-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      const effectiveness = await service.getEffectiveness({});

      expect(effectiveness.totalIncidents).toBeGreaterThanOrEqual(2);
      expect(effectiveness.successRate).toBeGreaterThanOrEqual(0);
      expect(effectiveness.byIncidentType).toBeDefined();
      expect(effectiveness.byStrategy).toBeDefined();
      expect(effectiveness.byEnvironment).toBeDefined();
      expect(effectiveness.byActionType).toBeDefined();
    });

    it('should return zero metrics for empty history', async () => {
      const freshRepo = new MockSelfHealingRepository() as unknown as SelfHealingRepository;
      const freshService = new SelfHealingService(freshRepo);
      const effectiveness = await freshService.getEffectiveness({});

      expect(effectiveness.totalIncidents).toBe(0);
      expect(effectiveness.successRate).toBe(0);
      expect(effectiveness.averageDurationMs).toBe(0);
    });

    it('should filter by app name', async () => {
      await service.handleAlert({
        alertId: 'alert-eff-filter-1',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'filter-app', env: 'dev' },
        triggeredAt: new Date(),
      });
      await service.handleAlert({
        alertId: 'alert-eff-filter-2',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'other-app', env: 'dev' },
        triggeredAt: new Date(),
      });

      const filtered = await service.getEffectiveness({ appName: 'filter-app' });
      expect(filtered.totalIncidents).toBe(1);
    });
  });

  describe('Strategy Management', () => {
    it('should return all strategies', async () => {
      const strategies = await service.getStrategies();
      expect(strategies.length).toBeGreaterThanOrEqual(8);
    });

    it('should get strategy by ID', async () => {
      const strategy = await service.getStrategy('restart-on-crash');
      expect(strategy).toBeDefined();
      expect(strategy?.name).toBe('Auto Restart on Crash');
    });

    it('should toggle strategy', async () => {
      const result = await service.toggleStrategy('restart-on-crash', false);
      expect(result).toBe(true);

      const strategy = await service.getStrategy('restart-on-crash');
      expect(strategy?.enabled).toBe(false);
    });

    it('should register custom strategy', async () => {
      const customStrategy = createStrategy({
        id: 'my-custom-strategy',
        name: 'My Custom Strategy',
        triggerType: 'custom',
      });

      await service.registerCustomStrategy(customStrategy);

      const found = await service.getStrategy('my-custom-strategy');
      expect(found).toBeDefined();
      expect(found?.name).toBe('My Custom Strategy');
    });
  });

  describe('getApprovalRequests', () => {
    it('should return approval requests', async () => {
      await service.handleAlert({
        alertId: 'alert-approval-list',
        metric: 'pod_crash',
        severity: 'warning',
        value: 1,
        threshold: 0,
        message: 'Test',
        tags: { app: 'test-app', env: 'production' },
        triggeredAt: new Date(),
      });

      const pending = await service.getApprovalRequests('pending');
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });
  });
});
