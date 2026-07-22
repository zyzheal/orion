/**
 * RuleEngine 测试
 */

import { RuleEngine } from '../RuleEngine';
import { AIScenario, Rule, RuleSet } from '../types';

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe('规则初始化', () => {
    it('应该初始化所有内置规则集', () => {
      const ruleSets = ruleEngine.getAllRuleSets();

      // 应该有 16 个场景的规则
      expect(ruleSets.length).toBeGreaterThanOrEqual(16);
    });

    it('应该正确初始化 P0 场景规则', () => {
      const ruleSet = ruleEngine.getRuleSet('aegis-risk-assessment');
      expect(ruleSet).toBeDefined();
      expect(ruleSet?.name).toContain('风险评估');
      expect(ruleSet?.rules.length).toBeGreaterThan(0);
    });

    it('应该正确初始化自动排单规则', () => {
      const ruleSet = ruleEngine.getRuleSet('auto-scheduling');
      expect(ruleSet).toBeDefined();
      expect(ruleSet?.rules.find(r => r.id === 'schedule-priority-urgent')).toBeDefined();
    });

    it('应该正确初始化根因诊断规则', () => {
      const ruleSet = ruleEngine.getRuleSet('root-cause-diagnosis');
      expect(ruleSet).toBeDefined();
      expect(ruleSet?.rules.find(r => r.id === 'diagnosis-db-error')).toBeDefined();
    });
  });

  describe('规则匹配', () => {
    describe('Aegis 风险评估', () => {
      it('应该匹配关键资产高风险规则', () => {
        const result = ruleEngine.execute('aegis-risk-assessment', {
          affectedAssets: ['production'],  // 直接包含 'production'
          changeType: 'deployment',
        });

        expect(result.success).toBe(true);
        expect(result.appliedRule).toBeDefined();
        expect(result.data?.riskLevel).toBe('high');
        expect(result.data?.requiresApproval).toBe(true);
      });

      it('应该匹配模块级变更中风险规则', () => {
        const result = ruleEngine.execute('aegis-risk-assessment', {
          changeScope: 'module',
          affectedAssets: ['dev-db'],
        });

        expect(result.success).toBe(true);
        expect(result.data?.riskLevel).toBe('medium');
      });

      it('应该匹配常规变更低风险规则', () => {
        const result = ruleEngine.execute('aegis-risk-assessment', {
          changeType: 'patch',
          changeScope: 'single-instance',
        });

        expect(result.success).toBe(true);
        expect(result.data?.riskLevel).toBe('low');
        expect(result.data?.requiresApproval).toBe(false);
      });
    });

    describe('自动排单', () => {
      it('应该匹配紧急工单优先规则', () => {
        const result = ruleEngine.execute('auto-scheduling', {
          priority: 'P0',
          incidentId: 'inc-001',
        });

        expect(result.success).toBe(true);
        expect(result.data?.assignedTeam).toBe('oncall-team');
        expect(result.data?.sla).toBe('15m');
      });

      it('应该匹配专业技能规则', () => {
        const result = ruleEngine.execute('auto-scheduling', {
          category: 'database',
          priority: 'P2',
        });

        expect(result.success).toBe(true);
        expect(result.data?.assignedTeam).toBe('db-team');
      });

      it('应该匹配轮询分配规则', () => {
        const result = ruleEngine.execute('auto-scheduling', {
          priority: 'P3',
          incidentId: 'inc-002',
        });

        expect(result.success).toBe(true);
        expect(result.data?.strategy).toBe('round_robin');
      });
    });

    describe('根因诊断', () => {
      it('应该匹配数据库错误诊断规则', () => {
        const result = ruleEngine.execute('root-cause-diagnosis', {
          errorType: 'connection refused timeout',
        });

        expect(result.success).toBe(true);
        expect(result.data?.rootCause).toBe('database_issue');
        expect(result.data?.requiresHumanConfirmation).toBe(true);
      });

      it('应该匹配内存错误诊断规则', () => {
        const result = ruleEngine.execute('root-cause-diagnosis', {
          errorType: 'OOM out of memory',
        });

        expect(result.success).toBe(true);
        expect(result.data?.rootCause).toBe('memory_issue');
      });

      it('应该匹配网络错误诊断规则', () => {
        const result = ruleEngine.execute('root-cause-diagnosis', {
          errorType: 'connection reset network refused',  // 避免包含 timeout（会匹配数据库规则）
        });

        expect(result.success).toBe(true);
        expect(result.data?.rootCause).toBe('network_issue');
      });
    });

    describe('Code Review', () => {
      it('应该检测大型变更', () => {
        const result = ruleEngine.execute('code-review', {
          linesChanged: 600,
        });

        expect(result.success).toBe(true);
        expect(result.data?.warnings).toBeDefined();
        expect(result.data?.requiresMultipleReviewers).toBe(true);
      });

      it('应该检测安全敏感文件', () => {
        const result = ruleEngine.execute('code-review', {
          filePattern: 'password-config.yaml',
        });

        expect(result.success).toBe(true);
        expect(result.data?.requiresSecurityReview).toBe(true);
      });

      it('应该检测缺少测试', () => {
        const result = ruleEngine.execute('code-review', {
          hasTests: false,
          linesChanged: 100,
        });

        expect(result.success).toBe(true);
        expect(result.data?.warnings).toContain('建议添加单元测试');
      });
    });

    describe('测试选择', () => {
      it('关键变更应该选择全量测试', () => {
        const result = ruleEngine.execute('test-selection', {
          changeType: 'hotfix',
        });

        expect(result.success).toBe(true);
        expect(result.data?.testStrategy).toBe('full');
      });

      it('常规变更应该选择冒烟测试', () => {
        const result = ruleEngine.execute('test-selection', {
          changeType: 'feature',
        });

        expect(result.success).toBe(true);
        expect(result.data?.testStrategy).toBe('smoke');
      });

      it('默认应该选择全量测试', () => {
        const result = ruleEngine.execute('test-selection', {
          unknownField: 'value',
        });

        expect(result.success).toBe(true);
        expect(result.data?.testStrategy).toBe('full');
      });
    });

    describe('变更日志生成', () => {
      it('应该使用特性模板', () => {
        const result = ruleEngine.execute('changelog-generation', {
          changeType: 'feature',
          description: '新增用户登录功能',
        });

        expect(result.success).toBe(true);
        expect(result.data?.title).toContain('Feature');
      });

      it('应该使用修复模板', () => {
        const result = ruleEngine.execute('changelog-generation', {
          changeType: 'fix',
          description: '修复登录超时问题',
        });

        expect(result.success).toBe(true);
        expect(result.data?.title).toContain('Fix');
      });
    });
  });

  describe('条件评估', () => {
    it('应该正确评估 eq 条件', () => {
      const result = ruleEngine.execute('test-selection', {
        changeType: 'hotfix',
      });
      expect(result.success).toBe(true);
    });

    it('应该正确评估 in 条件', () => {
      const result = ruleEngine.execute('aegis-risk-assessment', {
        changeType: 'deployment',
        affectedAssets: ['production'],
      });
      expect(result.data?.riskLevel).toBe('high');
    });

    it('应该正确评估 gt 条件', () => {
      const result = ruleEngine.execute('code-review', {
        linesChanged: 600,
      });
      expect(result.data?.requiresMultipleReviewers).toBe(true);
    });

    it('应该正确评估 regex 条件', () => {
      const result = ruleEngine.execute('root-cause-diagnosis', {
        errorType: 'connection refused',
      });
      expect(result.data?.rootCause).toBe('database_issue');
    });

    it('应该正确评估 exists 条件', () => {
      const result = ruleEngine.execute('root-cause-diagnosis', {
        errorType: 'some error',
        historicalData: { avgRisk: 'high' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('动作执行', () => {
    it('应该正确执行 set 动作', () => {
      const result = ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
      });

      expect(result.data?.riskLevel).toBe('high');
      expect(result.data?.requiresApproval).toBe(true);
      expect(result.data?.recommendation).toBeDefined();
    });

    it('应该正确执行 template 动作', () => {
      const result = ruleEngine.execute('changelog-generation', {
        changeType: 'feature',
        description: '测试描述',
      });

      expect(result.data?.title).toBeDefined();
      expect(result.data?.type).toBe('feature');
    });

    it('应该正确执行 function 动作', () => {
      const result = ruleEngine.execute('auto-scheduling', {
        category: 'database',
        priority: 'P2',
      });

      expect(result.data?.assignedTeam).toBe('db-team');
      expect(result.data?.matchedBy).toBe('expertise');
    });
  });

  describe('动态规则管理', () => {
    it('应该支持添加新规则', () => {
      const newRule: Rule = {
        id: 'custom-risk-rule',
        name: '自定义风险规则',
        scenario: 'aegis-risk-assessment',
        description: '测试自定义规则',
        priority: 50,
        enabled: true,
        conditions: [
          { field: 'customField', operator: 'eq', value: 'customValue' },
        ],
        actions: [
          { type: 'set', field: 'customResult', value: 'matched' },
        ],
      };

      ruleEngine.addRule('aegis-risk-assessment', newRule);

      const ruleSet = ruleEngine.getRuleSet('aegis-risk-assessment');
      expect(ruleSet?.rules.find(r => r.id === 'custom-risk-rule')).toBeDefined();
    });

    it('应该支持添加新规则集', () => {
      const customRuleSet: RuleSet = {
        id: 'custom-scenario-rules',
        name: '自定义场景规则',
        scenario: 'aegis-risk-assessment',
        description: '自定义场景的规则集',
        enabled: true,
        rules: [
          {
            id: 'custom-1',
            name: '自定义规则1',
            scenario: 'aegis-risk-assessment',
            description: '',
            priority: 1,
            enabled: true,
            conditions: [],
            actions: [{ type: 'set', field: 'test', value: 'value' }],
          },
        ],
      };

      ruleEngine.addRuleSet(customRuleSet);
      const retrieved = ruleEngine.getRuleSet('aegis-risk-assessment');
      expect(retrieved).toBeDefined();
    });
  });

  describe('缓存功能', () => {
    it('应该缓存执行结果', () => {
      // 第一次执行
      const result1 = ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
        changeId: 'cache-test-1',
      });

      // 第二次执行（应该命中缓存）
      const result2 = ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
        changeId: 'cache-test-1',
      });

      expect(result2.source).toBe('cache');
    });

    it('应该支持清除缓存', () => {
      ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
        changeId: 'cache-clear-test',
      });

      ruleEngine.clearCache();

      const result = ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
        changeId: 'cache-clear-test',
      });

      expect(result.source).toBe('rule-engine');
    });
  });

  describe('审计日志', () => {
    it('应该记录规则执行', () => {
      ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
      });

      const auditLog = ruleEngine.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].scenario).toBe('aegis-risk-assessment');
    });

    it('应该记录匹配的规则 ID', () => {
      ruleEngine.execute('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
      });

      const auditLog = ruleEngine.getAuditLog();
      expect(auditLog[0].ruleId).toBeDefined();
    });
  });

  describe('P1 场景降级规则', () => {
    it('指标异常检测应该正确工作', () => {
      const result = ruleEngine.execute('metric-anomaly-detection', {
        value: 100,
        threshold: 50,
      });

      expect(result.success).toBe(true);
      expect(result.data?.isAnomaly).toBe(true);
    });

    it('日志模式分析应该正确工作', () => {
      const result = ruleEngine.execute('log-pattern-analysis', {
        logLevel: 'ERROR',
      });

      expect(result.success).toBe(true);
      expect(result.data?.pattern).toBe('error');
      expect(result.data?.requiresAttention).toBe(true);
    });

    it('告警关联应该正确工作', () => {
      const result = ruleEngine.execute('alert-correlation', {
        timeWindow: '5min',
      });

      expect(result.success).toBe(true);
      expect(result.data?.correlationId).toBeDefined();
    });

    it('自动化建议应该正确工作', () => {
      const result = ruleEngine.execute('automation-suggestion', {
        taskFrequency: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data?.automationCandidate).toBe(true);
    });
  });
});