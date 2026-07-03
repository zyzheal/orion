/**
 * 规则引擎 - AI 降级规则处理
 *
 * 功能：
 * 1. 规则定义和管理
 * 2. 规则匹配和执行
 * 3. 预置 16 个场景的降级规则
 */

import {
  AIScenario,
  Rule,
  RuleCondition,
  RuleAction,
  RuleSet,
  RuleEngineConfig,
  DegradationResult,
  AI_SCENARIO_PRIORITY,
} from './types';
import { OrionError, ErrorCode } from '../../errors';
import { RuleEngineRuleSetRepository } from '../../repositories/RuleEngineRuleSetRepository';
import { RuleEngineAuditLogRepository } from '../../repositories/RuleEngineAuditLogRepository';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// 默认配置
const DEFAULT_CONFIG: RuleEngineConfig = {
  cacheEnabled: true,
  cacheTTL: 300000, // 5 分钟缓存
  maxRulesPerScenario: 50,
  enableAudit: true,
};

/**
 * 规则引擎核心
 */
export class RuleEngine {
  private config: RuleEngineConfig;
  private ruleSets: Map<string, RuleSet> = new Map();
  private resultCache: Map<string, { result: DegradationResult; expiresAt: number }> = new Map();
  private auditLog: Array<{
    timestamp: Date;
    scenario: AIScenario;
    ruleId?: string;
    input: Record<string, unknown>;
    result: DegradationResult;
  }> = [];

  // Repositories (optional, for PostgreSQL persistence)
  private ruleSetRepo: RuleEngineRuleSetRepository | null = null;
  private auditLogRepo: RuleEngineAuditLogRepository | null = null;

  constructor(
    config: Partial<RuleEngineConfig> = {},
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize repositories if db is provided
    if (db) {
      this.ruleSetRepo = new RuleEngineRuleSetRepository(db);
      this.auditLogRepo = new RuleEngineAuditLogRepository(db);
    }

    this.initializeBuiltInRules();
  }

  /**
   * 从数据库恢复规则集状态（启动时调用）
   */
  async restoreState(): Promise<void> {
    if (!this.ruleSetRepo) return;

    try {
      const entities = await this.ruleSetRepo.listAll();
      for (const entity of entities) {
        const ruleSet: RuleSet = {
          id: entity.id,
          name: entity.name,
          scenario: entity.scenario as AIScenario,
          description: entity.description || '',
          rules: (entity.rules_json as unknown as Rule[]) ?? [],
          defaultAction: entity.default_action as unknown as RuleAction | undefined,
          enabled: entity.enabled,
        };
        this.ruleSets.set(entity.scenario, ruleSet);
      }
      logger.info({ msg: 'RuleEngine state restored from DB', ruleSetCount: entities.length });
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to restore RuleEngine state from DB', error });
    }
  }

  /**
   * 初始化内置规则
   */
  private initializeBuiltInRules(): void {
    // P0 场景规则
    this.addRuleSet(this.createAegisRiskAssessmentRules());
    this.addRuleSet(this.createAutoSchedulingRules());
    this.addRuleSet(this.createRootCauseDiagnosisRules());

    // P1 场景规则
    this.addRuleSet(this.createCodeReviewRules());
    this.addRuleSet(this.createTestSelectionRules());
    this.addRuleSet(this.createChangelogGenerationRules());
    this.addRuleSet(this.createIncidentSummaryRules());
    this.addRuleSet(this.createRunbookSuggestionRules());
    this.addRuleSet(this.createMetricAnomalyDetectionRules());
    this.addRuleSet(this.createLogPatternAnalysisRules());
    this.addRuleSet(this.createDependencyAnalysisRules());
    this.addRuleSet(this.createCapacityForecastRules());
    this.addRuleSet(this.createSLAPredictionRules());
    this.addRuleSet(this.createKnowledgeExtractionRules());
    this.addRuleSet(this.createAlertCorrelationRules());
    this.addRuleSet(this.createAutomationSuggestionRules());
  }

  // ==================== P0 场景规则 ====================

