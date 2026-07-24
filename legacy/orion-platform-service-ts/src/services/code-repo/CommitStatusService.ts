/**
 * Commit Status Service
 * Git 提交状态管理服务
 */

import { createLogger } from '../../utils/logger';
import { GitLabAdapter } from './GitLabAdapter';
import { GitLabClient } from '../../clients/GitLabClient';
import { GitHubClient } from '../../clients/GitHubClient';
import { OrionError } from '../../errors';
import { safeFetch } from '../../utils/safeFetch';

// Local type definitions (not yet in types.ts)
export enum CommitStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum GitProvider {
  GITLAB = 'gitlab',
  GITHUB = 'github',
}

const logger = createLogger('CommitStatusService');

/** Pipeline run status as seen by SCM integration */
export type PipelineRunOutcome = 'success' | 'failure' | 'cancelled';

/** Stage summary for PR comment rendering */
export interface StageSummaryItem {
  name: string;
  status: string;
  durationMs: number;
}

export interface CommitStatusInput {
  repositoryId: string;
  commitSha: string;
  state: CommitStatus;
  targetUrl?: string;
  description?: string;
  context: string;
}

export interface CommitStatusQuery {
  repositoryId: string;
  commitSha: string;
  context?: string;
}

export interface CommitStatusServiceConfig {
  gitLabToken?: string;
  gitLabBaseUrl?: string;
  githubToken?: string;
  githubBaseUrl?: string;
}

export class CommitStatusService {
  private gitLabAdapter: GitLabAdapter;
  private gitLabClient: GitLabClient;
  private githubClient: GitHubClient;

  constructor(config?: CommitStatusServiceConfig) {
    this.gitLabClient = new GitLabClient({
      baseUrl: config?.gitLabBaseUrl || process.env.GITLAB_BASE_URL || 'https://gitlab.com',
      token: config?.gitLabToken || process.env.GITLAB_TOKEN || ''
    });

    this.githubClient = new GitHubClient({
      baseUrl: config?.githubBaseUrl || process.env.GITHUB_BASE_URL || 'https://api.github.com',
      token: config?.githubToken || process.env.GITHUB_TOKEN || ''
    });

    this.gitLabAdapter = new GitLabAdapter({
      baseUrl: config?.gitLabBaseUrl || process.env.GITLAB_BASE_URL || 'https://gitlab.com',
      token: config?.gitLabToken || process.env.GITLAB_TOKEN || ''
    });
  }

  /**
   * 创建提交状态
   */
  async createStatus(input: CommitStatusInput): Promise<void> {
    try {
      const provider = this.detectProvider(input.repositoryId);
      
      switch (provider) {
        case GitProvider.GITLAB:
          await this.createGitLabStatus(input);
          break;
        case GitProvider.GITHUB:
          await this.createGitHubStatus(input);
          break;
        default:
          throw new OrionError(`Unsupported Git provider: ${provider}`, 'VALIDATION_ERROR')
      }
      
      logger.info({
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
        context: input.context,
        state: input.state
      }, 'Commit status created successfully');
    } catch (error) {
      logger.error({
        error,
        input
      }, 'Failed to create commit status');
      throw error;
    }
  }

  /**
   * 获取提交状态
   */
  async getStatus(query: CommitStatusQuery): Promise<any[]> {
    try {
      const provider = this.detectProvider(query.repositoryId);
      
      switch (provider) {
        case GitProvider.GITLAB:
          return await this.getGitLabStatus(query);
        case GitProvider.GITHUB:
          return await this.getGitHubStatus(query);
        default:
          throw new OrionError(`Unsupported Git provider: ${provider}`, 'VALIDATION_ERROR')
      }
    } catch (error) {
      logger.error({
        error,
        query
      }, 'Failed to get commit status');
      throw error;
    }
  }

  /**
   * 获取提交状态详情
   */
  async getStatusDetail(query: CommitStatusQuery): Promise<any> {
    try {
      const provider = this.detectProvider(query.repositoryId);
      
      switch (provider) {
        case GitProvider.GITLAB:
          return await this.getGitLabStatusDetail(query);
        case GitProvider.GITHUB:
          return await this.getGitHubStatusDetail(query);
        default:
          throw new OrionError(`Unsupported Git provider: ${provider}`, 'VALIDATION_ERROR')
      }
    } catch (error) {
      logger.error({
        error,
        query
      }, 'Failed to get commit status detail');
      throw error;
    }
  }

