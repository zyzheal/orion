/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/code-repo/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Code Repo API Routes
 *
 * Routes under /api/v1/code-repo
 * Wraps CodeRepoController with Fastify routes.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CodeRepoController } from './controllers/code-repo/CodeRepoController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode, handleError } from '../errors';
import { WebhookSecretRepository } from '../repositories/WebhookSecretRepository';
import { tenantContextStorage } from '../db/tenant-context-storage';

const logger = createLogger('code-repo-routes');

export default async function codeRepoRoutes(
  app: FastifyInstance,
  options?: Record<string, unknown>
): Promise<void> {
  const ctrl = new CodeRepoController();

  // Adapters
  app.get('/code-repo/adapters', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const res = await ctrl.listAdapters(req, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Repos
  app.get('/code-repo/:adapterId/repos', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId } = req.params as { adapterId: string };
      const res = await ctrl.listRepositories({ ...req, params: { adapterId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Branches CRUD
  app.get('/code-repo/:adapterId/repos/:repoId/branches', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.listBranches({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/branches', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.createBranch({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.delete('/code-repo/:adapterId/repos/:repoId/branches/:branchName', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, branchName } = req.params as { adapterId: string; repoId: string; branchName: string };
      const res = await ctrl.deleteBranch({ ...req, params: { adapterId, repoId, branchName } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PRs CRUD
  app.get('/code-repo/:adapterId/repos/:repoId/pulls', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.listPullRequests({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.createPullRequest({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/merge', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.mergePullRequest({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/close', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.closePullRequest({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Reviews
  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.addReview({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.get('/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.listReviews({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Code Ownership
  app.get('/code-repo/code-owners', { onRequest: [authenticateUser] }, async (req, reply) => {
    return reply.send({ success: true, data: { owners: [] } });
  });

  // Webhooks
  app.get('/code-repo/webhooks/logs', { onRequest: [authenticateUser] }, async (req, reply) => {
    return reply.send({ success: true, data: { logs: [] } });
  });

  // ==================== Task 5.6: Commit History ====================

  app.get('/code-repo/:adapterId/repos/:repoId/commits', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.listCommits({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.get('/code-repo/:adapterId/repos/:repoId/commits/:sha', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId, sha } = req.params as { adapterId: string; repoId: string; sha: string };
      const res = await ctrl.getCommit({ ...req, params: { adapterId, repoId, sha } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Task 5.6: File Diff ====================

  app.get('/code-repo/:adapterId/repos/:repoId/diff', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.getFileDiff({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Task 5.6: PR Comments ====================

  app.get('/code-repo/:adapterId/repos/:repoId/pulls/:prId/comments', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.listComments({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/comments', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.addComment({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.status(201).send(res);
    } catch (e) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== 4.20 Repository & PR 补充路由 ====================

  // GET /code-repo/:adapterId/repos/:repoId — 获取仓库详情
  app.get('/code-repo/:adapterId/repos/:repoId', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.getRepository({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /code-repo/:adapterId/repos/:repoId/pull-requests — 获取 PR 列表
  app.get('/code-repo/:adapterId/repos/:repoId/pull-requests', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.listPullRequests({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /code-repo/:adapterId/pull-requests/:prId — 获取 PR 详情
  app.get('/code-repo/:adapterId/pull-requests/:prId', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'read' })] }, async (req, reply) => {
    try {
      const { adapterId, prId } = req.params as { adapterId: string; prId: string };
      const repoId = (req.query as any)?.repoId as string | undefined;
      if (!repoId) {
        return reply.status(400).send({ success: false, error: 'repoId query parameter is required' });
      }
      const res = await ctrl.getPullRequest({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /code-repo/:adapterId/pull-requests/:prId — 更新 PR
  app.put('/code-repo/:adapterId/pull-requests/:prId', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, prId } = req.params as { adapterId: string; prId: string };
      const body = req.body as { title?: string; body?: string; state?: string; assignees?: string[] };
      // repoId 由客户端在 query 或 body 中提供
      const repoId = (req.query as any)?.repoId || (req.body as any)?.repoId as string | undefined;
      if (!repoId) {
        return reply.status(400).send({ success: false, error: 'repoId is required in query or request body' });
      }
      const res = await ctrl.updatePullRequest({ ...req, params: { adapterId, repoId, prId }, body }, reply);
      return reply.send(res);
    } catch (e) {
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== 4.22 Webhook 密钥管理路由 ====================

  /**
   * 辅助函数：从请求上下文中获取数据库查询接口，用于创建 WebhookSecretRepository
   */
  function getDbQuery() {
    const store = tenantContextStorage.getStore();
    if (!store?.dbClient) {
      throw new OrionError('Database client not available in request context', ErrorCode.OPERATION_FAILED);
    }
    return {
      query: (text: string, params?: unknown[]) => store.dbClient.query(text, params),
    };
  }

  /**
   * 辅助函数：对密钥进行脱敏处理
   * 长度 >= 8 时显示前 4 + **** + 后 4，否则仅显示前 2 + ****
   */
  function maskSecret(secret: string): string {
    if (!secret) return '';
    if (secret.length >= 8) {
      return secret.slice(0, 4) + '****' + secret.slice(-4);
    }
    return secret.slice(0, 2) + '****';
  }

  // POST /code-repo/webhooks/:id/secret — 设置 webhook 密钥
  app.post('/code-repo/webhooks/:id/secret', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { id: repoId } = req.params as { id: string };
      const body = req.body as { secret: string };

      if (!body?.secret || typeof body.secret !== 'string') {
        return reply.status(400).send({ success: false, error: 'secret is required in request body' });
      }

      const repo = new WebhookSecretRepository(getDbQuery());
      const result = await repo.upsertByRepoId(repoId, body.secret);

      if (!result) {
        return reply.status(500).send({ success: false, error: 'Failed to create webhook secret' });
      }

      logger.info({ repoId }, 'Webhook secret set successfully');
      return reply.status(201).send({
        success: true,
        data: {
          id: result.id,
          repoId: result.repo_id,
          secret: maskSecret(result.secret),
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        },
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to set webhook secret');
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /code-repo/webhooks/:id/secret — 获取 webhook 密钥（脱敏）
  app.get('/code-repo/webhooks/:id/secret', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'read' })] }, async (req, reply) => {
    try {
      const { id: repoId } = req.params as { id: string };

      const repo = new WebhookSecretRepository(getDbQuery());
      const result = await repo.findByRepoId(repoId);

      if (!result) {
        return reply.status(404).send({ success: false, error: 'Webhook secret not found for this repository' });
      }

      return reply.send({
        success: true,
        data: {
          id: result.id,
          repoId: result.repo_id,
          secret: maskSecret(result.secret),
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        },
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to get webhook secret');
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /code-repo/webhooks/:id/rotate-secret — 轮换密钥
  app.post('/code-repo/webhooks/:id/rotate-secret', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { id: repoId } = req.params as { id: string };
      const body = req.body as { secret?: string };

      // 如果未提供新密钥，自动生成一个强随机密钥
      const newSecret = body?.secret || `whsec_${Date.now()}_${Math.random().toString(36).substring(2, 18)}`;

      const repo = new WebhookSecretRepository(getDbQuery());
      const result = await repo.upsertByRepoId(repoId, newSecret);

      if (!result) {
        return reply.status(500).send({ success: false, error: 'Failed to rotate webhook secret' });
      }

      logger.info({ repoId }, 'Webhook secret rotated successfully');
      return reply.send({
        success: true,
        data: {
          id: result.id,
          repoId: result.repo_id,
          secret: maskSecret(result.secret),
          rotatedAt: result.updated_at,
        },
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to rotate webhook secret');
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}