/**
 * GitHub Client
 * GitHub API 客户端
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface GitHubConfig {
  baseUrl: string;
  token: string;
}

export interface CreateCommitStatusParams {
  owner: string;
  repo: string;
  sha: string;
  state: 'pending' | 'success' | 'failure' | 'cancelled';
  targetUrl?: string;
  description?: string;
  context: string;
}

export interface UpdateCommitStatusParams extends CreateCommitStatusParams {}

export interface BatchUpdateCommitStatusParams {
  owner: string;
  repo: string;
  sha: string;
  state: 'pending' | 'success' | 'failure' | 'cancelled';
  targetUrl?: string;
  description?: string;
  context: string;
}

export class GitHubClient {
  private baseUrl: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(config: GitHubConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.headers = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Orion-Platform-Service/1.0'
    };
  }

  /**
   * 创建提交状态
   */
  async createCommitStatus(params: CreateCommitStatusParams): Promise<void> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/statuses/${params.sha}`;
      
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
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      logger.info({
        owner: params.owner,
        repo: params.repo,
        sha: params.sha,
        context: params.context
      }, 'GitHub commit status created');
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to create GitHub commit status');
      throw error;
    }
  }

  /**
   * 获取提交状态
   */
  async getCommitStatuses(params: {
    owner: string;
    repo: string;
    sha: string;
    context?: string;
  }): Promise<any[]> {
    try {
      let url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/commits/${params.sha}/statuses`;
      
      if (params.context) {
        url += `?context=${encodeURIComponent(params.context)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      const statuses = await response.json();
      return statuses;
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitHub commit statuses');
      throw error;
    }
  }

  /**
   * 更新提交状态
   */
  async updateCommitStatus(params: UpdateCommitStatusParams): Promise<void> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/statuses/${params.sha}`;
      
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
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      logger.info({
        owner: params.owner,
        repo: params.repo,
        sha: params.sha,
        context: params.context
      }, 'GitHub commit status updated');
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to update GitHub commit status');
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
          owner: update.owner,
          repo: update.repo,
          sha: update.sha,
          state: update.state,
          targetUrl: update.targetUrl,
          description: update.description,
          context: update.context
        })
      );

      await Promise.all(promises);
      
      logger.info({
        count: updates.length
      }, 'GitHub commit statuses batch updated');
    } catch (error) {
      logger.error({
        error,
        count: updates.length
      }, 'Failed to batch update GitHub commit statuses');
      throw error;
    }
  }

  /**
   * 获取仓库信息
   */
  async getRepository(params: { owner: string; repo: string }): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitHub repository');
      throw error;
    }
  }

  /**
   * 获取分支信息
   */
  async getBranch(params: { owner: string; repo: string; branch: string }): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/branches/${encodeURIComponent(params.branch)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitHub branch');
      throw error;
    }
  }

  /**
   * 获取提交信息
   */
  async getCommit(params: { owner: string; repo: string; sha: string }): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/commits/${params.sha}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitHub commit');
      throw error;
    }
  }

  /**
   * 获取拉取请求信息
   */
  async getPullRequest(params: { owner: string; repo: string; number: number }): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/pulls/${params.number}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitHub pull request');
      throw error;
    }
  }

  /**
   * 创建 Webhook
   */
  async createWebhook(params: {
    owner: string;
    repo: string;
    url: string;
    secret?: string;
    events: string[];
  }): Promise<any> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/hooks`;
      
      const body = {
        name: 'web',
        active: true,
        events: params.events,
        config: {
          url: params.url,
          content_type: 'json',
          secret: params.secret
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to create GitHub webhook');
      throw error;
    }
  }

  /**
   * 获取 Webhook 列表
   */
  async getWebhooks(params: { owner: string; repo: string }): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/hooks`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to get GitHub webhooks');
      throw error;
    }
  }

  /**
   * 删除 Webhook
   */
  async deleteWebhook(params: { owner: string; repo: string; hookId: number }): Promise<void> {
    try {
      const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/hooks/${params.hookId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      logger.info({
        owner: params.owner,
        repo: params.repo,
        hookId: params.hookId
      }, 'GitHub webhook deleted');
    } catch (error) {
      logger.error({
        error,
        params
      }, 'Failed to delete GitHub webhook');
      throw error;
    }
  }
}