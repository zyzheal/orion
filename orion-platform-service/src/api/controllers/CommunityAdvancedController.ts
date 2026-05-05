/**
 * CommunityAdvancedController - Phase 4
 *
 * 社区生态进阶功能 API：徽章、激励计划、导师配对、最佳实践
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { CommunityAdvancedService } from '../../services/community/CommunityAdvancedService';
import { CommunityService, BestPracticeInput, BestPracticeFilters } from '../../services/community/CommunityService';

export class CommunityAdvancedController extends BaseController {
  private service: CommunityAdvancedService;
  private communityService: CommunityService;

  constructor(service: CommunityAdvancedService) {
    super();
    this.service = service;
    this.communityService = new CommunityService();
  }

  /**
   * POST /v1/community-advanced/badges - 颁发徽章
   */
  async awardBadge(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ userId: string; badgeType: string }>(request);
      return this.service.awardBadge(tenantId, body.userId, body.badgeType);
    });
  }

  /**
   * GET /v1/community-advanced/badges/:userId - 查询用户徽章
   */
  async listUserBadges(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ userId: string }>(request);
      return this.service.getUserBadges(params.userId);
    });
  }

  /**
   * GET /v1/community-advanced/badges/definitions - 获取徽章定义
   */
  async getBadgeDefinitions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      return this.service.getBadgeDefinitions();
    });
  }

  /**
   * POST /v1/community-advanced/incentive-programs - 设置激励计划
   */
  async setupIncentiveProgram(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<Record<string, unknown>>(request);
      return this.service.setupIncentiveProgram(tenantId, body);
    });
  }

  /**
   * GET /v1/community-advanced/incentive-programs - 获取激励计划列表
   */
  async getIncentivePrograms(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.getIncentivePrograms(tenantId);
    });
  }

  /**
   * POST /v1/community-advanced/mentorship - 分配导师
   */
  async assignMentor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ mentorId: string; menteeId: string; goals?: string[] }>(request);
      return this.service.assignMentor(tenantId, body.mentorId, body.menteeId, body.goals);
    });
  }

  /**
   * GET /v1/community-advanced/mentorship - 获取导师配对列表
   */
  async getMentorshipPairs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.getMentorshipPairs(tenantId);
    });
  }

  // ========== Best Practice Methods ==========

  /**
   * POST /v1/community-advanced/best-practices - 提交最佳实践
   */
  async submitBestPractice(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = this.getBody<BestPracticeInput>(request);
      return this.communityService.createBestPractice(body);
    }, (practice) => this.sendCreated(reply, practice));
  }

  /**
   * GET /v1/community-advanced/best-practices - 列出最佳实践（支持搜索和分类）
   */
  async listBestPractices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as Record<string, string | undefined>;
      const filters: BestPracticeFilters = {};
      if (query.category) filters.category = query.category;
      if (query.status) filters.status = query.status;
      if (query.authorId) filters.authorId = query.authorId;
      if (query.tags) filters.tags = query.tags.split(',');
      if (query.search) filters.search = query.search;
      return this.communityService.listBestPractices(filters);
    }, (practices) => this.sendSuccess(reply, practices));
  }

  /**
   * GET /v1/community-advanced/best-practices/:id - 获取最佳实践详情
   */
  async getBestPractice(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = this.getParams<{ id: string }>(request);
      const practice = await this.communityService.getBestPractice(params.id);
      if (!practice) throw new Error(`Best practice '${params.id}' not found`);
      return practice;
    }, (practice) => this.sendSuccess(reply, practice));
  }

  /**
   * POST /v1/community-advanced/best-practices/:id/vote - 投票
   */
  async voteBestPractice(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = this.getParams<{ id: string }>(request);
      const body = this.getBody<{ direction?: 'up' | 'down' }>(request);
      const practice = await this.communityService.voteBestPractice(params.id, body.direction || 'up');
      if (!practice) throw new Error(`Best practice '${params.id}' not found`);
      return practice;
    }, (practice) => this.sendSuccess(reply, practice));
  }

  // ========== Contributor Methods ==========

  /**
   * GET /v1/community-advanced/contributors - 列出贡献者（按声望排序）
   */
  async listContributors(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : undefined;
      return this.communityService.listContributors(limit);
    }, (contributors) => this.sendSuccess(reply, contributors));
  }
}
