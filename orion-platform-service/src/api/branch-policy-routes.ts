/**
 * Branch Policy API Routes
 *
 * Routes under /api/v1/code-repo/branch-policies
 * PostgreSQL Repository-backed branch protection strategy management.
 *
 * Features:
 * - Branch policy CRUD
 * - Branch pattern matching
 * - PR mergeability checks
 * - Default policy generation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { BranchPolicyController } from './controllers/code-repo/BranchPolicyController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'branch-policy-routes' });

interface BranchPolicyRoutesOptions {
  database?: DatabasePool;
}

export default async function branchPolicyRoutes(
  app: FastifyInstance,
  options: BranchPolicyRoutesOptions
): Promise<void> {
  // Initialize Controller with database pool
  const controller = new BranchPolicyController(options.database || null);

  if (!options.database) {
    logger.warn('[BranchPolicyRoutes] No database pool provided, routes will use in-memory mode');
  }

  // ==================== Branch Policy CRUD ====================

  // POST /api/v1/code-repo/branch-policies - 创建分支保护策略
  app.post('/', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /api/v1/code-repo/branch-policies/:id - 获取分支策略详情
  app.get('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // GET /api/v1/code-repo/branch-policies/repo/:repoId - 获取仓库的所有分支策略
  app.get('/repo/:repoId', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listByRepo(request, reply);
  });

  // GET /api/v1/code-repo/branch-policies - 获取所有分支策略
  app.get('/', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listAll(request, reply);
  });

  // PUT /api/v1/code-repo/branch-policies/:id - 更新分支策略
  app.put('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /api/v1/code-repo/branch-policies/:id - 删除分支策略
  app.delete('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Branch Policy Operations ====================

  // GET /api/v1/code-repo/branch-policies/match - 匹配分支策略
  app.get('/match', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.matchPolicy(request, reply);
  });

  // POST /api/v1/code-repo/branch-policies/check-merge - 检查 PR 合并可行性
  app.post('/check-merge', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkMerge(request, reply);
  });

  // POST /api/v1/code-repo/branch-policies/defaults/:repoId - 创建默认分支保护策略
  app.post('/defaults/:repoId', { onRequest: [authenticateUser, requirePermission({ resource: 'branch_policy', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createDefaults(request, reply);
  });
}