  /**
   * 更新提交状态
   */
  async updateStatus(input: CommitStatusInput): Promise<void> {
    try {
      // 先删除现有状态，然后创建新状态
      await this.deleteStatus({
        repositoryId: input.repositoryId,
        commitSha: input.commitSha,
        context: input.context
      });
      
      await this.createStatus(input);
    } catch (error) {
      logger.error({
        error,
        input
      }, 'Failed to update commit status');
      throw error;
    }
  }

  /**
   * 删除提交状态
   */
  async deleteStatus(query: CommitStatusQuery): Promise<void> {
    try {
      const provider = this.detectProvider(query.repositoryId);
      
      switch (provider) {
        case GitProvider.GITLAB:
          await this.deleteGitLabStatus(query);
          break;
        case GitProvider.GITHUB:
          await this.deleteGitHubStatus(query);
          break;
        default:
          throw new OrionError(`Unsupported Git provider: ${provider}`, 'VALIDATION_ERROR')
      }
      
      logger.info({
        repositoryId: query.repositoryId,
        commitSha: query.commitSha,
        context: query.context
      }, 'Commit status deleted successfully');
    } catch (error) {
      logger.error({
        error,
        query
      }, 'Failed to delete commit status');
      throw error;
    }
  }

  /**
   * 批量更新提交状态
   */
  async batchUpdateStatuses(inputs: CommitStatusInput[]): Promise<void> {
    try {
      const grouped = this.groupByProvider(inputs);
      
      for (const [provider, statusInputs] of grouped) {
        switch (provider) {
          case GitProvider.GITLAB:
            await this.batchUpdateGitLabStatuses(statusInputs);
            break;
          case GitProvider.GITHUB:
            await this.batchUpdateGitHubStatuses(statusInputs);
            break;
        }
      }
      
      logger.info({
        count: inputs.length
      }, 'Batch commit status update completed');
    } catch (error) {
      logger.error({
        error,
        count: inputs.length
      }, 'Failed to batch update commit statuses');
      throw error;
    }
  }

  /**
   * 检查提交是否通过所有状态检查
   */
  async checkCommitReadiness(repositoryId: string, commitSha: string): Promise<{
    ready: boolean;
    statuses: any[];
    failedContexts: string[];
  }> {
    try {
      const statuses = await this.getStatus({
        repositoryId,
        commitSha
      });

      const failedContexts = statuses
        .filter(status => status.state !== 'success')
        .map(status => status.context);

      const ready = failedContexts.length === 0;

      return {
        ready,
        statuses,
        failedContexts
      };
    } catch (error) {
      logger.error({
        error,
        repositoryId,
        commitSha
      }, 'Failed to check commit readiness');
      throw error;
    }
  }

  /**
   * 创建 GitLab 提交状态
   */
  private async createGitLabStatus(input: CommitStatusInput): Promise<void> {
    const gitlabStateMap: Record<string, 'pending' | 'success' | 'failed' | 'canceled'> = {
      [CommitStatus.PENDING]: 'pending',
      [CommitStatus.SUCCESS]: 'success',
      [CommitStatus.FAILED]: 'failed',
      [CommitStatus.CANCELLED]: 'canceled'
    };

    const state = gitlabStateMap[input.state];
    if (!state) {
      throw new OrionError(`Unsupported state for GitLab: ${input.state}`, 'VALIDATION_ERROR')
    }

    await this.gitLabClient.createCommitStatus({
      projectId: input.repositoryId,
      commitSha: input.commitSha,
      state,
      targetUrl: input.targetUrl,
      description: input.description,
      context: input.context
    });
  }

