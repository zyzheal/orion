/**
 * ScmStatusReporter - SCM 双向状态回写
 *
 * 负责：
 * - 向 SCM 提供商（GitHub/GitLab）报告 commit status
 * - 在 PR 上发布流水线结果评论
 * - 解析 Git provider 类型
 */

import { PipelineRun } from '../models/PipelineRun';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { CommitStatusService, CommitStatus, GitProvider, StageSummaryItem } from '../services/code-repo/CommitStatusService';
import { PipelineExecution } from './PipelineEngine';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ScmStatusReporterDeps {
  pipelineService: PipelineService;
  runService: PipelineRunService;
  scmStatusService: CommitStatusService | null;
}

export class ScmStatusReporter {
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private scmStatusService: CommitStatusService | null;

  constructor(deps: ScmStatusReporterDeps) {
    this.pipelineService = deps.pipelineService;
    this.runService = deps.runService;
    this.scmStatusService = deps.scmStatusService;
  }

  /**
   * Report pipeline status back to the SCM provider (GitHub/GitLab).
   *
   * This writes a commit status and, when available, a PR comment with
   * structured results. The pipeline run context must contain SCM metadata
   * in `context.git` or `context.scmProvider`/`context.repository`.
   *
   * @param run - The completed (or starting) pipeline run
   * @param outcome - The outcome to report: 'pending', 'success', 'failure', 'cancelled'
   */
  async reportScmStatus(
    run: PipelineRun,
    outcome: 'pending' | 'success' | 'failure' | 'cancelled',
    executions: Map<string, PipelineExecution>
  ): Promise<void> {
    if (!this.scmStatusService) return;

    // Extract SCM context from the run
    const gitCtx = (run.context as any)?.git || {};
    const commitSha = gitCtx.sha || (run.context as any)?.commitSha || gitCtx.commitSha;
    const repository = gitCtx.repo || (run.context as any)?.repository || (run.context as any)?.scmProvider;

    if (!commitSha) {
      logger.debug({ runId: run.id }, 'No commit SHA in run context, skipping SCM status');
      return;
    }

    // Determine provider from repository string or explicit context
    const provider = this.resolveGitProvider(repository, run);
    if (!provider) {
      logger.debug({ runId: run.id, repository }, 'Could not resolve Git provider, skipping SCM status');
      return;
    }

    const statusState = this.mapOutcomeToCommitStatus(outcome);
    const pipelineName = await this.getPipelineName(run.pipelineId);
    const targetUrl = `${process.env.ORION_BASE_URL || 'http://localhost:3000'}/pipelines/${run.pipelineId}/runs/${run.id}`;

    // Build description based on outcome
    const description = outcome === 'pending'
      ? `Pipeline "${pipelineName}" is running...`
      : outcome === 'success'
        ? `Pipeline "${pipelineName}" completed successfully`
        : outcome === 'failure'
          ? `Pipeline "${pipelineName}" failed`
          : `Pipeline "${pipelineName}" was cancelled`;

    try {
      await this.scmStatusService.createStatus({
        repositoryId: repository || 'unknown',
        commitSha,
        state: statusState,
        targetUrl,
        description,
        context: `orion/${pipelineName}`,
      });

      logger.info(
        { runId: run.id, provider, commitSha, state: statusState, context: `orion/${pipelineName}` },
        'SCM commit status reported'
      );

      // Post PR comment on completion (not for pending)
      if (outcome !== 'pending') {
        await this.reportPrCommentIfNeeded(run, outcome, pipelineName, targetUrl, executions);
      }
    } catch (error) {
      logger.error(
        { runId: run.id, error: error instanceof Error ? error.message : String(error) },
        'SCM status reporting failed'
      );
    }
  }

  /**
   * Post a PR comment with pipeline results if the run is associated with a PR.
   */
  private async reportPrCommentIfNeeded(
    run: PipelineRun,
    outcome: 'success' | 'failure' | 'cancelled',
    pipelineName: string,
    targetUrl: string,
    executions: Map<string, PipelineExecution>
  ): Promise<void> {
    if (!this.scmStatusService) return;

    const gitCtx = (run.context as any)?.git || {};
    const prNumber = (run.context as any)?.prNumber || gitCtx.prNumber || (run.context as any)?.pullRequest?.number;

    if (!prNumber) {
      return;
    }

    const repository = gitCtx.repo || (run.context as any)?.repository || 'unknown';
    const provider = this.resolveGitProvider(repository, run);
    if (!provider) return;

    // Build stages summary
    const stagesSummary: StageSummaryItem[] = await this.buildStagesSummary(run.id, executions);

    // PR number must be a number
    const prNum = typeof prNumber === 'number' ? prNumber : parseInt(prNumber, 10);
    if (isNaN(prNum)) return;

    await this.scmStatusService.postPrComment(
      provider,
      repository,
      prNum,
      run.id,
      pipelineName,
      outcome,
      targetUrl,
      stagesSummary
    );
  }

  /**
   * 构建 Stages 摘要信息（for PR comments）
   */
  private async buildStagesSummary(runId: string, executions: Map<string, PipelineExecution>): Promise<StageSummaryItem[]> {
    // 先从内存执行上下文查找（如果还在内存中）
    const execution = executions.get(runId);
    if (execution) {
      return Array.from(execution.stages.values()).map(stage => ({
        name: stage.name,
        status: stage.status,
        durationMs: stage.durationMs || 0,
      }));
    }

    // 回退到从数据库查询
    try {
      const stages = await this.runService.getStages(runId);
      return stages.map(stage => ({
        name: stage.name,
        status: stage.status,
        durationMs: stage.durationMs || 0,
      }));
    } catch (error) {
      logger.warn({ runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to build stages summary for SCM');
      return [];
    }
  }

  /**
   * Resolve the Git provider from repository string or run context.
   */
  resolveGitProvider(
    repository: string | undefined,
    run: PipelineRun
  ): GitProvider | null {
    const explicitProvider = (run.context as any)?.scmProvider;
    if (explicitProvider === 'github' || explicitProvider === 'gitlab') {
      return explicitProvider as GitProvider;
    }

    if (!repository) return null;

    // Infer from repository string format
    const lower = repository.toLowerCase();
    if (lower.startsWith('github:') || lower.includes('github.com')) {
      return GitProvider.GITHUB;
    }
    if (lower.startsWith('gitlab:') || lower.includes('gitlab.com')) {
      return GitProvider.GITLAB;
    }

    // Detect provider from repository ID pattern (matches CommitStatusService.detectProvider)
    if (repository.includes('gitlab') || repository.includes('gl-')) {
      return GitProvider.GITLAB;
    }
    if (repository.includes('github') || repository.includes('gh-')) {
      return GitProvider.GITHUB;
    }

    // Default to GitLab
    return GitProvider.GITLAB;
  }

  /**
   * Map pipeline outcome to CommitStatus enum.
   */
  mapOutcomeToCommitStatus(
    outcome: 'pending' | 'success' | 'failure' | 'cancelled'
  ): CommitStatus {
    switch (outcome) {
      case 'pending': return CommitStatus.PENDING;
      case 'success': return CommitStatus.SUCCESS;
      case 'failure': return CommitStatus.FAILED;
      case 'cancelled': return CommitStatus.CANCELLED;
      default: return CommitStatus.PENDING;
    }
  }

  /**
   * Get pipeline name from PipelineService.
   */
  async getPipelineName(pipelineId: string): Promise<string> {
    try {
      const pipeline = await this.pipelineService.getById(pipelineId);
      return pipeline?.name || pipelineId;
    } catch {
      return pipelineId;
    }
  }
}
