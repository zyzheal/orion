/**
 * PipelineErrorDetail Controller
 *
 * Provides structured error classification for failed pipeline runs.
 * Uses ErrorClassifier to transform raw error logs into human-readable
 * error messages with suggested fixes.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../../services/database';
import { ErrorClassifier } from '../../services/pipeline/ErrorClassifier';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { PipelineRunRepository } from '../../services/pipeline/PipelineRunRepository';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';
import { Stage } from '../../models/Stage';
import { Task } from '../../models/Task';
import pino from 'pino';

const logger = pino({ name: 'LPipeline-LError-LDetail-LController' });

// ==================== User-friendly error category mapping ====================

/** Frontend-facing error category (human-readable) */
export type FrontendErrorCategory =
  | 'compilation_error'
  | 'test_failure'
  | 'deployment_failure'
  | 'infrastructure_error'
  | 'timeout_error'
  | 'configuration_error'
  | 'unknown_error';

/** Severity level for display */
export type ErrorSeverity = 'critical' | 'warning' | 'info';

/** Structured error detail returned to frontend */
export interface PipelineErrorDetail {
  /** Error category for icon/label display */
  errorType: FrontendErrorCategory;
  /** Severity: critical / warning / info */
  severity: ErrorSeverity;
  /** Human-readable message in Chinese */
  humanReadableMessage: string;
  /** Suggested fix steps as a numbered list */
  suggestedFix: string[];
  /** The original error message from the pipeline run */
  rawError: string;
  /** Which stage the error occurred in */
  stageName: string;
  /** Timestamp of the error */
  timestamp: string;
  /** The raw ErrorClassifier result */
  classification?: {
    type: string;
    shouldRetry: boolean;
    retryStrategy: string;
    confidence: number;
    reasoning: string;
  };
}

/** Mapping from ErrorClassifier type to frontend category + user-friendly text */
const ERROR_TYPE_MAP: Record<
  string,
  {
    category: FrontendErrorCategory;
    severity: ErrorSeverity;
    message: string;
    fix: string[];
  }
> = {
  permanent: {
    category: 'compilation_error',
    severity: 'critical',
    message: '代码编译或测试失败，请检查代码语法和测试用例',
    fix: [
      '查看原始日志中的具体编译/测试错误信息',
      '修复代码中的语法错误或逻辑问题',
      '本地运行相同命令验证修复效果',
      '提交修复后重新运行 Pipeline',
    ],
  },
  transient: {
    category: 'infrastructure_error',
    severity: 'warning',
    message: '基础设施临时错误，可能是网络或资源问题',
    fix: [
      '检查 Runner/K8s 集群运行状态',
      '确认目标环境资源充足（CPU/内存/磁盘）',
      '等待几分钟后点击重试',
      '如果持续失败，联系运维团队排查',
    ],
  },
  config: {
    category: 'configuration_error',
    severity: 'critical',
    message: '配置错误，请检查 Pipeline 配置和环境变量',
    fix: [
      '检查 Pipeline YAML 配置语法是否正确',
      '确认所有必填环境变量已设置',
      '验证参数格式和值是否合法',
      '修正配置后重新运行 Pipeline',
    ],
  },
  flaky: {
    category: 'unknown_error',
    severity: 'info',
    message: '检测到间歇性失败，可能是测试不稳定导致',
    fix: [
      '先尝试重新运行一次确认是否为偶发问题',
      '如果频繁出现，检查测试用例是否存在竞态条件',
      '考虑为不稳定测试添加重试逻辑',
      '收集多次运行的日志进行对比分析',
    ],
  },
};

