import { FastifyReply, FastifyRequest } from 'fastify';
import CommunityAdvancedService, { BadgeLevel, IncentiveType, RewardType } from '../services/CommunityAdvancedService';

/**
 * CommunityAdvancedController - 高级社区功能 HTTP 请求处理层
 */
export class CommunityAdvancedController {
  private service: CommunityAdvancedService;

  constructor(service: CommunityAdvancedService) {
    this.service = service;
  }

  // ==================== Badges ====================

  async createBadge(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.createBadge({
      name: body.name as string,
      description: body.description as string | undefined,
      iconUrl: body.iconUrl as string | undefined,
      category: body.category as string | undefined,
      criteria: body.criteria as Record<string, unknown> | undefined,
      level: (body.level as BadgeLevel) || BadgeLevel.BRONZE,
    });
    reply.code(201).send(result);
  }

  async getBadge(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getBadge(id);
    if (!result) { reply.code(404).send({ error: 'Badge not found', id }); return; }
    reply.send(result);
  }

  async listBadges(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listBadges({
      page,
      limit,
      category: query.category,
      level: query.level,
    });
    reply.send(result);
  }

  async awardBadge(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.awardBadge(
      body.userId as string,
      body.badgeId as string,
      body.awardedBy as string | undefined,
      body.metadata as Record<string, unknown> | undefined,
    );
    if (!result) { reply.code(409).send({ error: 'User already has this badge' }); return; }
    reply.code(201).send(result);
  }

  async getUserBadges(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { userId } = _request.params as { userId: string };
    const result = await this.service.getUserBadges(userId);
    reply.send(result);
  }

  async toggleBadgeActive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, boolean>;
    const result = await this.service.toggleBadgeActive(id, body.isActive ?? true);
    if (!result) { reply.code(404).send({ error: 'Badge not found', id }); return; }
    reply.send(result);
  }

  // ==================== Incentives ====================

  async createIncentive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.createIncentive({
      name: body.name as string,
      description: body.description as string | undefined,
      type: body.type as IncentiveType,
      rewardType: body.rewardType as RewardType,
      rewardValue: body.rewardValue ? parseFloat(body.rewardValue as string) : undefined,
      eligibilityCriteria: body.eligibilityCriteria as Record<string, unknown> | undefined,
      budgetTotal: body.budgetTotal ? parseFloat(body.budgetTotal as string) : undefined,
      startDate: body.startDate as string | undefined,
      endDate: body.endDate as string | undefined,
    });
    reply.code(201).send(result);
  }

  async getIncentive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getIncentive(id);
    if (!result) { reply.code(404).send({ error: 'Incentive not found', id }); return; }
    reply.send(result);
  }

  async listIncentives(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listIncentives({
      page,
      limit,
      type: query.type,
      status: query.status,
    });
    reply.send(result);
  }

  async awardIncentive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    try {
      const result = await this.service.awardIncentive({
        incentiveId: body.incentiveId as string,
        userId: body.userId as string,
        userName: body.userName as string,
        rewardValue: body.rewardValue ? parseFloat(body.rewardValue as string) : undefined,
        reason: body.reason as string | undefined,
      });
      reply.code(201).send(result);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found') || message.includes('not active')) {
        reply.code(400).send({ error: message });
      } else if (message.includes('budget')) {
        reply.code(409).send({ error: message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async listIncentiveAwards(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listIncentiveAwards({
      page,
      limit,
      incentiveId: query.incentiveId,
      userId: query.userId,
      status: query.status,
    });
    reply.send(result);
  }

  async updateIncentiveStatus(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, string>;
    const result = await this.service.updateIncentiveStatus(id, body.status);
    if (!result) { reply.code(404).send({ error: 'Incentive not found', id }); return; }
    reply.send(result);
  }

  async fulfillIncentiveAward(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.fulfillIncentiveAward(id);
    if (!result) { reply.code(404).send({ error: 'Incentive award not found', id }); return; }
    reply.send(result);
  }

  // ==================== Mentors ====================

  async registerMentor(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.registerMentor({
      userId: body.userId as string,
      userName: body.userName as string,
      bio: body.bio as string | undefined,
      expertise: body.expertise as string[] | undefined,
      availability: body.availability as string | undefined,
    });
    reply.code(201).send(result);
  }

  async getMentor(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { userId } = _request.params as { userId: string };
    const result = await this.service.getMentor(userId);
    if (!result) { reply.code(404).send({ error: 'Mentor not found', userId }); return; }
    reply.send(result);
  }

  async listMentors(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listMentors({
      page,
      limit,
      expertise: query.expertise,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
    });
    reply.send(result);
  }

  async updateMentorActive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { userId } = _request.params as { userId: string };
    const body = _request.body as Record<string, boolean>;
    const result = await this.service.updateMentorActive(userId, body.isActive ?? true);
    if (!result) { reply.code(404).send({ error: 'Mentor not found', userId }); return; }
    reply.send(result);
  }

  async rateMentor(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { userId } = _request.params as { userId: string };
    const body = _request.body as Record<string, number>;
    const rating = body.rating;
    if (!rating || rating < 1 || rating > 5) { reply.code(400).send({ error: 'Rating must be between 1 and 5' }); return; }
    await this.service.updateMentorRating(userId, rating);
    await this.service.incrementMenteeCount(userId);
    reply.send({ success: true, message: 'Mentor rated successfully' });
  }

  // ==================== Best Practices ====================

  async createBestPractice(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.createBestPractice({
      title: body.title as string,
      description: body.description as string,
      category: body.category as string,
      content: (body.content as Record<string, unknown>) || {},
      authorId: body.authorId as string,
      authorName: body.authorName as string,
      tags: body.tags as string[] | undefined,
    });
    reply.code(201).send(result);
  }

  async getBestPractice(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getBestPractice(id);
    if (!result) { reply.code(404).send({ error: 'Best practice not found', id }); return; }
    reply.send(result);
  }

  async listBestPractices(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listBestPractices({
      page,
      limit,
      category: query.category,
      status: query.status,
      verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
    });
    reply.send(result);
  }

  async verifyBestPractice(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, string>;
    const verifiedBy = body.verifiedBy || 'system';
    const result = await this.service.verifyBestPractice(id, verifiedBy);
    if (!result) { reply.code(404).send({ error: 'Best practice not found', id }); return; }
    reply.send(result);
  }

  async upvoteBestPractice(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.upvoteBestPractice(id);
    if (!result) { reply.code(404).send({ error: 'Best practice not found', id }); return; }
    reply.send(result);
  }

  async updateBestPracticeStatus(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, string>;
    const result = await this.service.updateBestPracticeStatus(id, body.status);
    if (!result) { reply.code(404).send({ error: 'Best practice not found', id }); return; }
    reply.send(result);
  }
}

export default CommunityAdvancedController;
