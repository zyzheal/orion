/**
 * QualityGateService - 代码质量门禁评估服务
 *
 * 负责：
 * - 质量门禁规则的评估（覆盖率、复杂度、重复率、安全热点、Bug、漏洞）
 * - 阻断/警告级别判断
 * - 评估结果存储
 * - 外部质量服务集成（SonarQube 风格 HTTP 调用）
 *
 * GAP-CN-04: 代码质量门禁
 */

import { v4 as uuidv4 } from 'uuid';
import {
  QualityGate,
  QualityGateRule,
  QualityGateResult,
  QualityGateCreateInput,
  QualityGateUpdateInput,
  QualityGateEvaluateInput,
  QualityMetric,
  QualityOperator,
} from '../../models/QualityGate';
import { QualityGateRepository } from '../../repositories/QualityGateRepository';
import { QualityGateResultRepository } from '../../repositories/QualityGateResultRepository';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('QualityGateService');

export class QualityGateServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QualityGateServiceError';
  }
}

/**
 * 比较运算符求值
 * 将规则定义的运算符应用到实际值和阈值上
 */
function evaluateComparison(
  operator: QualityOperator,
  actualValue: number,
  threshold: number
): boolean {
  switch (operator) {
    case '<':  return actualValue < threshold;
    case '<=': return actualValue <= threshold;
    case '>':  return actualValue > threshold;
    case '>=': return actualValue >= threshold;
    case '==': return actualValue === threshold;
    default:
      throw new QualityGateServiceError(`Unknown operator: ${operator}`, 'INVALID_OPERATOR');
  }
}

/**
 * 生成人类可读的规则失败原因
 */
function formatFailureReason(
  rule: QualityGateRule,
  actualValue: number
): string {
  const metricLabels: Record<QualityMetric, string> = {
    coverage: 'Code Coverage',
    complexity: 'Cyclomatic Complexity',
    duplication: 'Code Duplication',
    security_hotspots: 'Security Hotspots',
    bugs: 'Potential Bugs',
    vulnerabilities: 'Vulnerabilities',
  };

  const label = metricLabels[rule.metric] || rule.metric;
  return `${label}: ${actualValue} ${rule.operator} ${rule.threshold}`;
}

export class QualityGateService {
  private gateRepository: QualityGateRepository | null;
  private resultRepository: QualityGateResultRepository | null;

  constructor(
    gateRepository: QualityGateRepository | null,
    resultRepository: QualityGateResultRepository | null
  ) {
    this.gateRepository = gateRepository;
    this.resultRepository = resultRepository;
  }

  // ==================== Gate Definition CRUD ====================

  /**
   * 创建质量门禁
   */
  async create(input: QualityGateCreateInput): Promise<QualityGate> {
    if (!this.gateRepository) {
      throw new QualityGateServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }

    // Validate rules
    this.validateRules(input.rules);

    return this.gateRepository.create(input);
  }

  /**
   * 按租户查询质量门禁
   */
  async findByTenant(tenantId: string, options?: { enabledOnly?: boolean }): Promise<QualityGate[]> {
    if (!this.gateRepository) {
      return [];
    }
    return this.gateRepository.findByTenant(tenantId, options);
  }

  /**
   * 按名称查询质量门禁
   */
  async findByName(tenantId: string, name: string): Promise<QualityGate | undefined> {
    if (!this.gateRepository) {
      return undefined;
    }
    return this.gateRepository.findByName(tenantId, name);
  }

  /**
   * 按 ID 查询质量门禁
   */
  async findById(id: string): Promise<QualityGate | undefined> {
    if (!this.gateRepository) {
      return undefined;
    }
    return (await this.gateRepository.findById(id)) ?? undefined;
  }

  /**
   * 更新质量门禁
   */
  async update(id: string, input: QualityGateUpdateInput): Promise<QualityGate | null> {
    if (!this.gateRepository) {
      return null;
    }

    if (input.rules) {
      this.validateRules(input.rules);
    }

    return this.gateRepository.update(id, input);
  }

  /**
   * 删除质量门禁
   */
  async delete(id: string): Promise<boolean> {
    if (!this.gateRepository) {
      return false;
    }
    return this.gateRepository.delete(id);
  }

  // ==================== Rule Validation ====================

