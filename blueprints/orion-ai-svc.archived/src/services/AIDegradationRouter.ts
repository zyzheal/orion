/**
 * AI 降级路由 - AI 服务降级策略管理
 *
 * 功能：
 * 1. 降级策略路由
 * 2. 多级降级实现
 * 3. 缓存结果管理
 * 4. 人工确认触发
 */

import {
  AIScenario,
  DegradationStrategy,
  DegradationConfig,
  DegradationResult,
  AI_SCENARIO_PRIORITY,
} from './types';
import { RuleEngine } from './RuleEngine';

// 默认降级配置映射
const DEFAULT_DEGRADATION_CONFIGS: Record<AIScenario, DegradationConfig> = {
  // P0 场景（核心业务，必须降级）
  'aegis-risk-assessment': {
    strategy: 'rule-engine',
    fallbackStrategies: ['cache', 'default'],
    ruleSet: 'aegis-risk-assessment-rules',
    notifyOnDegradation: true,
  },
  'auto-scheduling': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'auto-scheduling-rules',
    notifyOnDegradation: true,
  },
  'root-cause-diagnosis': {
    strategy: 'rule-engine',
    fallbackStrategies: ['manual'],
    ruleSet: 'root-cause-diagnosis-rules',
    notifyOnDegradation: true,
  },

  // P1 场景（重要功能）
  'code-review': {
    strategy: 'rule-engine',
    fallbackStrategies: ['template', 'default'],
    ruleSet: 'code-review-rules',
    notifyOnDegradation: false,
  },
  'test-selection': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'test-selection-rules',
    defaultResponse: { testStrategy: 'full', reason: 'AI不可用，执行全量测试' },
  },
  'changelog-generation': {
    strategy: 'template',
    fallbackStrategies: ['default'],
    templateName: 'changelog-default',
  },
  'incident-summary': {
    strategy: 'template',
    fallbackStrategies: ['default'],
    templateName: 'incident-summary',
  },
  'runbook-suggestion': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'runbook-suggestion-rules',
  },
  'metric-anomaly-detection': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'metric-anomaly-rules',
  },
  'log-pattern-analysis': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'log-pattern-rules',
  },
  'dependency-analysis': {
    strategy: 'rule-engine',
    fallbackStrategies: ['cache', 'default'],
    ruleSet: 'dependency-analysis-rules',
    cacheTTL: 3600000, // 1小时缓存
  },
  'capacity-forecast': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'capacity-forecast-rules',
  },
  'sla-prediction': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'sla-prediction-rules',
  },
  'knowledge-extraction': {
    strategy: 'template',
    fallbackStrategies: ['default'],
    templateName: 'knowledge-extraction',
  },
  'alert-correlation': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'alert-correlation-rules',
  },
  'automation-suggestion': {
    strategy: 'rule-engine',
    fallbackStrategies: ['default'],
    ruleSet: 'automation-suggestion-rules',
  },
};

// 默认响应模板
const DEFAULT_RESPONSES: Record<AIScenario, unknown> = {
  'aegis-risk-assessment': { riskLevel: 'medium', requiresApproval: true, confidence: 0.6 },
  'auto-scheduling': { assignedTeam: 'oncall-team', strategy: 'fallback', confidence: 0.5 },
  'root-cause-diagnosis': { diagnosis: '需要人工诊断', requiresHumanConfirmation: true, confidence: 0.3 },
  'code-review': { passed: true, warnings: [], confidence: 0.5 },
  'test-selection': { testStrategy: 'full', reason: '降级模式', confidence: 0.8 },
  'changelog-generation': { title: '变更日志', type: 'change', confidence: 0.4 },
  'incident-summary': { summary: '事件摘要待生成', status: 'pending', confidence: 0.3 },
  'runbook-suggestion': { suggestion: '请查阅运维手册', confidence: 0.4 },
  'metric-anomaly-detection': { isAnomaly: false, confidence: 0.6 },
  'log-pattern-analysis': { pattern: 'normal', confidence: 0.5 },
  'dependency-analysis': { dependencies: [], confidence: 0.4 },
  'capacity-forecast': { forecast: 'insufficient_data', confidence: 0.3 },
  'sla-prediction': { slaPrediction: 'unknown', confidence: 0.3 },
  'knowledge-extraction': { extracted: false, confidence: 0.2 },
  'alert-correlation': { correlationId: null, confidence: 0.4 },
  'automation-suggestion': { suggestion: '暂无自动化建议', confidence: 0.3 },
};

