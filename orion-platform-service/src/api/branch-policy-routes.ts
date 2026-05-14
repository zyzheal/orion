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
    console.warn('[BranchPolicyRoutes] No database pool provided, routes will use in-memory mode');
  }

  // ==================== Branch Policy CRUD ====================

  // POST /api/v1/code-repo/branch-policies - 创建分支保护策略
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /api/v1/code-repo/branch-policies/:id - 获取分支策略详情
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // GET /api/v1/code-repo/branch-policies/repo/:repoId - 获取仓库的所有分支策略
  app.get('/repo/:repoId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listByRepo(request, reply);
  });

  // GET /api/v1/code-repo/branch-policies - 获取所有分支策略
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listAll(request, reply);
  });

  // PUT /api/v1/code-repo/branch-policies/:id - 更新分支策略
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /api/v1/code-repo/branch-policies/:id - 删除分支策略
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Branch Policy Operations ====================

  // GET /api/v1/code-repo/branch-policies/match - 匹配分支策略
  app.get('/match', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.matchPolicy(request, reply);
  });

  // POST /api/v1/code-repo/branch-policies/check-merge - 检查 PR 合并可行性
  app.post('/check-merge', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkMerge(request, reply);
  });

  // POST /api/v1/code-repo/branch-policies/defaults/:repoId - 创建默认分支保护策略
  app.post('/defaults/:repoId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createDefaults(request, reply);
  });
}