  /**
   * Aegis 风险评估规则
   */
  private createAegisRiskAssessmentRules(): RuleSet {
    return {
      id: 'aegis-risk-assessment-rules',
      name: 'Aegis 风险评估降级规则',
      scenario: 'aegis-risk-assessment',
      description: '当 AI 不可用时，使用规则引擎进行风险评估',
      enabled: true,
      rules: [
        {
          id: 'risk-high-critical-assets',
          name: '关键资产高风险',
          scenario: 'aegis-risk-assessment',
          description: '涉及关键资产的变更自动标记为高风险',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'affectedAssets', operator: 'contains', value: 'production' },
            { field: 'changeType', operator: 'in', value: ['deployment', 'config-change', 'rollback'] },
          ],
          actions: [
            { type: 'set', field: 'riskLevel', value: 'high' },
            { type: 'set', field: 'requiresApproval', value: true },
            { type: 'set', field: 'recommendation', value: '需要变更委员会审批' },
          ],
        },
        {
          id: 'risk-medium-modular-change',
          name: '模块级变更中风险',
          scenario: 'aegis-risk-assessment',
          description: '模块级变更标记为中风险',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'changeScope', operator: 'eq', value: 'module' },
            { field: 'affectedAssets', operator: 'nin', value: ['production'] },
          ],
          actions: [
            { type: 'set', field: 'riskLevel', value: 'medium' },
            { type: 'set', field: 'requiresApproval', value: true },
            { type: 'set', field: 'recommendation', value: '需要技术负责人审批' },
          ],
        },
        {
          id: 'risk-low-routine-change',
          name: '常规变更低风险',
          scenario: 'aegis-risk-assessment',
          description: '常规运维变更标记为低风险',
          priority: 3,
          enabled: true,
          conditions: [
            { field: 'changeType', operator: 'in', value: ['patch', 'hotfix', 'config-update'] },
            { field: 'changeScope', operator: 'eq', value: 'single-instance' },
          ],
          actions: [
            { type: 'set', field: 'riskLevel', value: 'low' },
            { type: 'set', field: 'requiresApproval', value: false },
            { type: 'set', field: 'recommendation', value: '可自动执行' },
          ],
        },
        {
          id: 'risk-history-pattern',
          name: '历史模式匹配',
          scenario: 'aegis-risk-assessment',
          description: '基于历史数据的风险评估',
          priority: 10,
          enabled: true,
          conditions: [
            { field: 'historicalData', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'evaluateHistoricalRisk' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'riskLevel', value: 'medium' },
    };
  }

  /**
   * AI 自动排单规则
   */
  private createAutoSchedulingRules(): RuleSet {
    return {
      id: 'auto-scheduling-rules',
      name: '自动排单降级规则',
      scenario: 'auto-scheduling',
      description: '当 AI 排单不可用时，使用规则匹配',
      enabled: true,
      rules: [
        {
          id: 'schedule-priority-urgent',
          name: '紧急工单优先',
          scenario: 'auto-scheduling',
          description: 'P0 工单立即分配',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'priority', operator: 'eq', value: 'P0' },
          ],
          actions: [
            { type: 'set', field: 'assignedTeam', value: 'oncall-team' },
            { type: 'set', field: 'sla', value: '15m' },
            { type: 'set', field: 'escalationPolicy', value: 'immediate' },
          ],
        },
        {
          id: 'schedule-expertise-match',
          name: '专业技能匹配',
          scenario: 'auto-scheduling',
          description: '根据工单类型匹配专业团队',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'category', operator: 'in', value: ['database', 'network', 'security', 'application'] },
          ],
          actions: [
            { type: 'function', functionName: 'matchByExpertise' },
          ],
        },
        {
          id: 'schedule-round-robin',
          name: '轮询分配',
          scenario: 'auto-scheduling',
          description: '普通工单轮询分配',
          priority: 100,
          enabled: true,
          conditions: [
            { field: 'priority', operator: 'in', value: ['P2', 'P3', 'P4'] },
          ],
          actions: [
            { type: 'function', functionName: 'roundRobinAssignment' },
          ],
        },
        {
          id: 'schedule-random-fallback',
          name: '随机分配',
          scenario: 'auto-scheduling',
          description: '无匹配规则时随机分配',
          priority: 1000,
          enabled: true,
          conditions: [],
          actions: [
            { type: 'function', functionName: 'randomAssignment' },
          ],
        },
      ],
      defaultAction: { type: 'function', functionName: 'randomAssignment' },
    };
  }

  /**
   * 根因诊断规则
   */
  private createRootCauseDiagnosisRules(): RuleSet {
    return {
      id: 'root-cause-diagnosis-rules',
      name: '根因诊断降级规则',
      scenario: 'root-cause-diagnosis',
      description: '当 AI 诊断不可用时，使用规则定位',
      enabled: true,
      rules: [
        {
          id: 'diagnosis-db-error',
          name: '数据库错误诊断',
          scenario: 'root-cause-diagnosis',
          description: '数据库相关错误的诊断规则',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'errorType', operator: 'regex', value: '(connection refused|timeout|deadlock|lock wait)' },
          ],
          actions: [
            { type: 'set', field: 'rootCause', value: 'database_issue' },
            { type: 'set', field: 'diagnosis', value: '数据库连接或锁问题' },
            { type: 'set', field: 'recommendation', value: '检查数据库连接池、锁等待、慢查询' },
            { type: 'set', field: 'requiresHumanConfirmation', value: true },
          ],
        },
        {
          id: 'diagnosis-memory-error',
          name: '内存错误诊断',
          scenario: 'root-cause-diagnosis',
          description: '内存相关错误的诊断规则',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'errorType', operator: 'regex', value: '(OOM|out of memory|heap|memory)' },
          ],
          actions: [
            { type: 'set', field: 'rootCause', value: 'memory_issue' },
            { type: 'set', field: 'diagnosis', value: '内存不足或内存泄漏' },
            { type: 'set', field: 'recommendation', value: '检查内存使用、内存泄漏、JVM堆配置' },
            { type: 'set', field: 'requiresHumanConfirmation', value: true },
          ],
        },
        {
          id: 'diagnosis-network-error',
          name: '网络错误诊断',
          scenario: 'root-cause-diagnosis',
          description: '网络相关错误的诊断规则',
          priority: 3,
          enabled: true,
          conditions: [
            { field: 'errorType', operator: 'regex', value: '(connection reset|timeout|refused|network)' },
          ],
          actions: [
            { type: 'set', field: 'rootCause', value: 'network_issue' },
            { type: 'set', field: 'diagnosis', value: '网络连接问题' },
            { type: 'set', field: 'recommendation', value: '检查网络连通性、防火墙、DNS解析' },
            { type: 'set', field: 'requiresHumanConfirmation', value: true },
          ],
        },
        {
          id: 'diagnosis-service-unavailable',
          name: '服务不可用诊断',
          scenario: 'root-cause-diagnosis',
          description: '服务不可用的诊断规则',
          priority: 4,
          enabled: true,
          conditions: [
            { field: 'errorType', operator: 'regex', value: '(503|502|service unavailable|no healthy upstream)' },
          ],
          actions: [
            { type: 'set', field: 'rootCause', value: 'service_unavailable' },
            { type: 'set', field: 'diagnosis', value: '下游服务不可用' },
            { type: 'set', field: 'recommendation', value: '检查下游服务健康状态、负载均衡配置' },
            { type: 'set', field: 'requiresHumanConfirmation', value: true },
          ],
        },
        {
          id: 'diagnosis-manual-required',
          name: '需要人工确认',
          scenario: 'root-cause-diagnosis',
          description: '所有诊断结果需要人工确认',
          priority: 1000,
          enabled: true,
          conditions: [],
          actions: [
            { type: 'set', field: 'requiresHumanConfirmation', value: true },
            { type: 'set', field: 'confidence', value: 0.6 },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'requiresHumanConfirmation', value: true },
    };
  }

  // ==================== P1 场景规则 ====================

  /**
   * AI Code Review 规则
   */
  private createCodeReviewRules(): RuleSet {
    return {
      id: 'code-review-rules',
      name: 'Code Review 降级规则',
      scenario: 'code-review',
      description: '使用静态规则进行代码审查',
      enabled: true,
      rules: [
        {
          id: 'review-large-change',
          name: '大型变更检查',
          scenario: 'code-review',
          description: '检查大型变更',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'linesChanged', operator: 'gt', value: 500 },
          ],
          actions: [
            { type: 'set', field: 'warnings', value: ['变更较大，建议拆分为多个PR'] },
            { type: 'set', field: 'requiresMultipleReviewers', value: true },
          ],
        },
        {
          id: 'review-security-patterns',
          name: '安全模式检查',
          scenario: 'code-review',
          description: '检查常见安全问题',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'filePattern', operator: 'regex', value: '(password|secret|token|key)' },
          ],
          actions: [
            { type: 'set', field: 'warnings', value: ['可能包含敏感信息，请检查'] },
            { type: 'set', field: 'requiresSecurityReview', value: true },
          ],
        },
        {
          id: 'review-test-coverage',
          name: '测试覆盖检查',
          scenario: 'code-review',
          description: '检查测试覆盖',
          priority: 3,
          enabled: true,
          conditions: [
            { field: 'hasTests', operator: 'eq', value: false },
            { field: 'linesChanged', operator: 'gt', value: 50 },
          ],
          actions: [
            { type: 'set', field: 'warnings', value: ['建议添加单元测试'] },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'passed', value: true },
    };
  }

  /**
   * 智能测试选择规则
   */
  private createTestSelectionRules(): RuleSet {
    return {
      id: 'test-selection-rules',
      name: '测试选择降级规则',
      scenario: 'test-selection',
      description: '降级到全量测试',
      enabled: true,
      rules: [
        {
          id: 'test-all-critical',
          name: '关键变更全量测试',
          scenario: 'test-selection',
          description: '关键变更执行全量测试',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'changeType', operator: 'in', value: ['hotfix', 'release', 'config-change'] },
          ],
          actions: [
            { type: 'set', field: 'testStrategy', value: 'full' },
            { type: 'set', field: 'reason', value: '关键变更需要全量测试验证' },
          ],
        },
        {
          id: 'test-smoke-routine',
          name: '常规变更冒烟测试',
          scenario: 'test-selection',
          description: '常规变更执行冒烟测试',
          priority: 10,
          enabled: true,
          conditions: [
            { field: 'changeType', operator: 'in', value: ['feature', 'refactor', 'docs'] },
          ],
          actions: [
            { type: 'set', field: 'testStrategy', value: 'smoke' },
            { type: 'set', field: 'reason', value: '常规变更执行冒烟测试' },
          ],
        },
        {
          id: 'test-full-fallback',
          name: '默认全量测试',
          scenario: 'test-selection',
          description: '无法判断时执行全量测试',
          priority: 100,
          enabled: true,
          conditions: [],
          actions: [
            { type: 'set', field: 'testStrategy', value: 'full' },
            { type: 'set', field: 'reason', value: '降级模式：执行全量测试确保质量' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'testStrategy', value: 'full' },
    };
  }

  /**
   * 变更日志生成规则
   */
  private createChangelogGenerationRules(): RuleSet {
    return {
      id: 'changelog-generation-rules',
      name: '变更日志生成规则',
      scenario: 'changelog-generation',
      description: '使用模板生成变更日志',
      enabled: true,
      rules: [
        {
          id: 'changelog-feature',
          name: '特性变更模板',
          scenario: 'changelog-generation',
          description: '特性变更的日志模板',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'changeType', operator: 'eq', value: 'feature' },
          ],
          actions: [
            { type: 'template', templateName: 'changelog-feature' },
          ],
        },
        {
          id: 'changelog-fix',
          name: '修复变更模板',
          scenario: 'changelog-generation',
          description: '修复变更的日志模板',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'changeType', operator: 'eq', value: 'fix' },
          ],
          actions: [
            { type: 'template', templateName: 'changelog-fix' },
          ],
        },
        {
          id: 'changelog-default',
          name: '默认模板',
          scenario: 'changelog-generation',
          description: '默认变更日志模板',
          priority: 100,
          enabled: true,
          conditions: [],
          actions: [
            { type: 'template', templateName: 'changelog-default' },
          ],
        },
      ],
      defaultAction: { type: 'template', templateName: 'changelog-default' },
    };
  }

  /**
   * 事件摘要规则
   */
  private createIncidentSummaryRules(): RuleSet {
    return {
      id: 'incident-summary-rules',
      name: '事件摘要生成规则',
      scenario: 'incident-summary',
      description: '基于模板生成事件摘要',
      enabled: true,
      rules: [
        {
          id: 'summary-template',
          name: '事件摘要模板',
          scenario: 'incident-summary',
          description: '使用模板生成摘要',
          priority: 1,
          enabled: true,
          conditions: [],
          actions: [
            { type: 'template', templateName: 'incident-summary' },
          ],
        },
      ],
      defaultAction: { type: 'template', templateName: 'incident-summary' },
    };
  }

  /**
   * Runbook 建议规则
   */
  private createRunbookSuggestionRules(): RuleSet {
    return {
      id: 'runbook-suggestion-rules',
      name: 'Runbook 建议规则',
      scenario: 'runbook-suggestion',
      description: '基于告警类型匹配 Runbook',
      enabled: true,
      rules: [
        {
          id: 'runbook-alert-match',
          name: '告警类型匹配',
          scenario: 'runbook-suggestion',
          description: '根据告警类型推荐 Runbook',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'alertType', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'matchRunbookByAlert' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'suggestion', value: '请查阅运维手册或联系值班人员' },
    };
  }

  /**
   * 指标异常检测规则
   */
  private createMetricAnomalyDetectionRules(): RuleSet {
    return {
      id: 'metric-anomaly-rules',
      name: '指标异常检测规则',
      scenario: 'metric-anomaly-detection',
      description: '基于阈值的异常检测',
      enabled: true,
      rules: [
        {
          id: 'anomaly-threshold',
          name: '阈值异常检测',
          scenario: 'metric-anomaly-detection',
          description: '超过阈值判定为异常',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'threshold', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'checkThresholdAnomaly' },
          ],
        },
        {
          id: 'anomaly-rate-change',
          name: '变化率异常',
          scenario: 'metric-anomaly-detection',
          description: '变化率超过阈值',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'changeRate', operator: 'gt', value: 0.5 },
          ],
          actions: [
            { type: 'set', field: 'isAnomaly', value: true },
            { type: 'set', field: 'severity', value: 'medium' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'isAnomaly', value: false },
    };
  }

  /**
   * 日志模式分析规则
   */
  private createLogPatternAnalysisRules(): RuleSet {
    return {
      id: 'log-pattern-rules',
      name: '日志模式分析规则',
      scenario: 'log-pattern-analysis',
      description: '基于规则的日志模式识别',
      enabled: true,
      rules: [
        {
          id: 'log-error-pattern',
          name: '错误日志模式',
          scenario: 'log-pattern-analysis',
          description: '识别错误日志模式',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'logLevel', operator: 'in', value: ['ERROR', 'FATAL', 'CRITICAL'] },
          ],
          actions: [
            { type: 'set', field: 'pattern', value: 'error' },
            { type: 'set', field: 'requiresAttention', value: true },
          ],
        },
        {
          id: 'log-warning-pattern',
          name: '警告日志模式',
          scenario: 'log-pattern-analysis',
          description: '识别警告日志模式',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'logLevel', operator: 'eq', value: 'WARN' },
          ],
          actions: [
            { type: 'set', field: 'pattern', value: 'warning' },
            { type: 'set', field: 'requiresAttention', value: false },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'pattern', value: 'normal' },
    };
  }

  /**
   * 依赖分析规则
   */
  private createDependencyAnalysisRules(): RuleSet {
    return {
      id: 'dependency-analysis-rules',
      name: '依赖分析规则',
      scenario: 'dependency-analysis',
      description: '基于 CMDB 数据的依赖分析',
      enabled: true,
      rules: [
        {
          id: 'dep-cmdb-lookup',
          name: 'CMDB 依赖查询',
          scenario: 'dependency-analysis',
          description: '从 CMDB 查询依赖关系',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'serviceId', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'lookupDependenciesFromCMDB' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'dependencies', value: [] },
    };
  }

  /**
   * 容量预测规则
   */
  private createCapacityForecastRules(): RuleSet {
    return {
      id: 'capacity-forecast-rules',
      name: '容量预测规则',
      scenario: 'capacity-forecast',
      description: '基于线性预测的容量估算',
      enabled: true,
      rules: [
        {
          id: 'forecast-linear',
          name: '线性预测',
          scenario: 'capacity-forecast',
          description: '使用线性模型预测',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'historicalData', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'linearForecast' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'forecast', value: 'insufficient_data' },
    };
  }

  /**
   * SLA 预测规则
   */
  private createSLAPredictionRules(): RuleSet {
    return {
      id: 'sla-prediction-rules',
      name: 'SLA 预测规则',
      scenario: 'sla-prediction',
      description: '基于历史数据的 SLA 预测',
      enabled: true,
      rules: [
        {
          id: 'sla-historical',
          name: '历史 SLA 计算',
          scenario: 'sla-prediction',
          description: '基于历史 SLA 数据预测',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'serviceId', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'calculateHistoricalSLA' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'slaPrediction', value: 'unknown' },
    };
  }

  /**
   * 知识提取规则
   */
  private createKnowledgeExtractionRules(): RuleSet {
    return {
      id: 'knowledge-extraction-rules',
      name: '知识提取规则',
      scenario: 'knowledge-extraction',
      description: '基于规则的知识提取',
      enabled: true,
      rules: [
        {
          id: 'knowledge-template',
          name: '模板提取',
          scenario: 'knowledge-extraction',
          description: '使用模板提取知识',
          priority: 1,
          enabled: true,
          conditions: [],
          actions: [
            { type: 'template', templateName: 'knowledge-extraction' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'extracted', value: false },
    };
  }

  /**
   * 告警关联规则
   */
  private createAlertCorrelationRules(): RuleSet {
    return {
      id: 'alert-correlation-rules',
      name: '告警关联规则',
      scenario: 'alert-correlation',
      description: '基于规则的告警关联',
      enabled: true,
      rules: [
        {
          id: 'alert-time-window',
          name: '时间窗口关联',
          scenario: 'alert-correlation',
          description: '同一时间窗口的告警关联',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'timeWindow', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'correlateByTimeWindow' },
          ],
        },
        {
          id: 'alert-service-group',
          name: '服务组关联',
          scenario: 'alert-correlation',
          description: '同一服务组的告警关联',
          priority: 2,
          enabled: true,
          conditions: [
            { field: 'serviceGroup', operator: 'exists', value: true },
          ],
          actions: [
            { type: 'function', functionName: 'correlateByServiceGroup' },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'correlationId', value: null },
    };
  }

  /**
   * 自动化建议规则
   */
  private createAutomationSuggestionRules(): RuleSet {
    return {
      id: 'automation-suggestion-rules',
      name: '自动化建议规则',
      scenario: 'automation-suggestion',
      description: '基于规则生成自动化建议',
      enabled: true,
      rules: [
        {
          id: 'automation-repeated-task',
          name: '重复任务检测',
          scenario: 'automation-suggestion',
          description: '检测可自动化的重复任务',
          priority: 1,
          enabled: true,
          conditions: [
            { field: 'taskFrequency', operator: 'gt', value: 5 },
          ],
          actions: [
            { type: 'set', field: 'suggestion', value: '建议将此任务自动化' },
            { type: 'set', field: 'automationCandidate', value: true },
          ],
        },
      ],
      defaultAction: { type: 'set', field: 'suggestion', value: '暂无自动化建议' },
    };
  }

  // ==================== 规则引擎核心方法 ====================

  /**
   * 添加规则集
   */
  addRuleSet(ruleSet: RuleSet): void {
    this.ruleSets.set(ruleSet.scenario, ruleSet);

    // Persist to DB if available
    if (this.ruleSetRepo) {
      this.ruleSetRepo.upsertByScenario({
        id: ruleSet.id,
        scenario: ruleSet.scenario,
        name: ruleSet.name,
        description: ruleSet.description,
        rulesJson: ruleSet.rules as unknown as unknown[],
        defaultAction: ruleSet.defaultAction as unknown as Record<string, unknown>,
        enabled: ruleSet.enabled,
      }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist rule set', error: err }));
    }
  }

  /**
   * 获取规则集
   */
  getRuleSet(scenario: AIScenario): RuleSet | undefined {
    return this.ruleSets.get(scenario);
  }

  /**
   * 添加规则到场景
   */
  addRule(scenario: AIScenario, rule: Rule): void {
    const ruleSet = this.ruleSets.get(scenario);
    if (!ruleSet) {
      throw new OrionError(`RuleSet not found for scenario: ${scenario}`, ErrorCode.NOT_FOUND);
    }
    if (ruleSet.rules.length >= this.config.maxRulesPerScenario) {
      throw new OrionError(`Max rules reached for scenario: ${scenario}`, 'OPERATION_FAILED')
    }
    ruleSet.rules.push(rule);
    ruleSet.rules.sort((a, b) => a.priority - b.priority);

    // Persist to DB if available
    if (this.ruleSetRepo) {
      this.ruleSetRepo.upsertByScenario({
        id: ruleSet.id,
        scenario: ruleSet.scenario,
        name: ruleSet.name,
        description: ruleSet.description,
        rulesJson: ruleSet.rules as unknown as unknown[],
        defaultAction: ruleSet.defaultAction as unknown as Record<string, unknown>,
        enabled: ruleSet.enabled,
      }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist rule set', error: err }));
    }
  }

  /**
   * 执行规则
   */
  execute<T = unknown>(scenario: AIScenario, input: Record<string, unknown>): DegradationResult<T> {
    // 检查缓存
    if (this.config.cacheEnabled) {
      const cacheKey = this.getCacheKey(scenario, input);
      const cached = this.resultCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          ...cached.result,
          source: 'cache' as const,
        } as DegradationResult<T>;
      }
    }

    const ruleSet = this.ruleSets.get(scenario);
    if (!ruleSet || !ruleSet.enabled) {
      return this.createDefaultResult<T>(scenario, 'No ruleset found or disabled');
    }

    // 匹配规则
    const matchedRule = this.findMatchingRule(ruleSet.rules, input);

    // 执行动作
    const result = this.executeRule<T>(scenario, matchedRule, input, ruleSet.defaultAction);

    // 审计日志
    if (this.config.enableAudit) {
      this.auditLog.push({
        timestamp: new Date(),
        scenario,
        ruleId: matchedRule?.id,
        input,
        result,
      });

      // Persist audit log to DB
      if (this.auditLogRepo) {
        this.auditLogRepo.create({
          id: `${scenario}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          scenario,
          rule_id: matchedRule?.id || null,
          input_json: input,
          result_json: result as unknown as Record<string, unknown>,
          event_time: new Date(),
        }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist audit log', error: err }));
      }
    }

    // 缓存结果
    if (this.config.cacheEnabled && result.success) {
      const cacheKey = this.getCacheKey(scenario, input);
      this.resultCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.config.cacheTTL,
      });
    }

    return result;
  }

  /**
   * 查找匹配的规则
   */
  private findMatchingRule(rules: Rule[], input: Record<string, unknown>): Rule | undefined {
    // 按优先级排序
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      const allConditionsMet = rule.conditions.every((condition) =>
        this.evaluateCondition(condition, input)
      );

      if (allConditionsMet) {
        return rule;
      }
    }

    return undefined;
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: RuleCondition, input: Record<string, unknown>): boolean {
    const fieldValue = this.getNestedValue(input, condition.field);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;

      case 'neq':
        return fieldValue !== condition.value;

      case 'gt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;

      case 'gte':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;

      case 'lt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;

      case 'lte':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);

      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

      case 'contains':
        // 支持数组包含检查和字符串包含检查
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value));

      case 'regex':
        if (typeof fieldValue !== 'string') return false;
        try {
          const regex = new RegExp(String(condition.value), 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }

      case 'exists':
        return condition.value ? fieldValue !== undefined : fieldValue === undefined;

      case 'nexists':
        return condition.value ? fieldValue === undefined : fieldValue !== undefined;

      default:
        return false;
    }
  }

  /**
   * 获取嵌套字段值
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * 执行规则动作
   */
  private executeRule<T>(
    scenario: AIScenario,
    rule: Rule | undefined,
    input: Record<string, unknown>,
    defaultAction?: RuleAction
  ): DegradationResult<T> {
    const result: DegradationResult = {
      success: true,
      data: { ...input },
      source: 'rule-engine',
      reason: rule ? `Matched rule: ${rule.name}` : 'Default action applied',
      confidence: 0.7, // 规则引擎默认置信度
      appliedRule: rule?.id,
    };

    const actions = rule?.actions || (defaultAction ? [defaultAction] : []);

    for (const action of actions) {
      this.applyAction(result, action, input);
    }

    return result as DegradationResult<T>;
  }

  /**
   * 应用动作
   */
  private applyAction(
    result: DegradationResult,
    action: RuleAction,
    input: Record<string, unknown>
  ): void {
    switch (action.type) {
      case 'set':
        if (action.field && result.data) {
          (result.data as Record<string, unknown>)[action.field] = action.value;
        }
        break;

      case 'template':
        result.data = this.applyTemplate(action.templateName || 'default', input);
        break;

      case 'function':
        result.data = this.executeFunction(action.functionName || '', input);
        break;

      case 'return':
        result.data = action.value;
        break;
    }
  }

  /**
   * 应用模板
   */
  private applyTemplate(templateName: string, input: Record<string, unknown>): Record<string, unknown> {
    // 简化版模板实现
    const templates: Record<string, (input: Record<string, unknown>) => Record<string, unknown>> = {
      'changelog-feature': (input) => ({
        title: `Feature: ${input.description || 'New feature'}`,
        type: 'feature',
        impact: 'low',
      }),
      'changelog-fix': (input) => ({
        title: `Fix: ${input.description || 'Bug fix'}`,
        type: 'fix',
        impact: 'medium',
      }),
      'changelog-default': (input) => ({
        title: `${input.changeType || 'Change'}: ${input.description || 'Update'}`,
        type: input.changeType || 'change',
        impact: 'low',
      }),
      'incident-summary': (input) => ({
        summary: `Incident ${input.incidentId || ''}: ${input.title || 'Unknown incident'}`,
        status: input.status || 'investigating',
        impact: input.impact || 'unknown',
      }),
      'knowledge-extraction': (input) => ({
        extracted: true,
        title: input.title || 'Untitled',
        content: input.content || '',
        tags: input.tags || [],
      }),
    };

    const templateFn = templates[templateName] || templates['changelog-default'];
    return templateFn(input);
  }

  /**
   * 执行函数
   */
  private executeFunction(functionName: string, input: Record<string, unknown>): Record<string, unknown> {
    // 简化版函数实现
    const functions: Record<string, (input: Record<string, unknown>) => Record<string, unknown>> = {
      evaluateHistoricalRisk: (input) => ({
        riskLevel: (input.historicalData as Record<string, unknown>)?.avgRisk || 'medium',
        confidence: 0.8,
        basedOn: 'historical_data',
      }),
      matchByExpertise: (input) => {
        const categoryToTeam: Record<string, string> = {
          database: 'db-team',
          network: 'network-team',
          security: 'security-team',
          application: 'app-team',
        };
        return {
          assignedTeam: categoryToTeam[input.category as string] || 'general-team',
          matchedBy: 'expertise',
        };
      },
      roundRobinAssignment: (input) => ({
        assignedTeam: 'team-' + (Date.now() % 5 + 1),
        strategy: 'round_robin',
      }),
      randomAssignment: (input) => ({
        assignedTeam: 'team-' + Math.floor(Math.random() * 5 + 1),
        strategy: 'random',
      }),
      matchRunbookByAlert: (input) => ({
        runbookId: `runbook-${input.alertType || 'general'}`,
        runbookUrl: `/runbooks/${input.alertType || 'general'}`,
      }),
      lookupDependenciesFromCMDB: (input) => ({
        dependencies: ['service-a', 'service-b', 'database-1'],
        source: 'cmdb',
      }),
      linearForecast: (input) => ({
        forecast: 'linear_projection',
        trend: 'increasing',
        confidence: 0.6,
      }),
      calculateHistoricalSLA: (input) => ({
        slaPrediction: 99.5,
        basedOn: 'historical_data',
        confidence: 0.75,
      }),
      correlateByTimeWindow: (input) => ({
        correlationId: `corr-${Date.now()}`,
        relatedAlerts: [],
      }),
      correlateByServiceGroup: (input) => ({
        correlationId: `corr-sg-${input.serviceGroup}`,
        relatedAlerts: [],
      }),
      checkThresholdAnomaly: (input) => {
        const value = typeof input.value === 'number' ? input.value : parseFloat(String(input.value)) || 0;
        const threshold = typeof input.threshold === 'number' ? input.threshold : parseFloat(String(input.threshold)) || 100;
        const isAnomaly = value > threshold;
        return {
          isAnomaly,
          severity: isAnomaly ? 'high' : 'normal',
          actualValue: value,
          threshold,
        };
      },
    };

    const fn = functions[functionName];
    if (fn) {
      return fn(input);
    }

    return { error: `Unknown function: ${functionName}` };
  }

  /**
   * 创建默认结果
   */
  private createDefaultResult<T>(scenario: AIScenario, reason: string): DegradationResult<T> {
    return {
      success: false,
      source: 'default',
      reason,
      confidence: 0,
      data: undefined,
    };
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(scenario: AIScenario, input: Record<string, unknown>): string {
    return `${scenario}:${JSON.stringify(input)}`;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.resultCache.clear();
  }

  /**
   * 获取审计日志
   */
  getAuditLog(): Array<{
    timestamp: Date;
    scenario: AIScenario;
    ruleId?: string;
    input: Record<string, unknown>;
    result: DegradationResult;
  }> {
    return [...this.auditLog];
  }

  /**
   * 获取所有规则集
   */
  getAllRuleSets(): RuleSet[] {
    return Array.from(this.ruleSets.values());
  }
}