  /**
   * 创建 GitHub 提交状态
   */
  private async createGitHubStatus(input: CommitStatusInput): Promise<void> {
    const githubStateMap: Record<string, 'pending' | 'success' | 'failure' | 'cancelled'> = {
      [CommitStatus.PENDING]: 'pending',
      [CommitStatus.SUCCESS]: 'success',
      [CommitStatus.FAILED]: 'failure',
      [CommitStatus.CANCELLED]: 'cancelled'
    };

    const state = githubStateMap[input.state];
    if (!state) {
      throw new OrionError(`Unsupported state for GitHub: ${input.state}`, 'VALIDATION_ERROR')
    }

    await this.githubClient.createCommitStatus({
      owner: this.extractOwner(input.repositoryId),
      repo: this.extractRepo(input.repositoryId),
      sha: input.commitSha,
      state,
      targetUrl: input.targetUrl,
      description: input.description,
      context: input.context
    });
  }

  /**
   * 获取 GitLab 提交状态
   */
  private async getGitLabStatus(query: CommitStatusQuery): Promise<any[]> {
    return await this.gitLabClient.getCommitStatuses({
      projectId: query.repositoryId,
      commitSha: query.commitSha,
      context: query.context
    });
  }

  /**
   * 获取 GitHub 提交状态
   */
  private async getGitHubStatus(query: CommitStatusQuery): Promise<any[]> {
    return await this.githubClient.getCommitStatuses({
      owner: this.extractOwner(query.repositoryId),
      repo: this.extractRepo(query.repositoryId),
      sha: query.commitSha,
      context: query.context
    });
  }

  /**
   * 获取 GitLab 提交状态详情
   */
  private async getGitLabStatusDetail(query: CommitStatusQuery): Promise<any> {
    const statuses = await this.getGitLabStatus(query);
    return statuses[0] || null;
  }

  /**
   * 获取 GitHub 提交状态详情
   */
  private async getGitHubStatusDetail(query: CommitStatusQuery): Promise<any> {
    const statuses = await this.getGitHubStatus(query);
    return statuses[0] || null;
  }

  /**
   * 删除 GitLab 提交状态
   */
  private async deleteGitLabStatus(query: CommitStatusQuery): Promise<void> {
    // GitLab API 不直接支持删除状态，需要通过更新状态来实现
    await this.gitLabClient.updateCommitStatus({
      projectId: query.repositoryId,
      commitSha: query.commitSha,
      state: 'canceled',
      context: query.context || '',
      description: 'Status deleted by system'
    });
  }

  /**
   * 删除 GitHub 提交状态
   */
  private async deleteGitHubStatus(query: CommitStatusQuery): Promise<void> {
    // GitHub API 不直接支持删除状态，需要通过更新状态来实现
    await this.githubClient.updateCommitStatus({
      owner: this.extractOwner(query.repositoryId),
      repo: this.extractRepo(query.repositoryId),
      sha: query.commitSha,
      state: 'cancelled',
      context: query.context || '',
      description: 'Status deleted by system'
    });
  }

  /**
   * 批量更新 GitLab 提交状态
   */
  private async batchUpdateGitLabStatuses(inputs: CommitStatusInput[]): Promise<void> {
    const gitlabStateMap: Record<string, 'pending' | 'success' | 'failed' | 'canceled'> = {
      [CommitStatus.PENDING]: 'pending',
      [CommitStatus.SUCCESS]: 'success',
      [CommitStatus.FAILED]: 'failed',
      [CommitStatus.CANCELLED]: 'canceled'
    };

    const updates = inputs.map(input => ({
      projectId: input.repositoryId,
      commitSha: input.commitSha,
      state: gitlabStateMap[input.state] as 'pending' | 'success' | 'failed' | 'canceled',
      targetUrl: input.targetUrl,
      description: input.description,
      context: input.context
    }));

    await this.gitLabClient.batchUpdateCommitStatuses(updates);
  }

  /**
   * 批量更新 GitHub 提交状态
   */
  private async batchUpdateGitHubStatuses(inputs: CommitStatusInput[]): Promise<void> {
    const githubStateMap: Record<string, 'pending' | 'success' | 'failure' | 'cancelled'> = {
      [CommitStatus.PENDING]: 'pending',
      [CommitStatus.SUCCESS]: 'success',
      [CommitStatus.FAILED]: 'failure',
      [CommitStatus.CANCELLED]: 'cancelled'
    };

    const updates = inputs.map(input => ({
      owner: this.extractOwner(input.repositoryId),
      repo: this.extractRepo(input.repositoryId),
      sha: input.commitSha,
      state: githubStateMap[input.state] as 'pending' | 'success' | 'failure' | 'cancelled',
      targetUrl: input.targetUrl,
      description: input.description,
      context: input.context
    }));

    await this.githubClient.batchUpdateCommitStatuses(updates);
  }

