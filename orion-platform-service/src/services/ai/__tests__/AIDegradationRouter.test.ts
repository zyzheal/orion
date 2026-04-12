/**
 * AIDegradationRouter 测试
 */

import { AIDegradationRouter } from '../AIDegradationRouter';
import { RuleEngine } from '../RuleEngine';
import { DegradationStrategy, AIScenario } from '../types';

describe('AIDegradationRouter', () => {
  let router: AIDegradationRouter;
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    router = new AIDegradationRouter(ruleEngine);
  });

  describe('降级配置', () => {
    it('应该有正确的默认降级配置', () => {
      const config = router.getDegradationConfig('aegis-risk-assessment');

      expect(config.strategy).toBe('rule-engine');
      expect(config.fallbackStrategies).toContain('cache');
      expect(config.notifyOnDegradation).toBe(true);
    });

    it('应该支持自定义降级配置', () => {
      router.setDegradationConfig('code-review', {
        strategy: 'cache',
        fallbackStrategies: ['default'],
        cacheTTL: 600000,
      });

      const config = router.getDegradationConfig('code-review');
      expect(config.strategy).toBe('cache');
      expect(config.cacheTTL).toBe(600000);
    });

    it('应该返回所有 P0 场景的降级配置', () => {
      const p0Scenarios: AIScenario[] = [
        'aegis-risk-assessment',
        'auto-scheduling',
        'root-cause-diagnosis',
      ];

      for (const scenario of p0Scenarios) {
        const config = router.getDegradationConfig(scenario);
        expect(config.notifyOnDegradation).toBe(true);
      }
    });
  });

  describe('降级策略执行', () => {
    describe('rule-engine 策略', () => {
      it('应该成功执行规则引擎降级', async () => {
        const result = await router.degrade('aegis-risk-assessment', {
          affectedAssets: ['production'],
          changeType: 'deployment',
        }, 'llm_timeout');

        expect(result.success).toBe(true);
        expect(result.source).toBe('rule-engine');
        expect(result.data?.riskLevel).toBe('high');
      });

      it('应该正确执行自动排单降级', async () => {
        const result = await router.degrade('auto-scheduling', {
          priority: 'P0',
          incidentId: 'inc-001',
        }, 'ai_unavailable');

        expect(result.success).toBe(true);
        expect(result.source).toBe('rule-engine');
        expect(result.data?.assignedTeam).toBe('oncall-team');
      });

      it('应该正确执行根因诊断降级', async () => {
        const result = await router.degrade('root-cause-diagnosis', {
          errorType: 'connection refused',
        }, 'confidence_low');

        expect(result.success).toBe(true);
        expect(result.source).toBe('rule-engine');
        expect(result.data?.rootCause).toBe('database_issue');
        expect(result.data?.requiresHumanConfirmation).toBe(true);
      });
    });

    describe('template 策略', () => {
      it('应该成功执行模板降级', async () => {
        const result = await router.degrade('changelog-generation', {
          changeType: 'feature',
          description: '新功能',
        }, 'ai_unavailable');

        expect(result.success).toBe(true);
        expect(result.data?.title).toBeDefined();
      });

      it('应该成功执行事件摘要模板', async () => {
        const result = await router.degrade('incident-summary', {
          incidentId: 'inc-001',
          title: '数据库连接超时',
          status: 'investigating',
        }, 'ai_timeout');

        expect(result.success).toBe(true);
        expect(result.data?.status).toBeDefined();
      });
    });

    describe('cache 策略', () => {
      it('应该返回缓存的结果', async () => {
        // 先缓存一个结果
        router.cacheResult('dependency-analysis', { serviceId: 'svc-001' }, {
          success: true,
          data: { dependencies: ['svc-a', 'svc-b'] },
          source: 'rule-engine',
          reason: 'cached',
          confidence: 0.8,
        }, 3600000);

        // 使用缓存策略
        router.setDegradationConfig('dependency-analysis', {
          strategy: 'cache',
          fallbackStrategies: ['default'],
          cacheTTL: 3600000,
        });

        const result = await router.degrade('dependency-analysis', {
          serviceId: 'svc-001',
        }, 'ai_error');

        expect(result.success).toBe(true);
        expect(result.source).toBe('cache');
      });

      it('缓存过期后应该尝试备用策略', async () => {
        // 缓存一个已过期的结果
        router.cacheResult('dependency-analysis', { serviceId: 'svc-002' }, {
          success: true,
          data: { dependencies: [] },
          source: 'cache',
          reason: 'cached',
          confidence: 0.5,
        }, -1000); // 已过期

        router.setDegradationConfig('dependency-analysis', {
          strategy: 'cache',
          fallbackStrategies: ['default'],
        });

        const result = await router.degrade('dependency-analysis', {
          serviceId: 'svc-002',
        }, 'ai_error');

        // 应该使用默认策略
        expect(result.source).toBe('default');
      });
    });

    describe('manual 策略', () => {
      it('应该返回需要人工确认的结果', async () => {
        router.setDegradationConfig('root-cause-diagnosis', {
          strategy: 'manual',
          fallbackStrategies: ['default'],
          notifyOnDegradation: true,
        });

        const result = await router.degrade('root-cause-diagnosis', {
          errorType: 'unknown error',
        }, 'ai_failed');

        expect(result.success).toBe(true);
        expect(result.requiresManualAction).toBe(true);
        expect(result.confidence).toBeLessThanOrEqual(0.5);
      });
    });

    describe('default 策略', () => {
      it('应该返回默认响应', async () => {
        router.setDegradationConfig('capacity-forecast', {
          strategy: 'default',
          fallbackStrategies: [],
        });

        const result = await router.degrade('capacity-forecast', {
          serviceId: 'svc-001',
        }, 'no_ai');

        expect(result.success).toBe(true);
        expect(result.source).toBe('default');
        expect(result.confidence).toBeLessThanOrEqual(0.5);
      });
    });

    describe('多级降级', () => {
      it('应该在主要策略失败后尝试备用策略', async () => {
        router.setDegradationConfig('test-selection', {
          strategy: 'cache',
          fallbackStrategies: ['rule-engine', 'default'],
        });

        // 没有缓存，应该尝试规则引擎
        const result = await router.degrade('test-selection', {
          changeType: 'hotfix',
        }, 'ai_timeout');

        expect(result.success).toBe(true);
        // 应该使用 rule-engine 或 default
        expect(['rule-engine', 'default']).toContain(result.source);
      });

      it('应该在所有策略都失败后返回默认响应', async () => {
        // 设置一个只有 passthrough 策略的配置
        router.setDegradationConfig('sla-prediction', {
          strategy: 'passthrough' as any,
          fallbackStrategies: ['passthrough' as any],
        });

        const result = await router.degrade('sla-prediction', {
          unknown: true,
        }, 'all_failed');

        expect(result.success).toBe(true);
        expect(result.source).toBe('default');
      });
    });
  });

  describe('降级通知', () => {
    it('应该在降级时发送通知', async () => {
      const notificationHandler = jest.fn();
      router.setNotificationHandler(notificationHandler);

      router.setDegradationConfig('aegis-risk-assessment', {
        strategy: 'rule-engine',
        notifyOnDegradation: true,
      });

      await router.degrade('aegis-risk-assessment', {
        changeType: 'deployment',
        affectedAssets: ['production'],
      }, 'llm_timeout');

      expect(notificationHandler).toHaveBeenCalledWith(
        'aegis-risk-assessment',
        'llm_timeout'
      );
    });

    it('P0 场景应该默认发送通知', async () => {
      const notificationHandler = jest.fn();
      router.setNotificationHandler(notificationHandler);

      await router.degrade('auto-scheduling', {
        priority: 'P0',
      }, 'ai_unavailable');

      expect(notificationHandler).toHaveBeenCalled();
    });
  });

  describe('自定义处理器', () => {
    it('应该支持注册自定义降级处理器', async () => {
      router.registerHandler('custom-handler', async (input) => ({
        success: true,
        data: { customResult: 'processed', input },
        source: 'custom-handler',
        reason: 'Custom handler executed',
        confidence: 0.9,
      }));

      router.setDegradationConfig('code-review', {
        strategy: 'custom-handler',
        fallbackStrategies: ['default'],
      });

      const result = await router.degrade('code-review', {
        changeId: 'ch-001',
      }, 'need_custom');

      expect(result.success).toBe(true);
      expect(result.source).toBe('custom-handler');
      expect(result.data?.customResult).toBe('processed');
    });
  });

  describe('缓存管理', () => {
    it('应该支持缓存结果', () => {
      router.cacheResult('dependency-analysis', { serviceId: 'svc-001' }, {
        success: true,
        data: { dependencies: ['a', 'b'] },
        source: 'rule-engine',
        reason: 'test',
        confidence: 0.8,
      });

      const stats = router.getStats();
      expect(stats.cacheSize).toBe(1);
    });

    it('应该支持清除所有缓存', () => {
      router.cacheResult('dependency-analysis', { serviceId: 'svc-001' }, {
        success: true,
        data: {},
        source: 'cache',
        reason: 'test',
        confidence: 0.5,
      });
      router.cacheResult('dependency-analysis', { serviceId: 'svc-002' }, {
        success: true,
        data: {},
        source: 'cache',
        reason: 'test',
        confidence: 0.5,
      });

      router.clearCache();

      const stats = router.getStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('应该支持清除特定场景的缓存', () => {
      router.cacheResult('dependency-analysis', { serviceId: 'svc-001' }, {
        success: true,
        data: {},
        source: 'cache',
        reason: 'test',
        confidence: 0.5,
      });
      router.cacheResult('capacity-forecast', { serviceId: 'svc-001' }, {
        success: true,
        data: {},
        source: 'cache',
        reason: 'test',
        confidence: 0.5,
      });

      router.clearScenarioCache('dependency-analysis');

      const stats = router.getStats();
      expect(stats.cacheSize).toBe(1);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', () => {
      router.cacheResult('test', { id: '1' }, {
        success: true,
        data: {},
        source: 'cache',
        reason: 'test',
        confidence: 0.5,
      });

      const stats = router.getStats();

      expect(stats.cacheSize).toBe(1);
      expect(stats.configuredScenarios).toBeGreaterThan(0);
      expect(stats.availableStrategies).toContain('rule-engine');
      expect(stats.availableStrategies).toContain('template');
      expect(stats.availableStrategies).toContain('cache');
      expect(stats.availableStrategies).toContain('manual');
    });
  });

  describe('P0 场景降级验证', () => {
    it('Aegis 风险评估应该正确降级', async () => {
      const result = await router.degrade('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'deployment',
      }, 'llm_unavailable');

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.data?.riskLevel).toBeDefined();
      expect(result.data?.requiresApproval).toBeDefined();
    });

    it('自动排单应该正确降级', async () => {
      const result = await router.degrade('auto-scheduling', {
        priority: 'P0',
        incidentId: 'inc-001',
      }, 'ai_timeout');

      expect(result.success).toBe(true);
      expect(result.data?.assignedTeam).toBeDefined();
    });

    it('根因诊断应该正确降级并要求人工确认', async () => {
      const result = await router.degrade('root-cause-diagnosis', {
        errorType: 'connection refused',
      }, 'confidence_low');

      expect(result.success).toBe(true);
      expect(result.data?.requiresHumanConfirmation).toBe(true);
    });
  });

  describe('P1 场景降级验证', () => {
    it('Code Review 应该正确降级', async () => {
      const result = await router.degrade('code-review', {
        linesChanged: 600,
      }, 'ai_unavailable');

      expect(result.success).toBe(true);
      expect(result.data?.warnings).toBeDefined();
    });

    it('测试选择应该降级到全量测试', async () => {
      const result = await router.degrade('test-selection', {
        changeType: 'hotfix',
      }, 'ai_failed');

      expect(result.success).toBe(true);
      expect(result.data?.testStrategy).toBe('full');
    });

    it('变更日志生成应该正确降级', async () => {
      const result = await router.degrade('changelog-generation', {
        changeType: 'fix',
        description: '修复 bug',
      }, 'ai_timeout');

      expect(result.success).toBe(true);
      expect(result.data?.title).toBeDefined();
    });
  });

  describe('规则引擎集成', () => {
    it('应该正确获取规则引擎实例', () => {
      const engine = router.getRuleEngine();
      expect(engine).toBeDefined();
      expect(engine.getAllRuleSets().length).toBeGreaterThan(0);
    });

    it('规则引擎结果应该正确传递', async () => {
      const result = await router.degrade('aegis-risk-assessment', {
        affectedAssets: ['production'],
        changeType: 'config-change',
      }, 'test');

      // 规则引擎应该正确匹配
      expect(result.appliedRule).toBeDefined();
    });
  });
});