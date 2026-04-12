/**
 * 诊断 Agent 服务
 *
 * 职责：
 * - 编排诊断工作流
 * - 订阅 NATS 事件总线上的故障事件
 * - 自动触发诊断
 * - 管理诊断历史和知识库
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DiagnosticSession,
  DiagnosticReport,
  Symptom,
  DiagnosticTriggerType,
  DiagnosticSessionStatus,
  DiagnosticPattern,
  SymptomPattern,
  DiagnosticCategory,
  SymptomSeverity,
  TriggerDiagnosticRequest,
  AddSymptomRequest,
  AddPatternRequest,
} from './types';
import { DiagnosticEngine, DiagnosticEngineConfig } from './DiagnosticEngine';
import { DiagnosticReporter } from './DiagnosticReporter';
import { DiagnosticKnowledgeBase } from './DiagnosticKnowledgeBase';

/**
 * 诊断 Agent 服务配置
 */
export interface DiagnosticAgentServiceConfig {
  /** 事件总线实例 */
  eventBus?: any;
  /** 诊断引擎配置 */
  engineConfig?: DiagnosticEngineConfig;
  /** 是否启用自动诊断 */
  autoDiagnosticEnabled?: boolean;
}

/**
 * 诊断 Agent 服务
 */
export class DiagnosticAgentService {
  private engine: DiagnosticEngine;
  private reporter: DiagnosticReporter;
  private knowledgeBase: DiagnosticKnowledgeBase;
  private eventBus: any;
  private autoDiagnosticEnabled: boolean;
  private reports: Map<string, DiagnosticReport>;
  private subscriptions: any[];
  private isRunning: boolean;

  constructor(config?: DiagnosticAgentServiceConfig) {
    this.engine = new DiagnosticEngine(config?.engineConfig);
    this.reporter = new DiagnosticReporter();
    this.knowledgeBase = this.engine.getKnowledgeBase();
    this.eventBus = config?.eventBus;
    this.autoDiagnosticEnabled = config?.autoDiagnosticEnabled !== false;
    this.reports = new Map();
    this.subscriptions = [];
    this.isRunning = false;

    // 初始化内置诊断模式
    this.initializeDefaultPatterns();
  }

  /**
   * 触发诊断
   *
   * 手动或通过事件触发一次完整的诊断流程
   */
  async triggerDiagnostic(params: TriggerDiagnosticRequest): Promise<{
    session: DiagnosticSession;
    report: DiagnosticReport;
  }> {
    // 1. 启动诊断会话
    const symptoms: Symptom[] = params.symptoms.map((s) => ({
      type: s.type,
      source: s.source,
      description: s.description,
      severity: s.severity,
      timestamp: new Date(),
      metadata: s.metadata,
    }));

    const session = this.engine.startDiagnostic({
      triggerType: params.triggerType,
      triggerId: params.triggerId,
      initialSymptoms: symptoms,
      tenantId: params.tenantId,
    });

    // 2. 症状关联分析
    this.engine.correlateSymptoms(session.id);

    // 3. 根因识别
    this.engine.identifyRootCause(session.id);

    // 4. 完成诊断
    const completedSession = this.engine.completeDiagnostic(session.id);

    // 5. 生成报告
    const report = this.reporter.generateReport(completedSession);
    this.reports.set(report.id, report);

    // 6. 如果匹配到知识库模式，记录结果
    const kbMatches = this.knowledgeBase.matchSymptoms(symptoms);
    if (kbMatches.length > 0 && kbMatches[0].matchScore >= 60) {
      this.knowledgeBase.recordOutcome({
        sessionId: completedSession.id,
        patternId: kbMatches[0].pattern.id,
        confirmed: false, // 需要人工确认
      });
    }

    return { session: completedSession, report };
  }

  /**
   * 添加症状到运行中的诊断会话
   */
  async addSymptomToSession(
    sessionId: string,
    params: AddSymptomRequest
  ): Promise<DiagnosticSession> {
    const session = this.engine.addSymptom(sessionId, {
      type: params.type,
      source: params.source,
      description: params.description,
      severity: params.severity,
      timestamp: new Date(),
      metadata: params.metadata,
    });

    // 重新执行关联分析和根因识别
    this.engine.correlateSymptoms(sessionId);
    this.engine.identifyRootCause(sessionId);

    return session;
  }

  /**
   * 获取诊断历史
   */
  getDiagnosticHistory(params?: {
    triggerType?: DiagnosticTriggerType;
    triggerId?: string;
    tenantId?: string;
    status?: DiagnosticSessionStatus;
    since?: Date;
    limit?: number;
  }): DiagnosticSession[] {
    return this.engine.getDiagnosticHistory(params);
  }