/** Additional pattern-based overrides for more specific categories */
const SPECIFIC_PATTERNS: Array<{
  pattern: RegExp;
  category: FrontendErrorCategory;
  severity: ErrorSeverity;
  message: string;
  fix: string[];
}> = [
  // Compilation errors
  {
    pattern: /syntax error|compilation failed|cannot find module|type error/i,
    category: 'compilation_error',
    severity: 'critical',
    message: '代码编译失败，请检查语法错误',
    fix: [
      '查看原始日志中的具体编译错误位置',
      '修复对应的语法或类型错误',
      '本地执行编译命令验证修复效果',
      '提交修复后重新运行 Pipeline',
    ],
  },
  // Test failures
  {
    pattern: /test.*failed|assertion.*failed|expect.*received|FAIL.*tests?/i,
    category: 'test_failure',
    severity: 'critical',
    message: '测试未通过，请检查测试用例',
    fix: [
      '查看原始日志中失败的测试用例名称',
      '定位失败原因（预期值 vs 实际值）',
      '修复代码或更新测试期望',
      '本地运行失败的测试验证修复',
    ],
  },
  // Deployment failures
  {
    pattern: /deploy.*fail|rollout.*fail|kubernetes.*error|kubectl.*fail/i,
    category: 'deployment_failure',
    severity: 'critical',
    message: '部署失败，请检查目标环境状态',
    fix: [
      '检查目标 K8s 集群和命名空间状态',
      '确认镜像是否存在且可拉取',
      '查看 Pod 事件日志排查部署失败原因',
      '修复配置或镜像问题后重新部署',
    ],
  },
  // Infrastructure errors
  {
    pattern: /OOMKilled|out of memory|node.*not ready|pod.*evicted/i,
    category: 'infrastructure_error',
    severity: 'critical',
    message: '基础设施资源不足，请检查 Runner/K8s 状态',
    fix: [
      '检查 K8s 节点资源使用情况',
      '确认 Pod 内存/CPU 限制是否合理',
      '必要时扩容节点或调整资源限制',
      '资源恢复后重新运行 Pipeline',
    ],
  },
  // Timeout errors
  {
    pattern: /ETIMEDOUT|timeout|i\/o timeout|deadline exceeded|timed out/i,
    category: 'timeout_error',
    severity: 'warning',
    message: '任务超时，请检查任务耗时或调整超时设置',
    fix: [
      '确认哪个阶段耗时最长',
      '检查是否有依赖服务响应缓慢',
      '适当增加超时阈值或优化任务逻辑',
      '调整后重新运行 Pipeline',
    ],
  },
  // Configuration errors
  {
    pattern: /env.*not (?:set|defined)|missing.*config|invalid configuration|ENOENT|no such file/i,
    category: 'configuration_error',
    severity: 'critical',
    message: '配置错误，请检查 Pipeline 配置',
    fix: [
      '确认缺失的环境变量或配置文件',
      '在 Pipeline 配置或 CI/CD 设置中补充缺失项',
      '验证配置值格式正确',
      '修复后重新运行 Pipeline',
    ],
  },
];

/**
 * Extract error messages from stages and tasks.
 * Stage has error?: string, Task has error?: string.
 */
interface CollectedError {
  message: string;
  stageName: string;
  timestamp: string;
}

function collectErrors(stages: Stage[], tasks: Task[]): CollectedError[] {
  const errors: CollectedError[] = [];

  // Collect from stages
  for (const stage of stages) {
    if (stage.error) {
      errors.push({
        message: stage.error,
        stageName: stage.name,
        timestamp: formatDate(stage.completedAt || stage.startedAt),
      });
    }
  }

  // Collect from tasks (more granular) — attach to stage name
  for (const task of tasks) {
    if (task.error) {
      errors.push({
        message: task.error,
        stageName: task.name,
        timestamp: formatDate(task.completedAt || task.startedAt),
      });
    }
  }

  // Sort by timestamp descending (most recent first)
  errors.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

  return errors;
}

function formatDate(d?: Date): string {
  if (!d) return '';
  return d instanceof Date ? d.toISOString() : String(d);
}

export class PipelineErrorDetailController {
  private classifier: ErrorClassifier;
  private runService: PipelineRunService;

  constructor(database: DatabasePool) {
    this.classifier = new ErrorClassifier(database);
    const runRepo = new PipelineRunRepository(database);
    this.runService = new PipelineRunService(new PipelineEventPublisher(), runRepo);
  }