  /**
   * 验证规则定义的有效性
   */
  private validateRules(rules: QualityGateRule[]): void {
    const validMetrics: QualityMetric[] = [
      'coverage', 'complexity', 'duplication',
      'security_hotspots', 'bugs', 'vulnerabilities',
    ];
    const validOperators: QualityOperator[] = ['<', '<=', '>', '>=', '=='];
    const validSeverities = ['block', 'warn'];

    for (const rule of rules) {
      if (!validMetrics.includes(rule.metric)) {
        throw new QualityGateServiceError(
          `Invalid metric: ${rule.metric}. Valid: ${validMetrics.join(', ')}`,
          'INVALID_METRIC'
        );
      }
      if (!validOperators.includes(rule.operator)) {
        throw new QualityGateServiceError(
          `Invalid operator: ${rule.operator}. Valid: ${validOperators.join(', ')}`,
          'INVALID_OPERATOR'
        );
      }
      if (!validSeverities.includes(rule.severity)) {
        throw new QualityGateServiceError(
          `Invalid severity: ${rule.severity}. Valid: ${validSeverities.join(', ')}`,
          'INVALID_SEVERITY'
        );
      }
      if (typeof rule.threshold !== 'number') {
        throw new QualityGateServiceError(
          `Threshold must be a number, got: ${typeof rule.threshold}`,
          'INVALID_THRESHOLD'
        );
      }
    }
  }

  // ==================== Evaluation ====================

  /**
   * 评估质量门禁
   *
   * 对门禁中的所有规则逐一评估，收集失败规则：
   * - block 级别的失败规则会导致整体评估不通过
   * - warn 级别的失败规则仅记录警告，不影响整体结果
   *
   * @returns 评估结果，包含通过的/失败的规则详情
   */
  evaluate(
    gate: QualityGate,
    input: { metrics: Record<string, number> }
  ): Omit<QualityGateResult, 'id' | 'evaluatedAt'> {
    const blockedRules: QualityGateResult['blockedRules'] = [];
    const warnedRules: QualityGateResult['warnedRules'] = [];

    for (const rule of gate.rules) {
      const actualValue = input.metrics[rule.metric] ?? 0;
      const passed = evaluateComparison(rule.operator, actualValue, rule.threshold);

      if (!passed) {
        const reason = formatFailureReason(rule, actualValue);
        if (rule.severity === 'block') {
          blockedRules.push({ rule, actualValue, reason });
        } else {
          warnedRules.push({ rule, actualValue, reason });
        }
      }
    }

    // 只有当没有阻断规则失败时才算通过
    const passed = blockedRules.length === 0;

    return {
      gateId: gate.id,
      gateName: gate.name,
      runId: '',  // will be set by caller
      stageName: '',  // will be set by caller
      metrics: input.metrics,
      passed,
      blockedRules,
      warnedRules,
    };
  }

  /**
   * 完整的评估流程：评估 + 存储结果
   */
  async evaluateAndStore(input: QualityGateEvaluateInput): Promise<QualityGateResult> {
    if (!this.gateRepository) {
      throw new QualityGateServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }

    // 1. 获取门禁定义
    const gate = await this.gateRepository.findById(input.gateId);
    if (!gate) {
      throw new QualityGateServiceError(`Quality gate not found: ${input.gateId}`, 'GATE_NOT_FOUND');
    }

    if (!gate.enabled) {
      throw new QualityGateServiceError(`Quality gate is disabled: ${input.gateId}`, 'GATE_DISABLED');
    }

    // 2. 评估
    const evaluation = this.evaluate(gate, { metrics: input.metrics });

    // 3. 创建结果
    const result: QualityGateResult = {
      ...evaluation,
      id: uuidv4(),
      runId: input.runId,
      stageName: input.stageName,
      evaluatedAt: new Date(),
    };

    // 4. 存储结果
    if (this.resultRepository) {
      await this.resultRepository.createResult({
        id: result.id,
        gateId: result.gateId,
        gateName: result.gateName,
        runId: result.runId,
        stageName: result.stageName,
        metrics: result.metrics,
        passed: result.passed,
        blockedRules: result.blockedRules,
        warnedRules: result.warnedRules,
        evaluatedAt: result.evaluatedAt,
      });
    }

    // 5. 日志
    if (result.passed) {
      logger.info(
        { runId: input.runId, stageName: input.stageName, gateName: gate.name },
        'Quality gate PASSED'
      );
    } else {
      logger.warn(
        {
          runId: input.runId,
          stageName: input.stageName,
          gateName: gate.name,
          blockedRules: result.blockedRules.map(r => r.reason),
          warnedRules: result.warnedRules.map(r => r.reason),
        },
        'Quality gate FAILED'
      );
    }

    return result;
  }

  // ==================== Blocking Check ====================

  /**
   * 检查评估结果是否包含阻断规则失败
   * 如果有阻断规则失败，则流水线应被阻止
   */
  isBlocking(result: QualityGateResult): boolean {
    return result.blockedRules.length > 0;
  }

