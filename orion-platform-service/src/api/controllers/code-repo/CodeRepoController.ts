/**
 * Code Repository Controller - 代码仓库管理控制器
 *
 * 提供代码仓库 CRUD、分支管理、PR/MR 管理等 API 端点
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  GitLabAdapter,
  GerritAdapter,
  ICodeRepoAdapter,
  RepoType,
  PullRequestStatus,
  MergeStrategy,
} from '../../../services/code-repo';
import { OrionError, ErrorCode } from '../../../errors';

/** 已注册的代码仓库适配器 */
const adapters = new Map<string, ICodeRepoAdapter>();

/** 注册适配器 (由应用启动时调用) */
export function registerAdapter(id: string, adapter: ICodeRepoAdapter): void {
  adapters.set(id, adapter);
}

/** 注册 GitLab 实例 */
export function registerGitLabInstance(id: string, config: {
  baseUrl: string;
  token: string;
}): void {
  const adapter = new GitLabAdapter({
    baseUrl: config.baseUrl,
    token: config.token,
  });
  registerAdapter(id, adapter);
}

/** 注册 Gerrit 实例 */
export function registerGerritInstance(id: string, config: {
  baseUrl: string;
  username: string;
  password: string;
}): void {
  const adapter = new GerritAdapter({
    baseUrl: config.baseUrl,
    username: config.username,
    password: config.password,
  });
  registerAdapter(id, adapter);
}

/** 获取适配器 */
function getAdapter(adapterId: string): ICodeRepoAdapter {
  const adapter = adapters.get(adapterId);
  if (!adapter) {
    throw new OrionError(ErrorCode.NOT_FOUND, `Adapter '${adapterId}' not found`);
  }
  return adapter;
}

/** 已注册的适配器列表 */
export function listRegisteredAdapters(): { id: string; type: RepoType }[] {
  return Array.from(adapters.entries()).map(([id, adapter]) => ({
    id,
    type: adapter.type,
  }));
}

export class CodeRepoController {
  /**
   * 获取已注册的适配器列表
   */
  async listAdapters(request: FastifyRequest, reply: FastifyReply) {
    const registered = listRegisteredAdapters();
    return reply.send({
      success: true,
      data: registered,
      count: registered.length,
    });
  }

  /**
   * 获取仓库信息
   */
  async getRepository(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId } = request.params as { adapterId: string };
      const { projectId } = request.query as { projectId: string };

      if (!projectId) {
        return reply.status(400).send({
          success: false,
          error: 'projectId query parameter is required',
        });
      }

      const adapter = getAdapter(adapterId);
      const repo = await adapter.getRepository(projectId);

      return reply.send({ success: true, data: repo });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取仓库列表
   */
  async listRepositories(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId } = request.params as { adapterId: string };
      const { search, page, limit } = request.query as {
        search?: string;
        page?: string;
        limit?: string;
      };

      const adapter = getAdapter(adapterId);
      const repos = await adapter.listRepositories({
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });

      return reply.send({
        success: true,
        data: repos.repos,
        total: repos.total,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取分支列表
   */
  async listBranches(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId } = request.params as {
        adapterId: string;
        repoId: string;
      };
      const { page, limit } = request.query as {
        page?: string;
        limit?: string;
      };

      const adapter = getAdapter(adapterId);
      const branches = await adapter.listBranches(repoId, {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });

      return reply.send({
        success: true,
        data: branches.branches,
        total: branches.total,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取分支详情
   */
  async getBranch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, branchName } = request.params as {
        adapterId: string;
        repoId: string;
        branchName: string;
      };

      const adapter = getAdapter(adapterId);
      const branch = await adapter.getBranch(repoId, branchName);

      return reply.send({ success: true, data: branch });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 创建分支
   */
  async createBranch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId } = request.params as {
        adapterId: string;
        repoId: string;
      };
      const body = request.body as { name: string; sourceRef: string };

      if (!body.name || !body.sourceRef) {
        return reply.status(400).send({
          success: false,
          error: 'name and sourceRef are required',
        });
      }

      const adapter = getAdapter(adapterId);
      const branch = await adapter.createBranch(repoId, body.name, body.sourceRef);

      return reply.status(201).send({ success: true, data: branch });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 删除分支
   */
  async deleteBranch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, branchName } = request.params as {
        adapterId: string;
        repoId: string;
        branchName: string;
      };

      const adapter = getAdapter(adapterId);
      await adapter.deleteBranch(repoId, branchName);

      return reply.send({ success: true, message: `Branch '${branchName}' deleted` });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取 PR/MR 列表
   */
  async listPullRequests(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId } = request.params as {
        adapterId: string;
        repoId: string;
      };
      const { state, page, limit } = request.query as {
        state?: string;
        page?: string;
        limit?: string;
      };

      const adapter = getAdapter(adapterId);
      const prs = await adapter.listPullRequests(repoId, {
        state: state as PullRequestStatus,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });

      return reply.send({
        success: true,
        data: prs.pullRequests,
        total: prs.total,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取 PR/MR 详情
   */
  async getPullRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, prId } = request.params as {
        adapterId: string;
        repoId: string;
        prId: string;
      };

      const adapter = getAdapter(adapterId);
      const pr = await adapter.getPullRequest(repoId, prId);

      return reply.send({ success: true, data: pr });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 创建 PR/MR
   */
  async createPullRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId } = request.params as {
        adapterId: string;
        repoId: string;
      };
      const body = request.body as {
        title: string;
        description?: string;
        sourceBranch: string;
        targetBranch: string;
        reviewers?: string[];
        labels?: string[];
      };

      if (!body.title || !body.sourceBranch || !body.targetBranch) {
        return reply.status(400).send({
          success: false,
          error: 'title, sourceBranch, and targetBranch are required',
        });
      }

      const adapter = getAdapter(adapterId);
      const pr = await adapter.createPullRequest(repoId, body);

      return reply.status(201).send({ success: true, data: pr });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 合并 PR/MR
   */
  async mergePullRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, prId } = request.params as {
        adapterId: string;
        repoId: string;
        prId: string;
      };
      const body = request.body as {
        method?: MergeStrategy;
      };

      const adapter = getAdapter(adapterId);
      const pr = await adapter.mergePullRequest(repoId, prId, body);

      return reply.send({ success: true, data: pr });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 关闭 PR/MR
   */
  async closePullRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, prId } = request.params as {
        adapterId: string;
        repoId: string;
        prId: string;
      };

      const adapter = getAdapter(adapterId);
      const pr = await adapter.closePullRequest(repoId, prId);

      return reply.send({ success: true, data: pr });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 添加 Review
   */
  async addReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, prId } = request.params as {
        adapterId: string;
        repoId: string;
        prId: string;
      };
      const body = request.body as {
        body?: string;
        event?: 'comment' | 'approve' | 'request_changes';
      };

      if (!body.body && !body.event) {
        return reply.status(400).send({
          success: false,
          error: 'body or event is required',
        });
      }

      const adapter = getAdapter(adapterId);
      const review = await adapter.addReview(repoId, prId, body);

      return reply.status(201).send({ success: true, data: review });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取 Reviews 列表
   */
  async listReviews(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { adapterId, repoId, prId } = request.params as {
        adapterId: string;
        repoId: string;
        prId: string;
      };

      const adapter = getAdapter(adapterId);
      const reviews = await adapter.listReviews(repoId, prId);

      return reply.send({
        success: true,
        data: reviews,
        count: reviews.length,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
