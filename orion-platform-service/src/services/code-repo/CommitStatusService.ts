/**
 * Commit Status Service
 * Git 提交状态管理服务
 */

import pino from 'pino';
import { GitLabAdapter } from './GitLabAdapter';
import { GitLabClient } from '../../clients/GitLabClient';
import { GitHubClient } from '../../clients/GitHubClient';
import { CommitStatus, GitProvider } from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
          throw new Error(`Unsupported Git provider: ${provider}`);
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
          throw new Error(`Unsupported Git provider: ${provider}`);
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
          throw new Error(`Unsupported Git provider: ${provider}`);
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
          throw new Error(`Unsupported Git provider: ${provider}`);
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
      throw new Error(`Unsupported state for GitLab: ${input.state}`);
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
      throw new Error(`Unsupported state for GitHub: ${input.state}`);
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
}