  /**
   * 检测 Git 提供商
   */
  private detectProvider(repositoryId: string): GitProvider {
    if (repositoryId.includes('gitlab') || repositoryId.includes('gl-')) {
      return GitProvider.GITLAB;
    } else if (repositoryId.includes('github') || repositoryId.includes('gh-')) {
      return GitProvider.GITHUB;
    }
    
    // 默认尝试 GitLab
    return GitProvider.GITLAB;
  }

  /**
   * 从仓库 ID 提取所有者
   */
  private extractOwner(repositoryId: string): string {
    const parts = repositoryId.split('/');
    return parts[0];
  }

  /**
   * 从仓库 ID 提取仓库名
   */
  private extractRepo(repositoryId: string): string {
    const parts = repositoryId.split('/');
    return parts[1];
  }

  /**
   * 按提供商分组
   */
  private groupByProvider(inputs: CommitStatusInput[]): Map<GitProvider, CommitStatusInput[]> {
    const grouped = new Map<GitProvider, CommitStatusInput[]>();

    inputs.forEach(input => {
      const provider = this.detectProvider(input.repositoryId);

      if (!grouped.has(provider)) {
        grouped.set(provider, []);
      }

      const existing = grouped.get(provider);
      if (existing) {
        existing.push(input);
      }
    });

    return grouped;
  }

  // ==================== PR Comment Integration ====================

  /**
   * Post a structured PR comment with pipeline results.
   *
   * @param provider - SCM provider (github | gitlab)
   * @param repositoryId - Repository identifier (owner/repo for GitHub, project-id for GitLab)
   * @param prNumber - Pull Request / Merge Request number
   * @param pipelineRunId - Orion pipeline run ID
   * @param pipelineName - Human-readable pipeline name
   * @param outcome - Pipeline result (success | failure | cancelled)
   * @param targetUrl - Link back to Orion run details
   * @param stagesSummary - Stage-level results for markdown table
   */
  async postPrComment(
    provider: GitProvider,
    repositoryId: string,
    prNumber: number,
    pipelineRunId: string,
    pipelineName: string,
    outcome: PipelineRunOutcome,
    targetUrl: string,
    stagesSummary?: StageSummaryItem[]
  ): Promise<void> {
    const emoji = outcome === 'success' ? '\u{1F7E2}' : outcome === 'failure' ? '\u{1F534}' : '\u{26AA}';
    const statusText = outcome === 'success' ? 'completed successfully' : outcome === 'failure' ? 'failed' : 'cancelled';

    let comment = `${emoji} Pipeline **${pipelineName}** (#${pipelineRunId}) ${statusText}\n\n`;

    if (stagesSummary && stagesSummary.length > 0) {
      comment += '| Stage | Status | Duration |\n';
      comment += '|-------|--------|----------|\n';
      for (const stage of stagesSummary) {
        const icon = stage.status === 'success' ? '\u2705 Pass' : stage.status === 'failed' ? '\u274C Fail' : stage.status === 'skipped' ? '\u23ED Skip' : `\u2753 ${stage.status}`;
        const duration = this.formatDuration(stage.durationMs);
        comment += `| ${stage.name} | ${icon} | ${duration} |\n`;
      }
      comment += '\n';
    }

    comment += `[View full details in Orion](${targetUrl})`;

    try {
      switch (provider) {
        case GitProvider.GITHUB:
          await this.postGitHubComment(repositoryId, prNumber, comment);
          break;
        case GitProvider.GITLAB:
          await this.postGitLabComment(repositoryId, prNumber, comment);
          break;
        default:
          throw new OrionError(`Unsupported Git provider: ${provider}`, 'VALIDATION_ERROR')
      }

      logger.info(
        { provider, repositoryId, prNumber, pipelineRunId, outcome },
        'PR comment posted successfully'
      );
    } catch (error) {
      logger.error(
        { error, provider, repositoryId, prNumber, pipelineRunId },
        'Failed to post PR comment'
      );
      // Do not rethrow — PR comment posting should not affect pipeline status
    }
  }