  /**
   * GET /api/v1/pipelines/:runId/error-detail
   *
   * Returns structured error classification for a failed pipeline run.
   */
  async getErrorDetail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = request.params as { runId: string };
    const { runId } = params;

    if (!runId) {
      await reply.status(400).send({
        error: 'MISSING_PARAMETER',
        message: 'runId is required',
      });
      return;
    }

    try {
      // 1. Fetch the pipeline run detail
      const runDetail = await this.runService.getRunDetail(runId);

      if (!runDetail || !runDetail.run) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Pipeline run '${runId}' not found`,
        });
        return;
      }

      const run = runDetail.run;

      // Only provide error detail for failed/cancelled runs
      if (run.status !== 'failed' && run.status !== 'cancelled') {
        await reply.status(400).send({
          error: 'NOT_FAILED',
          message: 'Error detail is only available for failed or cancelled runs',
        });
        return;
      }

      // 2. Collect error messages from stages and tasks
      const errors = collectErrors(runDetail.stages, runDetail.tasks);

      if (errors.length === 0) {
        // No specific error found, return generic failed info
        await reply.send({
          data: {
            errorType: 'unknown_error',
            severity: 'warning',
            humanReadableMessage: 'Pipeline 运行失败但未捕获到具体错误信息',
            suggestedFix: ['查看原始日志以获取更多详细信息'],
            rawError: '',
            stageName: 'unknown',
            timestamp: formatDate(run.completedAt || run.startedAt),
          },
        });
        return;
      }

      // 3. Use the first (most relevant) error for classification
      const primaryError = errors[0];
      const errorMessage = primaryError.message || 'Unknown error';

      // 4. Run through ErrorClassifier
      const classification = await this.classifier.classifyError(errorMessage, {
        stageName: primaryError.stageName || 'unknown',
        retryCount: 0,
        maxRetries: 3,
      });

      // 5. Map to frontend-friendly category using specific patterns first
      const frontendMapping = this.mapToFrontendCategory(errorMessage, classification.type);

      // 6. Build the response
      const errorDetail: PipelineErrorDetail = {
        errorType: frontendMapping.category,
        severity: frontendMapping.severity,
        humanReadableMessage: frontendMapping.message,
        suggestedFix: frontendMapping.fix,
        rawError: errorMessage,
        stageName: primaryError.stageName || 'unknown',
        timestamp: primaryError.timestamp || formatDate(run.completedAt || run.startedAt),
        classification: {
          type: classification.type,
          shouldRetry: classification.shouldRetry,
          retryStrategy: classification.retryStrategy,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        },
      };

      await reply.send({ data: errorDetail });
    } catch (error) {
      logger.error('[PipelineErrorDetail] Failed to get error detail:', error);
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get error detail',
      });
    }
  }

  /**
   * Map ErrorClassifier type + raw error message to frontend category.
   * Uses specific pattern matching for more accurate categorization.
   */
  private mapToFrontendCategory(
    errorMessage: string,
    classifierType: string
  ): {
    category: FrontendErrorCategory;
    severity: ErrorSeverity;
    message: string;
    fix: string[];
  } {
    // First try specific patterns (most specific match wins)
    for (const pattern of SPECIFIC_PATTERNS) {
      if (pattern.pattern.test(errorMessage)) {
        return {
          category: pattern.category,
          severity: pattern.severity,
          message: pattern.message,
          fix: pattern.fix,
        };
      }
    }

    // Fall back to classifier type mapping
    const fallback = ERROR_TYPE_MAP[classifierType];
    if (fallback) {
      return fallback;
    }

    // Ultimate fallback
    return {
      category: 'unknown_error',
      severity: 'info',
      message: 'Pipeline 运行失败，请查看原始日志排查问题',
      fix: ['查看原始日志获取详细错误信息', '根据日志内容排查并修复问题', '修复后重新运行 Pipeline'],
    };
  }
}
