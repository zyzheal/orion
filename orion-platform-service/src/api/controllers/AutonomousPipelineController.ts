/**
 * AutonomousPipelineController - 自治流水线控制器 (Phase 2)
 *
 * 提供错误分类、自适应超时、自动重试的 API 接口
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { ErrorClassifier, ErrorType } from '../../services/pipeline/ErrorClassifier';
import { AdaptiveTimeoutService } from '../../services/pipeline/AdaptiveTimeoutService';
import { AutoRetryService, RetryConfig } from '../../services/pipeline/AutoRetryService';

// ==================== Request/Response Types ====================

interface ClassifyErrorBody {
  errorMessage?: string;
  stageName?: string;
  retryCount?: number;
  maxRetries?: number;
  previousErrors?: string[];
}

interface ErrorStatsQuery {
  stageName?: string;
  [key: string]: string | undefined;
}

interface RecordExecutionBody {
  stageName?: string;
  durationMs?: number;
  success?: boolean;
  timedOut?: boolean;
}

interface ConfigureRetryBody {
  pipelineId?: string;
  stageName?: string;
  maxRetries?: number;
  strategy?: 'immediate' | 'backoff' | 'skip';
  baseDelayMs?: number;
  maxDelayMs?: number;
}

interface RecommendSelfHealingBody {
  errorMessage?: string;
  stageName?: string;
  pipelineId?: string;
  retryCount?: number;
}

interface GetTimeoutParams {
  stageName: string;
  [key: string]: string;
}

interface GetRetryStatsParams {
  pipelineId: string;
  [key: string]: string;
}

interface SelfHealingQuery {
  errorType?: string;
  stageName?: string;
}

interface ErrorStatsQuery {
  stageName?: string;
}

interface ErrorClassification {
  type: string;
  shouldRetry: boolean;
  retryStrategy: string;
  confidence: number;
  reasoning: string;
}

export class AutonomousPipelineController extends BaseController {
  private errorClassifier: ErrorClassifier;
  private timeoutService: AdaptiveTimeoutService;
  private retryService: AutoRetryService;

  constructor(
    errorClassifier: ErrorClassifier,
    timeoutService: AdaptiveTimeoutService,
    retryService: AutoRetryService
  ) {
    super();
    this.errorClassifier = errorClassifier;
    this.timeoutService = timeoutService;
    this.retryService = retryService;
  }

  // ==================== 错误分类 ====================

  /**
   * POST /api/v1/autonomous/classify-error
   *
   * 请求体:
   * {
   *   "errorMessage": "ETIMEDOUT: Connection timed out",
   *   "stageName": "build",
   *   "retryCount": 0,
   *   "maxRetries": 3,
   *   "previousErrors": ["..."]
   * }
   */
  async classifyError(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = this.getBody<ClassifyErrorBody>(request);

    if (!body.errorMessage) {
      this.sendBadRequest(reply, 'errorMessage is required');
      return;
    }

    try {
      const classification = await this.errorClassifier.classifyError(
        body.errorMessage,
        {
          stageName: body.stageName || 'unknown',
          retryCount: body.retryCount || 0,
          maxRetries: body.maxRetries || 3,
          previousErrors: body.previousErrors,
        }
      );

      this.sendSuccess(reply, classification);
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * GET /api/v1/autonomous/error-stats
   *
   * 查询参数:
   * - stageName (可选): 按 stage 名称过滤
   */
  async getErrorStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = this.getQuery<ErrorStatsQuery>(request);

    try {
      const stats = await this.errorClassifier.getErrorStats(query.stageName);
      this.sendSuccess(reply, stats);
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  // ==================== 自适应超时 ====================

  /**
   * GET /api/v1/autonomous/timeout/:stageName
   *
   * 路径参数:
   * - stageName: Stage 名称
   *
   * 查询参数:
   * - pipelineId (可选): Pipeline ID
   */
  async getTimeoutForStage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = this.getParams<GetTimeoutParams>(request);
    const query = this.getQuery<ErrorStatsQuery>(request);

    try {
      const timeoutMs = await this.timeoutService.getTimeoutForStage(
        params.stageName,
        query.pipelineId
      );

      const baseline = await this.timeoutService.getBaselineStats(params.stageName);

      this.sendSuccess(reply, {
        stageName: params.stageName,
        suggestedTimeoutMs: timeoutMs,
        baseline,
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * POST /api/v1/autonomous/record-execution
   *
   * 请求体:
   * {
   *   "stageName": "build",
   *   "durationMs": 120000,
   *   "success": true,
   *   "timedOut": false
   * }
   */
  async recordExecution(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = this.getBody<RecordExecutionBody>(request);

    if (!body.stageName || body.durationMs === undefined || body.success === undefined) {
      this.sendBadRequest(reply, 'stageName, durationMs, and success are required');
      return;
    }

    try {
      await this.timeoutService.recordExecution(
        body.stageName,
        body.durationMs,
        body.success,
        body.timedOut || false
      );

      this.sendSuccess(reply, { recorded: true, stageName: body.stageName });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  // ==================== 自动重试 ====================

  /**
   * GET /api/v1/autonomous/retry-stats/:pipelineId
   *
   * 路径参数:
   * - pipelineId (可选): Pipeline ID，如果为 'all' 则返回全局统计
   */
  async getRetryStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = this.getParams<GetRetryStatsParams>(request);

    try {
      const pipelineId = params.pipelineId === 'all' ? undefined : params.pipelineId;
      const stats = await this.retryService.getRetryStats(pipelineId);
      this.sendSuccess(reply, stats);
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * POST /api/v1/autonomous/configure-retry
   *
   * 请求体:
   * {
   *   "pipelineId": "...",
   *   "stageName": "build",
   *   "maxRetries": 5,
   *   "strategy": "backoff",
   *   "baseDelayMs": 2000,
   *   "maxDelayMs": 120000
   * }
   */
  async configureRetry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = this.getBody<ConfigureRetryBody>(request);

    if (!body.pipelineId && !body.stageName) {
      this.sendBadRequest(reply, 'pipelineId or stageName is required');
      return;
    }

    try {
      const config = await this.retryService.configureRetry({
        pipelineId: body.pipelineId,
        stageName: body.stageName,
        maxRetries: body.maxRetries,
        strategy: body.strategy,
        baseDelayMs: body.baseDelayMs,
        maxDelayMs: body.maxDelayMs,
      });

      this.sendSuccess(reply, { configured: true, config });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  // ==================== 自修复推荐 ====================

  /**
   * POST /api/v1/autonomous/self-healing/recommend
   *
   * 请求体:
   * {
   *   "errorMessage": "ETIMEDOUT: Connection timed out",
   *   "stageName": "build",
   *   "pipelineId": "main-build",
   *   "retryCount": 0
   * }
   */
  async recommendSelfHealing(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = this.getBody<RecommendSelfHealingBody>(request);

    if (!body.errorMessage) {
      this.sendBadRequest(reply, 'errorMessage is required');
      return;
    }

    try {
      const classification = await this.errorClassifier.classifyError(
        body.errorMessage,
        {
          stageName: body.stageName || 'unknown',
          retryCount: body.retryCount || 0,
          maxRetries: 3,
        }
      );

      const recommendations = this.generateSelfHealingRecommendations(
        classification,
        body.errorMessage,
        body.stageName || 'unknown'
      );

      this.sendSuccess(reply, {
        classification,
        recommendations,
        autoRetryable: classification.shouldRetry && classification.type === 'transient',
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * GET /api/v1/autonomous/self-healing/actions
   *
   * 查询参数:
   * - errorType (可选): 错误类型过滤
   * - stageName (可选): Stage 名称过滤
   */
  async getSelfHealingActions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string | undefined>;

    try {
      const actions = SELF_HEALING_ACTION_CATALOG.filter((action) => {
        if (query.errorType && action.applicableErrorTypes !== 'all' &&
            !action.applicableErrorTypes.includes(query.errorType as ErrorType)) {
          return false;
        }
        if (query.stageName && !action.applicableStages.includes(query.stageName)) {
          return false;
        }
        return true;
      });

      this.sendSuccess(reply, { actions, total: actions.length });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * 生成自修复推荐
   */
  private generateSelfHealingRecommendations(
    classification: ErrorClassification,
    errorMessage: string,
    stageName: string
  ): Array<{ action: string; description: string; confidence: number; steps: string[] }> {
    const recommendations: Array<{ action: string; description: string; confidence: number; steps: string[] }> = [];

    // 基于错误分类生成推荐
    switch (classification.type) {
      case 'transient':
        recommendations.push({
          action: 'auto_retry_with_backoff',
          description: '检测到临时错误，建议使用指数退避策略自动重试',
          confidence: classification.confidence,
          steps: [
            `等待 ${classification.retryStrategy === 'backoff' ? '指数退避' : '短暂延迟'}`,
            `重新执行 stage: ${stageName}`,
            '如果重试失败超过 3 次，升级为人工介入',
          ],
        });
        break;

      case 'flaky':
        recommendations.push({
          action: 'flaky_test_quarantine',
          description: '检测到间歇性失败，建议隔离该 stage 并调查根因',
          confidence: classification.confidence,
          steps: [
            `标记 stage ${stageName} 为 flaky`,
            '收集失败日志和上下文信息',
            '运行诊断工具确定根因',
            '修复后重新启用 stage',
          ],
        });
        break;

      case 'config':
        recommendations.push({
          action: 'config_validation',
          description: '检测到配置错误，建议验证并修复配置',
          confidence: classification.confidence,
          steps: [
            '检查环境变量和配置文件',
            '验证参数格式和必填字段',
            '更新配置后重新执行',
          ],
        });
        break;

      case 'permanent':
        recommendations.push({
          action: 'manual_investigation',
          description: '检测到永久性错误，建议人工调查',
          confidence: classification.confidence,
          steps: [
            '收集完整错误日志',
            '通知相关负责人',
            '创建工单跟踪问题',
          ],
        });
        break;
    }

    // 根据具体错误消息添加更精确的推荐
    if (/timeout|ETIMEDOUT/i.test(errorMessage)) {
      recommendations.push({
        action: 'increase_timeout',
        description: '建议增加超时阈值或检查网络延迟',
        confidence: 0.7,
        steps: [
          '检查当前超时配置',
          '增加超时值 50%',
          '监控下次执行是否仍然超时',
        ],
      });
    }

    if (/out of memory|OOM/i.test(errorMessage)) {
      recommendations.push({
        action: 'increase_memory_limit',
        description: '建议增加内存限制或优化内存使用',
        confidence: 0.8,
        steps: [
          '分析内存使用 profile',
          '增加容器内存限制 25%',
          '优化代码以减少内存占用',
        ],
      });
    }

    return recommendations;
  }
}

// ==================== 自修复动作目录 ====================

interface SelfHealingAction {
  id: string;
  name: string;
  description: string;
  applicableErrorTypes: 'all' | Array<'transient' | 'permanent' | 'flaky' | 'config'>;
  applicableStages: string[];
  autoExecutable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

const SELF_HEALING_ACTION_CATALOG: SelfHealingAction[] = [
  {
    id: 'retry-with-backoff',
    name: '指数退避重试',
    description: '使用指数退避策略自动重试失败的 stage',
    applicableErrorTypes: ['transient'],
    applicableStages: ['build', 'test', 'deploy', 'integration-test'],
    autoExecutable: true,
    riskLevel: 'low',
  },
  {
    id: 'increase-timeout',
    name: '增加超时阈值',
    description: '自动增加 stage 的超时时间',
    applicableErrorTypes: ['transient'],
    applicableStages: ['build', 'test', 'deploy'],
    autoExecutable: true,
    riskLevel: 'low',
  },
  {
    id: 'retry-with-cleanup',
    name: '清理后重试',
    description: '清理临时文件和缓存后重试',
    applicableErrorTypes: ['transient', 'flaky'],
    applicableStages: ['build', 'test'],
    autoExecutable: true,
    riskLevel: 'low',
  },
  {
    id: 'switch-fallback',
    name: '切换到降级模式',
    description: '切换到降级模式继续执行',
    applicableErrorTypes: ['transient'],
    applicableStages: ['deploy', 'integration-test'],
    autoExecutable: false,
    riskLevel: 'medium',
  },
  {
    id: 'quarantine-flaky',
    name: '隔离 flaky stage',
    description: '标记并隔离 flaky stage，跳过执行',
    applicableErrorTypes: ['flaky'],
    applicableStages: ['test', 'integration-test'],
    autoExecutable: false,
    riskLevel: 'medium',
  },
  {
    id: 'validate-config',
    name: '配置验证',
    description: '验证并修复配置问题',
    applicableErrorTypes: ['config'],
    applicableStages: ['build', 'test', 'deploy'],
    autoExecutable: true,
    riskLevel: 'low',
  },
  {
    id: 'scale-resources',
    name: '扩容资源',
    description: '自动增加 CPU 或内存资源',
    applicableErrorTypes: ['transient'],
    applicableStages: ['build', 'test'],
    autoExecutable: false,
    riskLevel: 'medium',
  },
  {
    id: 'rollback-deploy',
    name: '回滚部署',
    description: '回滚到上一个稳定的部署版本',
    applicableErrorTypes: ['permanent'],
    applicableStages: ['deploy'],
    autoExecutable: false,
    riskLevel: 'high',
  },
];