  /**
   * Post a comment on a GitHub Pull Request.
   * Uses POST /repos/{owner}/{repo}/issues/{number}/comments
   */
  private async postGitHubComment(
    repositoryId: string,
    prNumber: number,
    body: string
  ): Promise<void> {
    const owner = this.extractOwner(repositoryId);
    const repo = this.extractRepo(repositoryId);
    const url = `${this.githubClient['baseUrl']}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    const response = await safeFetch(url, {
      method: 'POST',
      headers: this.githubClient['headers'] as Record<string, string>,
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OrionError(`GitHub API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
    }
  }

  /**
   * Post a comment on a GitLab Merge Request.
   * Uses POST /api/v4/projects/{id}/merge_requests/{iid}/notes
   */
  private async postGitLabComment(
    projectId: string,
    mrIid: number,
    body: string
  ): Promise<void> {
    const url = `${this.gitLabClient['baseUrl']}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/notes`;

    const response = await safeFetch(url, {
      method: 'POST',
      headers: this.gitLabClient['headers'] as Record<string, string>,
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
    }
  }

  // ==================== GitHub Check Run Integration ====================

  /**
   * Create a GitHub Check Run (more feature-rich than commit status).
   * Supports check suites, annotations, and detailed output.
   *
   * POST /repos/{owner}/{repo}/check-runs
   */
  async createCheckRun(input: {
    owner: string;
    repo: string;
    name: string;
    headSha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
    detailsUrl?: string;
    output?: {
      title: string;
      summary: string;
      text?: string;
    };
    token?: string;
  }): Promise<number | undefined> {
    try {
      const url = `https://api.github.com/repos/${input.owner}/${input.repo}/check-runs`;

      const checkHeaders: Record<string, string> = {
        'Authorization': `Bearer ${input.token || process.env.GITHUB_TOKEN || ''}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Orion-Platform-Service/1.0',
      };

      const body: Record<string, unknown> = {
        name: input.name,
        head_sha: input.headSha,
        status: input.status,
      };

      if (input.conclusion) {
        body.conclusion = input.conclusion;
      }
      if (input.detailsUrl) {
        body.details_url = input.detailsUrl;
      }
      if (input.output) {
        body.output = input.output;
      }

      const response = await safeFetch(url, {
        method: 'POST',
        headers: checkHeaders,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitHub Check Run API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      const result = (await response.json()) as { id: number };
      const checkRunId = result.id;

      logger.info(
        { owner: input.owner, repo: input.repo, checkRunId, name: input.name, status: input.status },
        'GitHub Check Run created'
      );

      return checkRunId;
    } catch (error) {
      logger.error(
        { error, input },
        'Failed to create GitHub Check Run'
      );
      // Do not rethrow — Check Run creation is non-critical
      return undefined;
    }
  }

  /**
   * Update an existing GitHub Check Run.
   * PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}
   */
  async updateCheckRun(input: {
    owner: string;
    repo: string;
    checkRunId: number;
    status?: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
    output?: {
      title: string;
      summary: string;
      text?: string;
    };
    detailsUrl?: string;
    token?: string;
  }): Promise<void> {
    try {
      const url = `https://api.github.com/repos/${input.owner}/${input.repo}/check-runs/${input.checkRunId}`;

      const checkHeaders: Record<string, string> = {
        'Authorization': `Bearer ${input.token || process.env.GITHUB_TOKEN || ''}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Orion-Platform-Service/1.0',
      };

      const body: Record<string, unknown> = {};

      if (input.status) {
        body.status = input.status;
      }
      if (input.conclusion) {
        body.conclusion = input.conclusion;
      }
      if (input.output) {
        body.output = input.output;
      }
      if (input.detailsUrl) {
        body.details_url = input.detailsUrl;
      }

      const response = await safeFetch(url, {
        method: 'PATCH',
        headers: checkHeaders,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitHub Check Run API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      logger.info(
        { owner: input.owner, repo: input.repo, checkRunId: input.checkRunId },
        'GitHub Check Run updated'
      );
    } catch (error) {
      logger.error(
        { error, input },
        'Failed to update GitHub Check Run'
      );
    }
  }

  // ==================== Helpers ====================

  /**
   * Format duration in ms to human-readable string.
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}