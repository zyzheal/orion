/**
 * Code Repository API 路由注册
 *
 * 提供代码仓库管理、分支保护、代码所有权、Webhook 处理等 API 端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CodeRepoController, registerGitLabInstance } from './controllers/code-repo/CodeRepoController';
import { BranchPolicyController } from './controllers/code-repo/BranchPolicyController';
import { CodeOwnershipController } from './controllers/code-repo/CodeOwnershipController';
import { WebhookController } from './controllers/code-repo/WebhookController';

export default async function codeRepoRoutes(app: FastifyInstance): Promise<void> {
  // 初始化控制器
  const codeRepoController = new CodeRepoController();
  const branchPolicyController = new BranchPolicyController();
  const codeOwnershipController = new CodeOwnershipController();
  const webhookController = new WebhookController();

  // ==================== 代码仓库管理 ====================

  // 获取已注册的适配器列表
  app.get('/adapters', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.listAdapters(request, reply);
  });

  // GET /:adapterId/repositories - 仓库列表
  app.get('/:adapterId/repositories', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.listRepositories(request, reply);
  });

  // GET /:adapterId/repository - 仓库详情
  app.get('/:adapterId/repository', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.getRepository(request, reply);
  });

  // ---- 分支管理 ----

  // GET /:adapterId/:repoId/branches - 分支列表
  app.get('/:adapterId/:repoId/branches', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.listBranches(request, reply);
  });

  // GET /:adapterId/:repoId/branches/:branchName - 分支详情
  app.get('/:adapterId/:repoId/branches/:branchName', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.getBranch(request, reply);
  });

  // POST /:adapterId/:repoId/branches - 创建分支
  app.post('/:adapterId/:repoId/branches', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.createBranch(request, reply);
  });

  // DELETE /:adapterId/:repoId/branches/:branchName - 删除分支
  app.delete('/:adapterId/:repoId/branches/:branchName', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.deleteBranch(request, reply);
  });

  // ---- Pull Request / MR 管理 ----

  // GET /:adapterId/:repoId/pull-requests - PR/MR 列表
  app.get('/:adapterId/:repoId/pull-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.listPullRequests(request, reply);
  });

  // GET /:adapterId/:repoId/pull-requests/:prId - PR/MR 详情
  app.get('/:adapterId/:repoId/pull-requests/:prId', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.getPullRequest(request, reply);
  });

  // POST /:adapterId/:repoId/pull-requests - 创建 PR/MR
  app.post('/:adapterId/:repoId/pull-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.createPullRequest(request, reply);
  });

  // POST /:adapterId/:repoId/pull-requests/:prId/merge - 合并 PR/MR
  app.post('/:adapterId/:repoId/pull-requests/:prId/merge', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.mergePullRequest(request, reply);
  });

  // POST /:adapterId/:repoId/pull-requests/:prId/close - 关闭 PR/MR
  app.post('/:adapterId/:repoId/pull-requests/:prId/close', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.closePullRequest(request, reply);
  });

  // ---- Review 管理 ----

  // GET /:adapterId/:repoId/pull-requests/:prId/reviews - Reviews 列表
  app.get('/:adapterId/:repoId/pull-requests/:prId/reviews', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.listReviews(request, reply);
  });

  // POST /:adapterId/:repoId/pull-requests/:prId/reviews - 添加 Review
  app.post('/:adapterId/:repoId/pull-requests/:prId/reviews', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeRepoController.addReview(request, reply);
  });

  // ==================== 分支保护策略 ====================

  // POST /branch-policies - 创建分支保护策略
  app.post('/branch-policies', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.create(request, reply);
  });

  // GET /branch-policies/:id - 策略详情
  app.get('/branch-policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.getById(request, reply);
  });

  // GET /branch-policies/repo/:repoId - 仓库的所有策略
  app.get('/branch-policies/repo/:repoId', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.listByRepo(request, reply);
  });

  // PUT /branch-policies/:id - 更新策略
  app.put('/branch-policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.update(request, reply);
  });

  // DELETE /branch-policies/:id - 删除策略
  app.delete('/branch-policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.delete(request, reply);
  });

  // GET /branch-policies/match - 匹配分支策略
  app.get('/branch-policies/match', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.matchPolicy(request, reply);
  });

  // POST /branch-policies/check-merge - 检查合并可行性
  app.post('/branch-policies/check-merge', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.checkMerge(request, reply);
  });

  // POST /branch-policies/defaults/:repoId - 创建默认策略
  app.post('/branch-policies/defaults/:repoId', async (request: FastifyRequest, reply: FastifyReply) => {
    return branchPolicyController.createDefaults(request, reply);
  });

  // ==================== 代码所有权 ====================

  // POST /code-owners - 注册 CODEOWNERS 文件
  app.post('/code-owners', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeOwnershipController.register(request, reply);
  });

  // GET /code-owners/:repoId - 获取 CODEOWNERS 文件
  app.get('/code-owners/:repoId', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeOwnershipController.get(request, reply);
  });

  // DELETE /code-owners/:repoId - 删除 CODEOWNERS 文件
  app.delete('/code-owners/:repoId', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeOwnershipController.remove(request, reply);
  });

  // POST /code-owners/validate - 验证 CODEOWNERS 格式
  app.post('/code-owners/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeOwnershipController.validate(request, reply);
  });

  // POST /code-owners/recommend - 获取审批人推荐
  app.post('/code-owners/recommend', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeOwnershipController.recommend(request, reply);
  });

  // POST /code-owners/approvers - 获取 PR 所需审批人
  app.post('/code-owners/approvers', async (request: FastifyRequest, reply: FastifyReply) => {
    return codeOwnershipController.getApprovers(request, reply);
  });

  // ==================== Webhook 处理 ====================

  // POST /webhooks/gitlab - GitLab Webhook
  app.post('/webhooks/gitlab', async (request: FastifyRequest, reply: FastifyReply) => {
    return webhookController.handleGitLab(request, reply);
  });

  // POST /webhooks/gerrit - Gerrit Webhook
  app.post('/webhooks/gerrit', async (request: FastifyRequest, reply: FastifyReply) => {
    return webhookController.handleGerrit(request, reply);
  });

  // POST /webhooks/github - GitHub Webhook
  app.post('/webhooks/github', async (request: FastifyRequest, reply: FastifyReply) => {
    return webhookController.handleGitHub(request, reply);
  });

  // GET /webhooks/logs - 事件日志
  app.get('/webhooks/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return webhookController.getEventLog(request, reply);
  });

  // POST /webhooks/secret - 注册 Webhook 密钥
  app.post('/webhooks/secret', async (request: FastifyRequest, reply: FastifyReply) => {
    return webhookController.registerSecret(request, reply);
  });
}
