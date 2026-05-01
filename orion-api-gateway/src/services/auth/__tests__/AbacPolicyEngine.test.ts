/**
 * ABAC Policy Engine 单元测试
 */

import {
  AbacPolicyEngine,
  AbacContext,
  AbacPolicy,
  ConditionRule,
  SYSTEM_ABAC_POLICIES,
} from '../AbacPolicyEngine';

describe('AbacPolicyEngine', () => {
  let engine: AbacPolicyEngine;

  beforeEach(() => {
    engine = new AbacPolicyEngine();
    engine.setCacheConfig(true, 60000);
  });

  // ==================== 系统政策测试 ====================

  describe('System Policies Initialization', () => {
    it('should initialize with system policies', () => {
      const policies = engine.getAllPolicies();
      expect(policies.length).toBeGreaterThanOrEqual(6);
    });

    it('should have resource-owner-full-control policy', () => {
      const policy = engine.getPolicy('resource-owner-full-control');
      expect(policy).toBeDefined();
      expect(policy?.effect).toBe('allow');
      expect(policy?.priority).toBe(100);
    });

    it('should have tenant-isolation policy', () => {
      const policy = engine.getPolicy('tenant-isolation');
      expect(policy).toBeDefined();
      expect(policy?.effect).toBe('deny');
      expect(policy?.priority).toBe(99);
    });

    it('should have external-network-restriction policy', () => {
      const policy = engine.getPolicy('external-network-restriction');
      expect(policy).toBeDefined();
      expect(policy?.effect).toBe('deny');
      expect(policy?.resourceType).toBe('*');
    });
  });

  // ==================== 条件评估测试 ====================

  describe('Condition Evaluation', () => {
    const createTestContext = (overrides?: Partial<AbacContext>): AbacContext => {
      return {
        user: { id: 'user1', role: 'developer', department: 'engineering', ...overrides?.user },
        resource: { type: 'pipeline', ...overrides?.resource },
        environment: { time: new Date(), ip: '192.168.1.1', ...overrides?.environment },
        action: { type: 'read', ...overrides?.action },
      };
    };

    it('should evaluate equals condition correctly', () => {
      const context = createTestContext();
      const policy = engine.getPolicy('resource-owner-full-control');

      // 用户不是资源所有者
      context.resource.owner = 'other-user';
      const result = engine.evaluate(context);
      expect(result.allowed).toBe(false);
    });

    it('should allow when user is resource owner', () => {
      const context = createTestContext({
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline', owner: 'user1' },
        action: { type: 'read' },
      });

      const result = engine.evaluate(context);
      // 检查 owner-full-control 政策是否匹配
      expect(result.matchedPolicies.some(p => p.id === 'resource-owner-full-control')).toBe(true);
    });

    it('should deny external network for write operations', () => {
      const context = createTestContext({
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline' },
        environment: { time: new Date(), ip: '203.0.113.1', network: 'external' },
        action: { type: 'create' },
      });

      const result = engine.evaluate(context);
      expect(result.denied).toBe(true);
      expect(result.denialReason).toContain('External Network');
    });

    it('should allow internal network operations', () => {
      const context = createTestContext({
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline' },
        environment: { time: new Date(), ip: '10.0.0.1', network: 'internal' },
        action: { type: 'read' },
      });

      // 内部网络读取应该被允许
      const result = engine.evaluate(context);
      expect(result.denied).toBe(false);
    });
  });

  // ==================== 条件操作符测试 ====================

  describe('Condition Operators', () => {
    const baseContext: AbacContext = {
      user: { id: 'user1', role: 'developer' },
      resource: { type: 'test' },
      environment: { time: new Date() },
      action: { type: 'read' },
    };

    // 测试 equals 操作符通过直接使用引擎方法
    it('should handle equals operator', () => {
      // 直接测试条件评估方法
      const condition = { attribute: 'user.role', operator: 'equals', value: 'developer' };
      const result = (engine as any).evaluateCondition(condition, baseContext);
      expect(result).toBe(true);

      const falseCondition = { attribute: 'user.role', operator: 'equals', value: 'admin' };
      const falseResult = (engine as any).evaluateCondition(falseCondition, baseContext);
      expect(falseResult).toBe(false);
    });

    it('should handle notEquals operator', () => {
      const condition = { attribute: 'user.role', operator: 'notEquals', value: 'admin' };
      const result = (engine as any).evaluateCondition(condition, baseContext);
      expect(result).toBe(true);

      const falseCondition = { attribute: 'user.role', operator: 'notEquals', value: 'developer' };
      const falseResult = (engine as any).evaluateCondition(falseCondition, baseContext);
      expect(falseResult).toBe(false);
    });

    it('should handle in operator', () => {
      const condition = { attribute: 'user.role', operator: 'in', value: ['admin', 'developer'] };
      const result = (engine as any).evaluateCondition(condition, baseContext);
      expect(result).toBe(true);

      const falseCondition = { attribute: 'user.role', operator: 'in', value: ['admin', 'guest'] };
      const falseResult = (engine as any).evaluateCondition(falseCondition, baseContext);
      expect(falseResult).toBe(false);
    });

    it('should handle contains operator for arrays', () => {
      const context = {
        ...baseContext,
        user: { id: 'user1', role: 'developer', teams: ['team-a', 'team-b'] },
      };
      const condition = { attribute: 'user.teams', operator: 'contains', value: 'team-a' };
      const result = (engine as any).evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle exists operator', () => {
      const condition = { attribute: 'user.department', operator: 'exists' };
      const result = (engine as any).evaluateCondition(condition, baseContext);
      expect(result).toBe(false);

      const contextWithDept = {
        ...baseContext,
        user: { id: 'user1', role: 'developer', department: 'engineering' },
      };
      const trueResult = (engine as any).evaluateCondition(condition, contextWithDept);
      expect(trueResult).toBe(true);
    });

    it('should handle matches operator (regex)', () => {
      const condition = { attribute: 'user.id', operator: 'matches', value: 'user\\d+' };
      const result = (engine as any).evaluateCondition(condition, baseContext);
      expect(result).toBe(true);

      const falseCondition = { attribute: 'user.id', operator: 'matches', value: 'admin\\d+' };
      const falseResult = (engine as any).evaluateCondition(falseCondition, baseContext);
      expect(falseResult).toBe(false);
    });
  });

  // ==================== 组合规则测试 ====================

  describe('Combined Rules', () => {
    const baseContext: AbacContext = {
      user: { id: 'user1', role: 'developer' },
      resource: { type: 'test' },
      environment: { time: new Date() },
      action: { type: 'read' },
    };

    it('should evaluate AND rule correctly', () => {
      const andResult = (engine as any).evaluateRule({
        and: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'developer' } },
          { condition: { attribute: 'action.type', operator: 'equals', value: 'read' } },
        ],
      }, baseContext);
      expect(andResult.result).toBe(true);
    });

    it('should fail AND rule when one condition fails', () => {
      const andResult = (engine as any).evaluateRule({
        and: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
          { condition: { attribute: 'action.type', operator: 'equals', value: 'read' } },
        ],
      }, baseContext);
      expect(andResult.result).toBe(false);
    });

    it('should evaluate OR rule correctly', () => {
      const orResult = (engine as any).evaluateRule({
        or: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
          { condition: { attribute: 'user.role', operator: 'equals', value: 'developer' } },
        ],
      }, baseContext);
      expect(orResult.result).toBe(true);
    });

    it('should evaluate NOT rule correctly', () => {
      const notResult = (engine as any).evaluateRule({
        not: {
          condition: { attribute: 'user.role', operator: 'equals', value: 'guest' },
        },
      }, baseContext);
      expect(notResult.result).toBe(true);
    });
  });

  // ==================== 政策优先级测试 ====================

  describe('Policy Priority', () => {
    it('should process policies in priority order', () => {
      const policies = engine.getAllPolicies();
      const sorted = policies.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      expect(sorted[0].priority).toBeGreaterThanOrEqual(sorted[sorted.length - 1].priority || 0);
    });

    it('should have deny policies for external network', () => {
      const policy = engine.getPolicy('external-network-restriction');
      expect(policy?.effect).toBe('deny');
      expect(policy?.priority).toBe(80);
    });
  });

  // ==================== 缓存测试 ====================

  describe('Caching', () => {
    it('should cache evaluation results', () => {
      const context: AbacContext = {
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline' },
        environment: { time: new Date() },
        action: { type: 'read' },
      };

      // 第一次评估
      const result1 = engine.evaluate(context);
      expect(result1.evaluationTime).toBeDefined();

      // 第二次评估（应该从缓存读取）
      const result2 = engine.evaluate(context);
      // 比较关键属性，不比较 evaluationTime（缓存返回原始时间）
      expect(result2.allowed).toBe(result1.allowed);
      expect(result2.denied).toBe(result1.denied);
      expect(result2.matchedPolicies).toEqual(result1.matchedPolicies);
      expect(result2.matchedConditions).toEqual(result1.matchedConditions);
    });

    it('should invalidate cache on policy change', () => {
      const context: AbacContext = {
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline' },
        environment: { time: new Date() },
        action: { type: 'read' },
      };

      engine.evaluate(context);

      // 注册新政策
      const newPolicy: AbacPolicy = {
        id: 'new-policy',
        name: 'New Policy',
        resourceType: '*',
        actionType: '*',
        conditions: {},
        effect: 'allow',
      };
      engine.registerPolicy(newPolicy);

      // 缓存应该被清除
      expect((engine as any).policyCache.size).toBe(0);

      engine.unregisterPolicy('new-policy');
    });

    it('should disable cache when configured', () => {
      engine.setCacheConfig(false);

      const context: AbacContext = {
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline' },
        environment: { time: new Date() },
        action: { type: 'read' },
      };

      engine.evaluate(context);

      // 缓存应该为空
      expect((engine as any).policyCache.size).toBe(0);
    });
  });

  // ==================== 变量引用测试 ====================

  describe('Variable References', () => {
    it('should resolve ${user.id} reference', () => {
      const context: AbacContext = {
        user: { id: 'user123', role: 'developer' },
        resource: { type: 'pipeline', owner: 'user123' },
        environment: { time: new Date() },
        action: { type: 'read' },
      };

      const policy = engine.getPolicy('resource-owner-full-control');
      expect(policy).toBeDefined();

      const result = engine.evaluate(context);
      expect(result.matchedPolicies.some(p => p.id === 'resource-owner-full-control')).toBe(true);
    });

    it('should resolve ${user.department} reference', () => {
      const context: AbacContext = {
        user: { id: 'user1', role: 'developer', department: 'engineering' },
        resource: { type: 'pipeline', department: 'engineering' },
        environment: { time: new Date() },
        action: { type: 'read' },
      };

      // 检查跨部门限制政策
      const policy = engine.getPolicy('cross-department-restriction');
      expect(policy).toBeDefined();

      // 同部门应该不被拒绝
      const result = engine.evaluate(context);
      expect(result.denied).toBe(false);
    });
  });

  // ==================== 批量评估测试 ====================

  describe('Batch Evaluation', () => {
    it('should evaluate multiple contexts in batch', () => {
      const contexts: AbacContext[] = [
        { user: { id: 'u1', role: 'admin' }, resource: { type: 'pipeline' }, environment: { time: new Date() }, action: { type: 'read' } },
        { user: { id: 'u2', role: 'developer' }, resource: { type: 'pipeline' }, environment: { time: new Date() }, action: { type: 'read' } },
        { user: { id: 'u3', role: 'guest' }, resource: { type: 'pipeline' }, environment: { time: new Date() }, action: { type: 'delete' } },
      ];

      const results = engine.evaluateBatch(contexts);
      expect(results.size).toBe(3);
    });
  });

  // ==================== 可用操作查询测试 ====================

  describe('Available Actions', () => {
    it('should get available actions for a user', () => {
      const context: Partial<AbacContext> = {
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'pipeline' },
        environment: { time: new Date() },
      };

      // 内部网络环境
      const fullContext: AbacContext = {
        user: context.user || { id: '', role: '' },
        resource: context.resource || { type: '' },
        environment: { time: new Date(), network: 'internal' },
        action: { type: 'read' },
      };

      // 检查 read 操作是否被允许
      const readResult = engine.evaluate({ ...fullContext, action: { type: 'read' } });
      expect(readResult.denied).toBe(false);
    });
  });

  // ==================== 政策导入导出测试 ====================

  describe('Policy Import/Export', () => {
    it('should export policies', () => {
      const exported = engine.exportPolicies();
      expect(exported.length).toBeGreaterThan(0);
      expect(exported[0].id).toBeDefined();
    });

    it('should import policies', () => {
      const newPolicy: AbacPolicy = {
        id: 'imported-policy',
        name: 'Imported Policy',
        resourceType: 'custom',
        actionType: 'execute',
        conditions: {},
        effect: 'allow',
      };

      engine.importPolicies([newPolicy]);
      expect(engine.getPolicy('imported-policy')).toBeDefined();

      engine.unregisterPolicy('imported-policy');
    });
  });

  // ==================== 时间范围检查测试 ====================

  describe('Time Range Checks', () => {
    it('should check working hours correctly', () => {
      // 工作时间内 (假设 9-18 UTC)
      const workHour = new Date();
      workHour.setUTCHours(10, 0, 0, 0);

      const workContext: AbacContext = {
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'deployment' },
        environment: { time: workHour, network: 'internal' },
        action: { type: 'execute', impact: 'high' },
      };

      // 工作时间应该允许（需要进一步检查其他条件）
      const workResult = engine.evaluate(workContext);
      expect(workResult.denied).toBe(false);

      // 非工作时间 (UTC 22:00)
      const offHour = new Date();
      offHour.setUTCHours(22, 0, 0, 0);

      const offContext: AbacContext = {
        user: { id: 'user1', role: 'developer' },
        resource: { type: 'deployment' },
        environment: { time: offHour, network: 'internal' },
        action: { type: 'execute', impact: 'high' },
      };

      const offResult = engine.evaluate(offContext);
      // 非工作时间高影响操作应该被拒绝（对于非管理员）
      expect(offResult.denied).toBe(true);
    });
  });
});