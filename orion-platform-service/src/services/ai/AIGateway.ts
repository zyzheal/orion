/**
 * AI Gateway - AI 服务网关
 *
 * 功能：
 * 1. 健康检查（超时/错误率/置信度）
 * 2. 熔断器模式（CLOSED/OPEN/HALF_OPEN）
 * 3. 指标收集和监控
 * 4. 自动降级触发
 * 5. Prompt 注入检测和清洗（安全加固）
 */

import {
  CircuitState,
  AIGatewayConfig,
  AIMetrics,
  AIGatewayHealth,
  AIRequest,
  AIResponse,
  AIScenario,
  CircuitBreakerState,
  AIGatewayEvent,
  AIGatewayEventHandler,
} from './types';
import { AIDegradationRouter } from './AIDegradationRouter';
import { PromptInjectionDetector, ExtendedPromptAnalysis } from './PromptInjectionDetector';
import { PromptSanitizer, SanitizationResult } from './PromptSanitizer';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// 默认配置
const DEFAULT_CONFIG: AIGatewayConfig = {
  timeoutThresholds: {
    'code-review': 2000, // P95 > 2s 触发降级
    default: 5000, // 默认 5s
  },
  errorRateThreshold: 0.15, // 错误率 > 15% 触发熔断
  confidenceThreshold: 0.5, // 置信度 < 0.5 触发降级
  circuitBreaker: {
    failureThreshold: 5, // 连续 5 次失败触发熔断
    recoveryTimeout: 30000, // 30s 后尝试恢复
    halfOpenMaxCalls: 3, // 半开状态最多尝试 3 次
  },
  windowSize: 100, // 统计最近 100 个请求
};

/**
 * Prompt 安全配置
 */
export interface PromptSecurityConfig {
  enabled: boolean;
  riskThresholdHigh: number; // 高风险阈值，超过此值拒绝请求
  riskThresholdMedium: number; // 中风险阈值，超过此值需要清洗
  sanitizeOnMediumRisk: boolean; // 中风险时是否清洗
  rejectOnHighRisk: boolean; // 高风险时是否拒绝
  logSecurityEvents: boolean; // 是否记录安全事件
}

const DEFAULT_PROMPT_SECURITY_CONFIG: PromptSecurityConfig = {
  enabled: true,
  riskThresholdHigh: 70,
  riskThresholdMedium: 30,
  sanitizeOnMediumRisk: true,
  rejectOnHighRisk: true,
  logSecurityEvents: true,
};

/**
 * AI Gateway 核心
 */
export class AIGateway {
  private config: AIGatewayConfig;
  private degradationRouter: AIDegradationRouter;
  private promptSecurityConfig: PromptSecurityConfig;
  private promptDetector: PromptInjectionDetector;
  private promptSanitizer: PromptSanitizer;

  // 每个场景的指标
  private metrics: Map<AIScenario, AIMetrics> = new Map();

  // 每个场景的熔断器状态
  private circuitStates: Map<AIScenario, CircuitBreakerState> = new Map();

  // 请求历史（用于计算 P95）
  private requestHistory: Map<AIScenario, Array<{ latency: number; success: boolean; timestamp: Date }>> = new Map();

  // LLM 调用函数（由外部注入）
  private llmCaller?: (request: AIRequest) => Promise<AIResponse<unknown>>;

  // 事件处理器
  private eventHandlers: AIGatewayEventHandler[] = [];

  constructor(
    config: Partial<AIGatewayConfig> = {},
    degradationRouter?: AIDegradationRouter,
    promptSecurityConfig?: Partial<PromptSecurityConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.degradationRouter = degradationRouter || new AIDegradationRouter();
    this.promptSecurityConfig = { ...DEFAULT_PROMPT_SECURITY_CONFIG, ...promptSecurityConfig };
    this.promptDetector = new PromptInjectionDetector({
      riskThresholdHigh: this.promptSecurityConfig.riskThresholdHigh,
      riskThresholdMedium: this.promptSecurityConfig.riskThresholdMedium,
    });
    this.promptSanitizer = new PromptSanitizer();
  }