  /**
   * 获取诊断详情
   */
  getDiagnosticDetail(sessionId: string): DiagnosticSession | undefined {
    return this.engine.getSession(sessionId);
  }

  /**
   * 获取诊断报告
   */
  getReport(reportId: string): DiagnosticReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * 获取会话关联的报告
   */
  getReportBySession(sessionId: string): DiagnosticReport | undefined {
    for (const report of this.reports.values()) {
      if (report.sessionId === sessionId) {
        return report;
      }
    }
    return undefined;
  }

  /**
   * 获取报告历史
   */
  getReportHistory(params?: {
    sessionId?: string;
    tenantId?: string;
    limit?: number;
  }): DiagnosticReport[] {
    let results = Array.from(this.reports.values());

    if (params?.sessionId) {
      results = results.filter((r) => r.sessionId === params.sessionId);
    }
    if (params?.tenantId) {
      results = results.filter((r) => r.tenantId === params.tenantId);
    }

    results.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    if (params?.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  // ==================== 知识库管理 ====================

  /**
   * 添加诊断模式
   */
  addPattern(params: AddPatternRequest): DiagnosticPattern {
    return this.knowledgeBase.addPattern({
      name: params.name,
      symptoms: params.symptoms,
      rootCause: params.rootCause,
      solution: params.solution,
      category: params.category,
    });
  }

  /**
   * 获取诊断模式
   */
  getPattern(patternId: string): DiagnosticPattern | undefined {
    return this.knowledgeBase.getPattern(patternId);
  }

  /**
   * 搜索诊断模式
   */
  searchPatterns(params: {
    category?: DiagnosticCategory;
    keyword?: string;
    minFrequency?: number;
    limit?: number;
  }): DiagnosticPattern[] {
    return this.knowledgeBase.searchPatterns(params);
  }

  /**
   * 匹配症状
   */
  matchSymptoms(symptoms: Symptom[]) {
    return this.knowledgeBase.matchSymptoms(symptoms);
  }

  /**
   * 获取所有模式
   */
  getAllPatterns(): DiagnosticPattern[] {
    return this.knowledgeBase.getAllPatterns();
  }

  /**
   * 记录诊断结果
   */
  recordOutcome(params: {
    sessionId: string;
    patternId: string;
    confirmed: boolean;
    actualRootCause?: string;
    fixTimeMs?: number;
  }) {
    return this.knowledgeBase.recordOutcome(params);
  }

  /**
   * 获取知识库统计
   */
  getKnowledgeBaseStats() {
    return this.knowledgeBase.getStats();
  }

  // ==================== 修复复杂度评估 ====================

  /**
   * 评估修复复杂度
   */
  estimateFixComplexity(sessionId: string) {
    const session = this.engine.getSession(sessionId);
    if (!session) {
      throw new Error(`Diagnostic session ${sessionId} not found`);
    }
    return this.reporter.estimateFixComplexity(session);
  }

  // ==================== 事件订阅 ====================

  /**
   * 启动事件订阅，自动触发诊断
   */
  async startEventSubscriptions(): Promise<void> {
    if (!this.eventBus || !this.autoDiagnosticEnabled) {
      console.log('[DiagnosticAgentService] Auto-diagnostic disabled or event bus not available');
      return;
    }

    console.log('[DiagnosticAgentService] Subscribing to failure events...');

    try {
      // 订阅部署失败事件
      await this.subscribe(
        'deployment.failed',
        this.handleDeploymentFailure.bind(this)
      );

      // 订阅 Pipeline 失败事件
      await this.subscribe(
        'pipeline.run.failed',
        this.handlePipelineFailure.bind(this)
      );

      // 订阅事故事件
      await this.subscribe(
        'incident.created',
        this.handleIncidentCreated.bind(this)
      );

      this.isRunning = true;
      console.log('[DiagnosticAgentService] Event subscriptions active');
    } catch (error) {
      console.error('[DiagnosticAgentService] Failed to subscribe to events:', error);
    }
  }

  /**
   * 停止事件订阅
   */
  async stopEventSubscriptions(): Promise<void> {
    for (const subscription of this.subscriptions) {
      try {
        if (subscription.unsubscribe) {
          await subscription.unsubscribe();
        }
        if (subscription.drain) {
          await subscription.drain();
        }
      } catch (error) {
        console.error('[DiagnosticAgentService] Error unsubscribing:', error);
      }
    }
    this.subscriptions = [];
    this.isRunning = false;
    console.log('[DiagnosticAgentService] Event subscriptions removed');
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    service: string;
    status: string;
    sessionsCount: number;
    reportsCount: number;
    patternsCount: number;
    isRunning: boolean;
  } {
    return {
      service: 'diagnostic-agent',
      status: this.isRunning ? 'running' : 'idle',
      sessionsCount: this.engine.getDiagnosticHistory().length,
      reportsCount: this.reports.size,
      patternsCount: this.knowledgeBase.getAllPatterns().length,
      isRunning: this.isRunning,
    };
  }

  /**
   * 清空所有数据（用于测试）
   */
  clearAll(): void {
    this.engine.clearSessions();
    this.reports.clear();
    this.knowledgeBase.clear();
    this.initializeDefaultPatterns();
  }

  // ==================== 私有方法 ====================

  /**
   * 初始化内置诊断模式
   */
  private initializeDefaultPatterns(): void {
    // 模式 1: CrashLoopBackOff
    this.knowledgeBase.addPattern({
      name: 'Container CrashLoop Pattern',
      symptoms: [
        {
          type: 'deployment_failure',
          sourcePattern: 'kubernetes-*',
          keywords: ['CrashLoopBackOff', 'restarting', 'crash'],
          minSeverity: 'error',
        },
      ],
      rootCause:
        'Container entering CrashLoopBackOff state, typically caused by application startup error, missing configuration, or failed health probe',
      solution:
        '1. Check container logs for error messages\n2. Verify environment variables and config maps\n3. Check liveness and readiness probe configuration\n4. Fix application error and redeploy',
      category: 'deployment',
    });

    // 模式 2: Image Pull Failure
    this.knowledgeBase.addPattern({
      name: 'Image Pull Failure Pattern',
      symptoms: [
        {
          type: 'deployment_failure',
          sourcePattern: 'kubernetes-*',
          keywords: ['ImagePullBackOff', 'ErrImagePull', 'image'],
          minSeverity: 'error',
        },
      ],
      rootCause:
        'Container image cannot be pulled from registry, typically due to incorrect image reference, missing pull secret, or registry authentication failure',
      solution:
        '1. Verify image name and tag exist in registry\n2. Check imagePullSecrets configuration\n3. Verify registry credentials are valid\n4. Fix image reference and redeploy',
      category: 'deployment',
    });

    // 模式 3: Database Connection Issue
    this.knowledgeBase.addPattern({
      name: 'Database Connection Failure Pattern',
      symptoms: [
        {
          type: 'database_error',
          sourcePattern: '*-db-*',
          keywords: ['connection', 'timeout', 'refused', 'pool'],
          minSeverity: 'error',
        },
      ],
      rootCause:
        'Database connection failure, typically caused by connection pool exhaustion, database server down, network issue, or authentication failure',
      solution:
        '1. Check database server status and connectivity\n2. Review connection pool configuration and usage\n3. Check database logs for errors\n4. Verify network connectivity and firewall rules\n5. Restart application to reset connection pool if needed',
      category: 'database',
    });

    // 模式 4: Pipeline Test Failure
    this.knowledgeBase.addPattern({
      name: 'Pipeline Test Failure Pattern',
      symptoms: [
        {
          type: 'test_failure',
          sourcePattern: 'pipeline-*',
          keywords: ['test', 'failed', 'assertion', 'error'],
          minSeverity: 'error',
        },
      ],
      rootCause:
        'Pipeline test stage failure, typically caused by code changes breaking existing tests, test environment issues, or flaky tests',
      solution:
        '1. Review test output and identify failing tests\n2. Check if recent code changes could cause the failure\n3. Verify test environment and dependencies\n4. Fix failing tests or update test expectations\n5. Re-run pipeline',
      category: 'pipeline',
    });

    // 模式 5: Resource Exhaustion
    this.knowledgeBase.addPattern({
      name: 'Resource Exhaustion Pattern',
      symptoms: [
        {
          type: 'resource_exhaustion',
          sourcePattern: '*',
          keywords: ['memory', 'cpu', 'disk', 'oom', 'resource'],
          minSeverity: 'warning',
        },
      ],
      rootCause:
        'System resource exhaustion, typically caused by memory leak, disk space depletion, or CPU overutilization',
      solution:
        '1. Check current resource usage (memory, CPU, disk)\n2. Identify processes consuming excessive resources\n3. For memory: check for leaks, increase limits\n4. For disk: clean up logs, old files, increase volume\n5. For CPU: optimize code, scale horizontally',
      category: 'infrastructure',
    });
  }

  /**
   * 订阅事件
   */
  private async subscribe(
    eventType: string,
    handler: (event: any) => Promise<void>
  ): Promise<void> {
    if (!this.eventBus) return;

    try {
      const unsubscribe = await this.eventBus.subscribe(eventType, handler, {
        durableName: `diagnostic-agent-${eventType.replace(/\./g, '-')}`,
        autoAck: true,
      });
      this.subscriptions.push(unsubscribe);
      console.log(`[DiagnosticAgentService] Subscribed to ${eventType}`);
    } catch (error) {
      console.error(`[DiagnosticAgentService] Failed to subscribe to ${eventType}:`, error);
    }
  }

  /**
   * 处理部署失败事件
   */
  private async handleDeploymentFailure(event: any): Promise<void> {
    console.log('[DiagnosticAgentService] Processing deployment.failed event');

    try {
      const deploymentId = event.data?.deploymentId || event.data?.id || 'unknown';
      const symptoms: Array<{
        type: string;
        source: string;
        description: string;
        severity: SymptomSeverity;
        metadata?: Record<string, any>;
      }> = [];

      // 从事件中提取症状
      if (event.data?.error) {
        symptoms.push({
          type: 'deployment_failure',
          source: event.data?.source || 'deployment',
          description: event.data.error,
          severity: 'error',
        });
      }

      if (event.data?.message) {
        symptoms.push({
          type: 'deployment_failure',
          source: event.data?.source || 'deployment',
          description: event.data.message,
          severity: 'error',
        });
      }

      if (symptoms.length > 0) {
        await this.triggerDiagnostic({
          triggerType: 'deployment_failure',
          triggerId: deploymentId,
          symptoms,
          tenantId: event.tenantId,
        });
      }
    } catch (error) {
      console.error('[DiagnosticAgentService] Failed to process deployment failure:', error);
    }
  }

  /**
   * 处理 Pipeline 失败事件
   */
  private async handlePipelineFailure(event: any): Promise<void> {
    console.log('[DiagnosticAgentService] Processing pipeline.run.failed event');

    try {
      const runId = event.data?.runId || event.data?.id || 'unknown';
      const symptoms: Array<{
        type: string;
        source: string;
        description: string;
        severity: SymptomSeverity;
        metadata?: Record<string, any>;
      }> = [];

      if (event.data?.error) {
        symptoms.push({
          type: 'pipeline_failure',
          source: event.data?.source || 'pipeline',
          description: event.data.error,
          severity: 'error',
        });
      }

      if (event.data?.failedStage) {
        symptoms.push({
          type: 'pipeline_failure',
          source: `pipeline-stage-${event.data.failedStage}`,
          description: `Pipeline failed at stage: ${event.data.failedStage}`,
          severity: 'error',
        });
      }

      if (event.data?.testFailures) {
        symptoms.push({
          type: 'test_failure',
          source: 'pipeline-test',
          description: `Test failures detected: ${JSON.stringify(event.data.testFailures)}`,
          severity: 'error',
        });
      }

      if (symptoms.length > 0) {
        await this.triggerDiagnostic({
          triggerType: 'pipeline_failure',
          triggerId: runId,
          symptoms,
          tenantId: event.tenantId,
        });
      }
    } catch (error) {
      console.error('[DiagnosticAgentService] Failed to process pipeline failure:', error);
    }
  }

  /**
   * 处理事故创建事件
   */
  private async handleIncidentCreated(event: any): Promise<void> {
    console.log('[DiagnosticAgentService] Processing incident.created event');

    try {
      const incidentId = event.data?.incidentId || event.data?.id || 'unknown';
      const symptoms: Array<{
        type: string;
        source: string;
        description: string;
        severity: SymptomSeverity;
        metadata?: Record<string, any>;
      }> = [];

      if (event.data?.description) {
        symptoms.push({
          type: 'incident',
          source: event.data?.source || 'monitoring',
          description: event.data.description,
          severity: (event.data?.severity as SymptomSeverity) || 'error',
        });
      }

      if (event.data?.affectedServices) {
        for (const service of event.data.affectedServices) {
          symptoms.push({
            type: 'service_degradation',
            source: `service-${service}`,
            description: `Service ${service} is degraded or unavailable`,
            severity: 'error',
          });
        }
      }

      if (symptoms.length > 0) {
        await this.triggerDiagnostic({
          triggerType: 'incident',
          triggerId: incidentId,
          symptoms,
          tenantId: event.tenantId,
        });
      }
    } catch (error) {
      console.error('[DiagnosticAgentService] Failed to process incident:', error);
    }
  }
}