/**
 * AI 降级路由器
 */
export class AIDegradationRouter {
  private ruleEngine: RuleEngine;
  private resultCache: Map<string, { result: DegradationResult; expiresAt: number }> = new Map();
  private degradationConfigs: Map<AIScenario, DegradationConfig> = new Map();
  private degradationHandlers: Map<string, (input: Record<string, unknown>) => Promise<DegradationResult>> = new Map();
  private notificationHandler?: (scenario: AIScenario, reason: string) => void;

  constructor(ruleEngine?: RuleEngine) {
    this.ruleEngine = ruleEngine || new RuleEngine();

    // 初始化默认配置
    for (const [scenario, config] of Object.entries(DEFAULT_DEGRADATION_CONFIGS)) {
      this.degradationConfigs.set(scenario as AIScenario, config);
    }
  }

  /**
   * 设置降级配置
   */
  setDegradationConfig(scenario: AIScenario, config: DegradationConfig): void {
    this.degradationConfigs.set(scenario, config);
  }

  /**
   * 获取降级配置
   */
  getDegradationConfig(scenario: AIScenario): DegradationConfig {
    return this.degradationConfigs.get(scenario) || {
      strategy: 'default',
      fallbackStrategies: [],
    };
  }

  /**
   * 注册自定义降级处理器
   */
  registerHandler(
    name: string,
    handler: (input: Record<string, unknown>) => Promise<DegradationResult>
  ): void {
    this.degradationHandlers.set(name, handler);
  }

  /**
   * 设置降级通知处理器
   */
  setNotificationHandler(handler: (scenario: AIScenario, reason: string) => void): void {
    this.notificationHandler = handler;
  }

  /**
   * 执行降级
   */
  async degrade<T = unknown>(
    scenario: AIScenario,
    input: Record<string, unknown>,
    reason: string
  ): Promise<DegradationResult<T>> {
    // 发送通知
    const config = this.getDegradationConfig(scenario);
    if (config.notifyOnDegradation && this.notificationHandler) {
      this.notificationHandler(scenario, reason);
    }

    // 尝试主要策略
    const strategies = [config.strategy, ...(config.fallbackStrategies || [])];

    for (const strategy of strategies) {
      const result = await this.tryStrategy<T>(scenario, strategy, input, config);
      if (result.success) {
        return result;
      }
    }

    // 所有策略都失败，返回默认响应
    return this.applyDefault<T>(scenario, reason);
  }

  /**
   * 尝试某个降级策略
   */
  private async tryStrategy<T>(
    scenario: AIScenario,
    strategy: DegradationStrategy,
    input: Record<string, unknown>,
    config: DegradationConfig
  ): Promise<DegradationResult<T>> {
    switch (strategy) {
      case 'rule-engine':
        return this.applyRuleEngine<T>(scenario, input);

      case 'template':
        return this.applyTemplate<T>(scenario, input, config);

      case 'cache':
        return this.applyCache<T>(scenario, input, config);

      case 'manual':
        return this.applyManual<T>(scenario, input);

      case 'default':
        return this.applyDefault<T>(scenario, 'fallback');

      case 'passthrough':
        return {
          success: false,
          source: 'passthrough',
          reason: 'No degradation available',
          confidence: 0,
        };

      default: {
        // 检查是否有自定义处理器
        const handler = this.degradationHandlers.get(strategy);
        if (handler) {
          return handler(input) as Promise<DegradationResult<T>>;
        }
        return {
          success: false,
          source: strategy,
          reason: `Unknown strategy: ${strategy}`,
          confidence: 0,
        };
      }
    }
  }

  /**
   * 应用规则引擎策略
   */
  private applyRuleEngine<T>(
    scenario: AIScenario,
    input: Record<string, unknown>
  ): DegradationResult<T> {
    try {
      const result = this.ruleEngine.execute<T>(scenario, input);
      return {
        ...result,
        source: 'rule-engine',
      };
    } catch (error) {
      return {
        success: false,
        source: 'rule-engine',
        reason: error instanceof Error ? error.message : 'Rule engine error',
        confidence: 0,
      };
    }
  }