  /**
   * 设置 LLM 调用函数
   */
  setLLMCaller(caller: (request: AIRequest) => Promise<AIResponse<unknown>>): void {
    this.llmCaller = caller;
  }

  /**
   * 注册事件处理器
   */
  onEvent(handler: AIGatewayEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * 发送事件
   */
  private emitEvent(event: AIGatewayEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  /**
   * 执行 AI 请求
   */
  async execute<T = unknown>(request: AIRequest): Promise<AIResponse<T>> {
    const startTime = Date.now();
    const { scenario } = request;

    // 初始化场景指标
    this.ensureScenarioInitialized(scenario);

    // ========== 新增：Prompt 安全检测 ==========
    if (this.promptSecurityConfig.enabled) {
      const inputText = this.extractInputText(request.input);
      if (inputText) {
        const securityAnalysis = this.promptDetector.analyze(inputText);

        // 记录安全事件
        if (this.promptSecurityConfig.logSecurityEvents && securityAnalysis.threats.length > 0) {
          logger.warn({
            msg: 'Prompt security threat detected',
            scenario,
            userId: request.context?.userId,
            tenantId: request.context?.tenantId,
            riskScore: securityAnalysis.riskScore,
            threatCount: securityAnalysis.threats.length,
            threatTypes: securityAnalysis.threats.map(t => t.type),
            recommendation: securityAnalysis.recommendation,
          });
        }

        // 高风险：拒绝请求
        if (securityAnalysis.riskScore >= this.promptSecurityConfig.riskThresholdHigh) {
          if (this.promptSecurityConfig.rejectOnHighRisk) {
            logger.error({
              msg: 'Prompt rejected due to high security risk',
              scenario,
              riskScore: securityAnalysis.riskScore,
              threatTypes: securityAnalysis.attackCategories,
            });

            this.emitEvent({
              type: 'degradation',
              scenario,
              timestamp: new Date(),
              data: { reason: 'security_rejection', riskScore: securityAnalysis.riskScore },
            });

            // 返回安全拒绝响应
            return {
              success: false,
              data: undefined,
              source: 'degraded',
              degradationReason: `Prompt security risk too high (${securityAnalysis.riskScore}/100)`,
              latency: Date.now() - startTime,
              error: 'SECURITY_RISK_TOO_HIGH',
            };
          }
        }

        // 中风险：清洗 Prompt
        if (
          securityAnalysis.riskScore >= this.promptSecurityConfig.riskThresholdMedium &&
          this.promptSecurityConfig.sanitizeOnMediumRisk
        ) {
          const sanitization = this.promptSanitizer.sanitize(inputText, securityAnalysis.threats);

          logger.info({
            msg: 'Prompt sanitized',
            scenario,
            sanitizationCount: sanitization.sanitizationCount,
            intentPreserved: sanitization.intentPreserved,
          });

          // 更新请求输入为清洗后的内容
          request.input = this.updateInputText(request.input, sanitization.sanitizedPrompt);
        }
      }
    }
    // ========== 安全检测结束 ==========

    // 检查熔断器状态
    const circuitState = this.getCircuitState(scenario);

    if (circuitState === 'OPEN') {
      // 熔断器打开，直接降级
      if (request.options?.fallbackEnabled !== false) {
        return this.handleDegradation<T>(request, 'circuit_breaker_open');
      }
      throw new Error('Circuit breaker open, degradation disabled');
    }

    // 检查健康状态
    const health = await this.checkHealth(scenario);

    if (!health.isHealthy || health.degradationActive) {
      // 不健康或降级激活，走降级逻辑
      if (request.options?.fallbackEnabled !== false) {
        return this.handleDegradation<T>(request, 'health_check_failed');
      }
      // 如果降级禁用，抛出错误
      throw new Error('AI service unavailable, degradation disabled');
    }

    // 尝试调用 LLM
    try {
      const response = await this.callLLM<T>(request);
      const latency = Date.now() - startTime;

      // 记录成功
      this.recordSuccess(scenario, latency, response.confidence);

      // 检查置信度
      if (response.confidence !== undefined && response.confidence < this.config.confidenceThreshold) {
        // 置信度过低，尝试降级
        const degradedResponse = await this.handleDegradation<T>(request, 'low_confidence');
        // 如果降级成功，返回降级结果；否则返回原始结果
        if (degradedResponse.success) {
          return degradedResponse;
        }
      }

      // 重置熔断器失败计数（半开状态下成功）
      if (circuitState === 'HALF_OPEN') {
        await this.handleCircuitSuccess(scenario);
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;

      // 记录失败
      this.recordFailure(scenario, latency, error);

      // 处理熔断器失败
      if (circuitState === 'HALF_OPEN') {
        await this.handleCircuitFailure(scenario);
      }

      // 尝试降级
      if (request.options?.fallbackEnabled !== false) {
        return this.handleDegradation<T>(request, 'llm_error');
      }

      throw error;
    }
  }

  /**
   * 调用 LLM
   */
  private async callLLM<T>(request: AIRequest): Promise<AIResponse<T>> {
    if (!this.llmCaller) {
      throw new Error('LLM caller not configured');
    }

    const timeout = request.options?.timeout || this.getTimeoutThreshold(request.scenario);

    // 带超时的调用
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM call timeout')), timeout);
    });

    try {
      const response = await Promise.race([this.llmCaller(request), timeoutPromise]) as AIResponse<T>;
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  /**
   * 处理降级
   */
  private async handleDegradation<T>(
    request: AIRequest,
    reason: string
  ): Promise<AIResponse<T>> {
    this.emitEvent({
      type: 'degradation',
      scenario: request.scenario,
      timestamp: new Date(),
      data: { reason },
    });

    const result = await this.degradationRouter.degrade<T>(request.scenario, request.input, reason);

    return {
      success: result.success,
      data: result.data,
      confidence: result.confidence,
      source: 'degraded',
      degradationReason: result.reason,
      latency: 0, // 降级响应通常很快
    };
  }

  /**
   * 检查场景健康状态
   */
  async checkHealth(scenario: AIScenario): Promise<AIGatewayHealth> {
    this.ensureScenarioInitialized(scenario);

    const metrics = this.metrics.get(scenario)!;
    const circuitState = this.getCircuitState(scenario);

    // 计算健康度
    const isHealthy =
      circuitState !== 'OPEN' &&
      metrics.errorRate < this.config.errorRateThreshold &&
      metrics.p95Latency < this.getTimeoutThreshold(scenario);

    // 判断是否需要降级
    const degradationActive =
      circuitState === 'OPEN' ||
      metrics.errorRate >= this.config.errorRateThreshold ||
      metrics.p95Latency >= this.getTimeoutThreshold(scenario);

    return {
      scenario,
      circuitState,
      isHealthy,
      metrics,
      lastCheckTime: new Date(),
      degradationActive,
    };
  }

  /**
   * 获取熔断器状态
   */
  getCircuitState(scenario: AIScenario): CircuitState {
    this.ensureScenarioInitialized(scenario);
    const state = this.circuitStates.get(scenario)!;

    // 如果是 OPEN 状态，检查是否可以转为 HALF_OPEN
    if (state.state === 'OPEN' && state.lastFailureTime) {
      const now = Date.now();
      const lastFailure = state.lastFailureTime.getTime();
      if (now - lastFailure >= this.config.circuitBreaker.recoveryTimeout) {
        // 转为半开状态
        state.state = 'HALF_OPEN';
        state.halfOpenAttempts = 0;
        state.lastStateChangeTime = new Date();
        this.emitEvent({
          type: 'circuit_half_open',
          scenario,
          timestamp: new Date(),
          data: { previousState: 'OPEN' },
        });
      }
    }

    return state.state;
  }

  /**
   * 获取超时阈值
   */
  private getTimeoutThreshold(scenario: AIScenario): number {
    return this.config.timeoutThresholds[scenario] || this.config.timeoutThresholds.default;
  }

  /**
   * 记录成功请求
   */
  private recordSuccess(scenario: AIScenario, latency: number, confidence?: number): void {
    const metrics = this.metrics.get(scenario)!;
    const history = this.requestHistory.get(scenario)!;

    // 添加到历史
    history.push({
      latency,
      success: true,
      timestamp: new Date(),
    });

    // 保持窗口大小
    if (history.length > this.config.windowSize) {
      history.shift();
    }

    // 更新指标
    this.updateMetrics(scenario);
  }

  /**
   * 记录失败请求
   */
  private recordFailure(scenario: AIScenario, latency: number, error: unknown): void {
    const metrics = this.metrics.get(scenario)!;
    const history = this.requestHistory.get(scenario)!;
    const circuitState = this.circuitStates.get(scenario)!;

    // 添加到历史
    history.push({
      latency,
      success: false,
      timestamp: new Date(),
    });

    // 保持窗口大小
    if (history.length > this.config.windowSize) {
      history.shift();
    }

    // 更新指标
    this.updateMetrics(scenario);

    // 更新熔断器
    circuitState.failureCount++;
    circuitState.lastFailureTime = new Date();

    // 检查是否需要触发熔断
    if (circuitState.failureCount >= this.config.circuitBreaker.failureThreshold) {
      this.openCircuit(scenario);
    }
  }

  /**
   * 处理半开状态的成功
   */
  private async handleCircuitSuccess(scenario: AIScenario): Promise<void> {
    const state = this.circuitStates.get(scenario)!;
    state.successCount++;
    state.halfOpenAttempts++;

    // 半开状态下成功次数足够，关闭熔断器
    if (state.halfOpenAttempts >= this.config.circuitBreaker.halfOpenMaxCalls) {
      this.closeCircuit(scenario);
    }
  }

  /**
   * 处理半开状态的失败
   */
  private async handleCircuitFailure(scenario: AIScenario): Promise<void> {
    const state = this.circuitStates.get(scenario)!;
    state.halfOpenAttempts++;

    // 半开状态下失败，重新打开熔断器
    if (state.halfOpenAttempts >= this.config.circuitBreaker.halfOpenMaxCalls) {
      this.openCircuit(scenario);
    }
  }

  /**
   * 打开熔断器
   */
  private openCircuit(scenario: AIScenario): void {
    this.ensureScenarioInitialized(scenario);
    const state = this.circuitStates.get(scenario)!;
    if (state.state !== 'OPEN') {
      state.state = 'OPEN';
      state.lastStateChangeTime = new Date();
      state.lastFailureTime = new Date(); // 设置最后失败时间用于恢复判断
      this.emitEvent({
        type: 'circuit_open',
        scenario,
        timestamp: new Date(),
        data: { failureCount: state.failureCount },
      });
    }
  }

  /**
   * 关闭熔断器
   */
  private closeCircuit(scenario: AIScenario): void {
    const state = this.circuitStates.get(scenario)!;
    state.state = 'CLOSED';
    state.failureCount = 0;
    state.successCount = 0;
    state.halfOpenAttempts = 0;
    state.lastStateChangeTime = new Date();
    this.emitEvent({
      type: 'circuit_close',
      scenario,
      timestamp: new Date(),
      data: {},
    });
  }

  /**
   * 更新指标
   */
  private updateMetrics(scenario: AIScenario): void {
    const metrics = this.metrics.get(scenario)!;
    const history = this.requestHistory.get(scenario)!;

    if (history.length === 0) return;

    // 计算基本指标
    const totalRequests = history.length;
    const failedRequests = history.filter((h) => !h.success).length;
    const totalLatency = history.reduce((sum, h) => sum + h.latency, 0);
    const avgLatency = totalLatency / totalRequests;

    // 计算 P95 延迟
    const sortedLatencies = history.map((h) => h.latency).sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] || sortedLatencies[sortedLatencies.length - 1] || 0;

    // 更新指标
    metrics.totalRequests = totalRequests;
    metrics.failedRequests = failedRequests;
    metrics.totalLatency = totalLatency;
    metrics.avgLatency = avgLatency;
    metrics.p95Latency = p95Latency;
    metrics.errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    // 记录最后一个错误
    const lastError = [...history].reverse().find((h) => !h.success);
    if (lastError) {
      metrics.lastErrorTime = lastError.timestamp;
    }
  }

  /**
   * 确保场景已初始化
   */
  private ensureScenarioInitialized(scenario: AIScenario): void {
    if (!this.metrics.has(scenario)) {
      this.metrics.set(scenario, {
        scenario,
        totalRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
        avgLatency: 0,
        p95Latency: 0,
        errorRate: 0,
      });

      this.requestHistory.set(scenario, []);

      this.circuitStates.set(scenario, {
        scenario,
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastStateChangeTime: new Date(),
        halfOpenAttempts: 0,
      });
    }
  }

  /**
   * 获取所有场景的健康状态
   */
  async getAllHealth(): Promise<AIGatewayHealth[]> {
    const scenarios = Array.from(this.metrics.keys());
    const healths = await Promise.all(scenarios.map((s) => this.checkHealth(s)));
    return healths;
  }

  /**
   * 获取场景指标
   */
  getMetrics(scenario: AIScenario): AIMetrics | undefined {
    return this.metrics.get(scenario);
  }

  /**
   * 手动重置熔断器
   */
  resetCircuit(scenario: AIScenario): void {
    this.closeCircuit(scenario);
  }

  /**
   * 手动触发熔断
   */
  tripCircuit(scenario: AIScenario): void {
    this.ensureScenarioInitialized(scenario);
    this.openCircuit(scenario);
  }

  /**
   * 获取降级路由器
   */
  getDegradationRouter(): AIDegradationRouter {
    return this.degradationRouter;
  }

  /**
   * 获取 Prompt 检测器
   */
  getPromptDetector(): PromptInjectionDetector {
    return this.promptDetector;
  }

  /**
   * 获取 Prompt 清洗器
   */
  getPromptSanitizer(): PromptSanitizer {
    return this.promptSanitizer;
  }

  /**
   * 获取 Prompt 安全配置
   */
  getPromptSecurityConfig(): PromptSecurityConfig {
    return { ...this.promptSecurityConfig };
  }

  /**
   * 更新 Prompt 安全配置
   */
  updatePromptSecurityConfig(config: Partial<PromptSecurityConfig>): void {
    this.promptSecurityConfig = { ...this.promptSecurityConfig, ...config };
    this.promptDetector.updateConfig({
      riskThresholdHigh: this.promptSecurityConfig.riskThresholdHigh,
      riskThresholdMedium: this.promptSecurityConfig.riskThresholdMedium,
    });
  }

  /**
   * 从请求输入中提取文本内容
   */
  private extractInputText(input: Record<string, unknown>): string | null {
    // 尝试从常见的输入字段中提取文本
    const textFieldNames = ['prompt', 'text', 'query', 'message', 'content', 'input', 'question'];

    for (const field of textFieldNames) {
      if (typeof input[field] === 'string') {
        return input[field] as string;
      }
    }

    // 如果没有找到特定字段，尝试将整个输入转换为字符串
    if (Object.keys(input).length === 1) {
      const value = Object.values(input)[0];
      if (typeof value === 'string') {
        return value;
      }
    }

    // 返回 JSON 字符串化版本
    try {
      return JSON.stringify(input);
    } catch {
      return null;
    }
  }

  /**
   * 更新请求输入中的文本内容
   */
  private updateInputText(input: Record<string, unknown>, sanitizedText: string): Record<string, unknown> {
    const textFieldNames = ['prompt', 'text', 'query', 'message', 'content', 'input', 'question'];

    // 找到并更新文本字段
    for (const field of textFieldNames) {
      if (typeof input[field] === 'string') {
        return { ...input, [field]: sanitizedText };
      }
    }

    // 如果没有找到特定字段，更新第一个字符串值字段
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        return { ...input, [key]: sanitizedText };
      }
    }

    // 如果输入只有一个字段，直接替换
    if (Object.keys(input).length === 1) {
      const key = Object.keys(input)[0];
      return { [key]: sanitizedText };
    }

    // 默认添加 sanitized_prompt 字段
    return { ...input, sanitized_prompt: sanitizedText };
  }
}