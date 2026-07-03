/**
 * GitLab Client
 * GitLab API 客户端
 */

import { createLogger } from '../utils/logger';
import { OrionError } from '../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface GitLabConfig {
  baseUrl: string;
  token: string;
}

export interface CreateCommitStatusParams {
  projectId: string;
  commitSha: string;
  state: 'pending' | 'success' | 'failed' | 'canceled';
  targetUrl?: string;
  description?: string;
  context: string;
}

export interface UpdateCommitStatusParams extends CreateCommitStatusParams {}

export interface BatchUpdateCommitStatusParams {
  projectId: string;
  commitSha: string;
  state: 'pending' | 'success' | 'failed' | 'canceled';
  targetUrl?: string;
  description?: string;
  context: string;
}

export class GitLabClient {
  private baseUrl: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(config: GitLabConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Orion-Platform-Service/1.0'
    };
  }

  /**
   * 创建提交状态
   */
  async createCommitStatus(params: CreateCommitStatusParams): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/statuses/${params.commitSha}`;
      
      const body = {
        state: params.state,
        target_url: params.targetUrl,
        description: params.description,
        context: params.context
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      logger.info({
        projectId: params.projectId,
        commitSha: params.commitSha,
        context: params.context
      }, 'GitLab commit status created');
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to create GitLab commit status');
      throw error;
    }
  }

  /**
   * 获取提交状态
   */
  async getCommitStatuses(params: {
    projectId: string;
    commitSha: string;
    context?: string;
  }): Promise<any[]> {
    try {
      const url = new URL(`${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/statuses/${params.commitSha}`);
      
      if (params.context) {
        url.searchParams.append('context', params.context);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      const statuses = await response.json();
      return statuses as any[];
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitLab commit statuses');
      throw error;
    }
  }

  /**
   * 更新提交状态
   */
  async updateCommitStatus(params: UpdateCommitStatusParams): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/statuses/${params.commitSha}`;
      
      const body = {
        state: params.state,
        target_url: params.targetUrl,
        description: params.description,
        context: params.context
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      logger.info({
        projectId: params.projectId,
        commitSha: params.commitSha,
        context: params.context
      }, 'GitLab commit status updated');
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to update GitLab commit status');
      throw error;
    }
  }

  /**
   * 批量更新提交状态
   */
  async batchUpdateCommitStatuses(updates: BatchUpdateCommitStatusParams[]): Promise<void> {
    try {
      const promises = updates.map(update => 
        this.updateCommitStatus({
          projectId: update.projectId,
          commitSha: update.commitSha,
          state: update.state,
          targetUrl: update.targetUrl,
          description: update.description,
          context: update.context
        })
      );

      await Promise.all(promises);
      
      logger.info({
        count: updates.length
      }, 'GitLab commit statuses batch updated');
    } catch (error) {
      logger.error({
        error,
        count: updates.length
      }, 'Failed to batch update GitLab commit statuses');
      throw error;
    }
  }

  /**
   * 获取项目信息
   */
  async getProject(params: { projectId: string }): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitLab project');
      throw error;
    }
  }

  /**
   * 获取分支信息
   */
  async getBranch(params: { projectId: string; branch: string }): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/repository/branches/${encodeURIComponent(params.branch)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitLab branch');
      throw error;
    }
  }

  /**
   * 获取提交信息
   */
  async getCommit(params: { projectId: string; commitSha: string }): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/repository/commits/${params.commitSha}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitLab commit');
      throw error;
    }
  }

  /**
   * 获取合并请求信息
   */
  async getMergeRequest(params: { projectId: string; mergeRequestId: number }): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/merge_requests/${params.mergeRequestId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitLab merge request');
      throw error;
    }
  }

  /**
   * 创建 Webhook
   */
  async createWebhook(params: {
    projectId: string;
    url: string;
    secretToken?: string;
    events: string[];
  }): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/hooks`;
      
      const body = {
        url: params.url,
        token: params.secretToken,
        events: params.events
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrionError(`GitLab API error: ${response.status} - ${errorText}`, 'OPERATION_FAILED')
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to create GitLab webhook');
      throw error;
    }
  }
}