  /**
   * 应用模板策略
   */
  private applyTemplate<T>(
    scenario: AIScenario,
    input: Record<string, unknown>,
    config: DegradationConfig
  ): DegradationResult<T> {
    const templateName = config.templateName || `${scenario}-template`;

    // 模板处理（简化实现）
    const templateData = this.renderTemplate(templateName, input);

    return {
      success: true,
      data: templateData as T,
      source: 'template',
      reason: `Applied template: ${templateName}`,
      confidence: 0.5,
    };
  }

  /**
   * 应用缓存策略
   */
  private applyCache<T>(
    scenario: AIScenario,
    input: Record<string, unknown>,
    config: DegradationConfig
  ): DegradationResult<T> {
    const cacheKey = this.getCacheKey(scenario, input);
    const cached = this.resultCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.result,
        source: 'cache',
        cachedAt: new Date(cached.expiresAt - (config.cacheTTL || 300000)),
      } as DegradationResult<T>;
    }

    return {
      success: false,
      source: 'cache',
      reason: 'No cached result available',
      confidence: 0,
    };
  }

  /**
   * 应用人工确认策略
   */
  private applyManual<T>(
    scenario: AIScenario,
    input: Record<string, unknown>
  ): DegradationResult<T> {
    // 返回需要人工确认的结果
    return {
      success: true,
      data: {
        requiresManualAction: true,
        scenario,
        input,
        message: 'AI 服务不可用，需要人工处理',
        priority: AI_SCENARIO_PRIORITY[scenario],
      } as T,
      source: 'manual',
      reason: 'Requires manual confirmation',
      confidence: 0.3,
      requiresManualAction: true,
    };
  }

  /**
   * 应用默认策略
   */
  private applyDefault<T>(scenario: AIScenario, reason: string): DegradationResult<T> {
    const defaultResponse = DEFAULT_RESPONSES[scenario] || { fallback: true };

    return {
      success: true,
      data: defaultResponse as T,
      source: 'default',
      reason,
      confidence: 0.3,
    };
  }

  /**
   * 渲染模板
   */
  private renderTemplate(templateName: string, input: Record<string, unknown>): Record<string, unknown> {
    // 使用规则引擎的模板功能
    const result = this.ruleEngine.execute(this.scenarioFromTemplate(templateName), input);
    return result.data as Record<string, unknown> || { template: templateName };
  }

  /**
   * 从模板名称推断场景（简化实现）
   */
  private scenarioFromTemplate(templateName: string): AIScenario {
    // 模板名称通常包含场景标识
    const templateToScenario: Record<string, AIScenario> = {
      'changelog-feature': 'changelog-generation',
      'changelog-fix': 'changelog-generation',
      'changelog-default': 'changelog-generation',
      'incident-summary': 'incident-summary',
      'knowledge-extraction': 'knowledge-extraction',
    };

    return templateToScenario[templateName] || 'changelog-generation';
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(scenario: AIScenario, input: Record<string, unknown>): string {
    // 使用关键字段生成缓存键
    const keyFields = ['id', 'serviceId', 'incidentId', 'changeId', 'alertId'];
    const keyParts: string[] = [scenario];

    for (const field of keyFields) {
      if (input[field]) {
        keyParts.push(String(input[field]));
      }
    }

    return keyParts.join(':');
  }

  /**
   * 缓存结果
   */
  cacheResult(scenario: AIScenario, input: Record<string, unknown>, result: DegradationResult, ttl?: number): void {
    const cacheKey = this.getCacheKey(scenario, input);
    const effectiveTTL = ttl || this.degradationConfigs.get(scenario)?.cacheTTL || 300000;

    this.resultCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + effectiveTTL,
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.resultCache.clear();
  }

  /**
   * 清除特定场景的缓存
   */
  clearScenarioCache(scenario: AIScenario): void {
    for (const [key] of this.resultCache) {
      if (key.startsWith(scenario)) {
        this.resultCache.delete(key);
      }
    }
  }

  /**
   * 获取降级统计
   */
  getStats(): {
    cacheSize: number;
    configuredScenarios: number;
    availableStrategies: string[];
  } {
    return {
      cacheSize: this.resultCache.size,
      configuredScenarios: this.degradationConfigs.size,
      availableStrategies: ['rule-engine', 'template', 'cache', 'manual', 'default', 'passthrough'],
    };
  }

  /**
   * 获取规则引擎实例
   */
  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }
}