  /**
   * 生成阻断原因描述
   */
  getBlockingReason(result: QualityGateResult): string | null {
    if (result.blockedRules.length === 0) return null;

    const reasons = result.blockedRules.map(r => r.reason);
    return `Quality gate '${result.gateName}' blocked: ${reasons.join('; ')}`;
  }

  // ==================== Result Queries ====================

  /**
   * 获取某个 Run 的所有质量门禁评估结果
   */
  async getResultsForRun(runId: string): Promise<QualityGateResult[]> {
    if (!this.resultRepository) {
      return [];
    }
    return this.resultRepository.findByRunId(runId);
  }

  /**
   * 获取某个 Run + Stage 的质量门禁评估结果
   */
  async getResultsForStage(runId: string, stageName: string): Promise<QualityGateResult[]> {
    if (!this.resultRepository) {
      return [];
    }
    return this.resultRepository.findByStageName(runId, stageName);
  }

  // ==================== External Provider (SonarQube-style) ====================

  /**
   * 从外部质量服务获取指标（如 SonarQube API）
   *
   * 注意：这是一个轻量级实现，生产环境中应使用专用的 HTTP 客户端
   * 和连接池管理
   */
  async fetchMetricsFromProvider(
    provider: { type: string; url: string; apiKey?: string },
    params: Record<string, string>
  ): Promise<Record<string, number>> {
    if (provider.type === 'sonarqube') {
      return this.fetchSonarQubeMetrics(provider.url, provider.apiKey, params);
    }

    // Generic HTTP provider
    return this.fetchGenericMetrics(provider.url, params);
  }

  /**
   * 从 SonarQube API 获取指标
   * 实际生产环境中需要更完善的错误处理和重试机制
   */
  private async fetchSonarQubeMetrics(
    baseUrl: string,
    apiKey: string | undefined,
    params: Record<string, string>
  ): Promise<Record<string, number>> {
    const project = params.project || '';
    if (!project) {
      throw new QualityGateServiceError('SonarQube project parameter is required', 'INVALID_INPUT');
    }

    // Construct SonarQube API URL
    const url = `${baseUrl}/api/measures/component?component=${encodeURIComponent(project)}&metricKeys=coverage,complexity,duplicated_lines_density,security_hotspots,bugs,vulnerabilities`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      // SonarQube uses Basic auth with API token as username
      const auth = Buffer.from(`${apiKey}:`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new QualityGateServiceError(
          `SonarQube API returned ${response.status}: ${response.statusText}`,
          'PROVIDER_ERROR'
        );
      }

      const data = await response.json() as any;
      const metrics: Record<string, number> = {};

      if (data.component?.measures) {
        for (const measure of data.component.measures) {
          const value = parseFloat(measure.value);
          if (!isNaN(value)) {
            // Map SonarQube metric names to our metric keys
            const metricMap: Record<string, QualityMetric> = {
              coverage: 'coverage',
              complexity: 'complexity',
              duplicated_lines_density: 'duplication',
              security_hotspots: 'security_hotspots',
              bugs: 'bugs',
              vulnerabilities: 'vulnerabilities',
            };
            const key = metricMap[measure.metric];
            if (key) {
              metrics[key] = value;
            }
          }
        }
      }

      return metrics;
    } catch (error) {
      if (error instanceof QualityGateServiceError) throw error;
      throw new QualityGateServiceError(
        `Failed to fetch SonarQube metrics: ${error instanceof Error ? error.message : String(error)}`,
        'PROVIDER_ERROR'
      );
    }
  }

  /**
   * 通用 HTTP 指标获取（用于自定义质量服务）
   */
  private async fetchGenericMetrics(
    url: string,
    params: Record<string, string>
  ): Promise<Record<string, number>> {
    // Append query parameters
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    try {
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new QualityGateServiceError(
          `Provider returned ${response.status}: ${response.statusText}`,
          'PROVIDER_ERROR'
        );
      }

      const data = await response.json() as Record<string, unknown>;
      // Expect { metrics: { coverage: 85, complexity: 10, ... } }
      if (data.metrics && typeof data.metrics === 'object') {
        return data.metrics as Record<string, number>;
      }
      if (typeof data === 'object' && data !== null) {
        // Return all numeric values as metrics
        const metrics: Record<string, number> = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number') {
            metrics[key] = value;
          }
        }
        return metrics;
      }

      throw new QualityGateServiceError('Provider response format not recognized', 'PROVIDER_ERROR');
    } catch (error) {
      if (error instanceof QualityGateServiceError) throw error;
      throw new QualityGateServiceError(
        `Failed to fetch metrics from provider: ${error instanceof Error ? error.message : String(error)}`,
        'PROVIDER_ERROR'
      );
    }
  }
}
