/**
 * Community Advanced API Routes - Phase 4
 *
 * Routes under /v1/community-advanced
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CommunityAdvancedService } from '../services/community/CommunityAdvancedService';
import { CommunityAdvancedController } from './controllers/CommunityAdvancedController';

const service = new CommunityAdvancedService();
const controller = new CommunityAdvancedController(service);

export default async function communityAdvancedRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/community-advanced/badges - 颁发徽章
  app.post('/badges', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.awardBadge(request, reply);
  });

  // GET /v1/community-advanced/badges/:userId - 查询用户徽章
  app.get('/badges/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listUserBadges(request, reply);
  });

  // GET /v1/community-advanced/badges/definitions - 获取徽章定义
  app.get('/badges/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBadgeDefinitions(request, reply);
  });

  // POST /v1/community-advanced/incentive-programs - 设置激励计划
  app.post('/incentive-programs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.setupIncentiveProgram(request, reply);
  });

  // GET /v1/community-advanced/incentive-programs - 获取激励计划列表
  app.get('/incentive-programs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getIncentivePrograms(request, reply);
  });

  // POST /v1/community-advanced/mentorship - 分配导师
  app.post('/mentorship', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.assignMentor(request, reply);
  });

  // GET /v1/community-advanced/mentorship - 获取导师配对列表
  app.get('/mentorship', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMentorshipPairs(request, reply);
  });

  // ========== Best Practice Routes ==========

  // POST /v1/community-advanced/best-practices - 提交最佳实践
  app.post('/best-practices', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.submitBestPractice(request, reply);
  });

  // GET /v1/community-advanced/best-practices - 列出最佳实践（支持搜索和分类）
  app.get('/best-practices', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listBestPractices(request, reply);
  });

  // GET /v1/community-advanced/best-practices/:id - 获取最佳实践详情
  app.get('/best-practices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBestPractice(request, reply);
  });

  // POST /v1/community-advanced/best-practices/:id/vote - 投票
  app.post('/best-practices/:id/vote', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.voteBestPractice(request, reply);
  });

  // GET /v1/community-advanced/contributors - 列出贡献者
  app.get('/contributors', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listContributors(request, reply);
  });
}
