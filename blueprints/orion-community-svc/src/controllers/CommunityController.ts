import { FastifyReply, FastifyRequest } from 'fastify';
import CommunityService from '../services/CommunityService';
import type {
  ContributionType,
  ContributionStatus,
  FeedbackSeverity,
  FeedbackStatus,
} from '../types/community';

/**
 * CommunityController - HTTP 请求处理层
 * 将 Fastify 请求委托给 CommunityService
 */
export class CommunityController {
  private service: CommunityService;

  constructor(service: CommunityService) {
    this.service = service;
  }

  // ==================== Contributions CRUD ====================

  async createContribution(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.createContribution({
      authorId: body.authorId as string,
      authorName: body.authorName as string,
      type: body.type as ContributionType,
      title: body.title as string,
      description: body.description as string | undefined,
      repositoryUrl: body.repositoryUrl as string | undefined,
      documentationUrl: body.documentationUrl as string | undefined,
      version: body.version as string | undefined,
      tags: (body.tags as string[]) || [],
    });
    reply.code(201).send(result);
  }

  async getContribution(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getContribution(id);
    if (!result) { reply.code(404).send({ error: 'Contribution not found', id }); return; }
    reply.send(result);
  }

  async listContributions(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listContributions({
      page,
      limit,
      type: query.type,
      status: query.status,
      authorId: query.authorId,
    });
    reply.send(result);
  }

  async updateContribution(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.updateContribution(id, {
      title: body.title as string | undefined,
      description: body.description as string | undefined,
      repositoryUrl: body.repositoryUrl as string | undefined,
      documentationUrl: body.documentationUrl as string | undefined,
      version: body.version as string | undefined,
      tags: body.tags as string[] | undefined,
      status: body.status as ContributionStatus | undefined,
    });
    if (!result) { reply.code(404).send({ error: 'Contribution not found', id }); return; }
    reply.send(result);
  }

  async deleteContribution(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const deleted = await this.service.deleteContribution(id);
    if (!deleted) { reply.code(404).send({ error: 'Contribution not found', id }); return; }
    reply.code(204).send();
  }

  // ==================== Plugins ====================

  async submitPlugin(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.submitPlugin({
      name: body.name as string,
      description: body.description as string | undefined,
      authorId: body.authorId as string,
      authorName: body.authorName as string,
      version: body.version as string | undefined,
      manifest: (body.manifest as Record<string, unknown>) || {},
      downloadUrl: body.downloadUrl as string | undefined,
      checksumSha256: body.checksumSha256 as string | undefined,
      category: body.category as string | undefined,
      tags: (body.tags as string[]) || [],
    });
    reply.code(201).send(result);
  }

  async getPlugin(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getPlugin(id);
    if (!result) { reply.code(404).send({ error: 'Plugin not found', id }); return; }
    reply.send(result);
  }

  async listPlugins(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listPlugins({
      page,
      limit,
      status: query.status,
      category: query.category,
    });
    reply.send(result);
  }

  async updatePluginStatus(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, string>;
    const result = await this.service.updatePluginStatus(id, body.status || 'approved');
    if (!result) { reply.code(404).send({ error: 'Plugin not found', id }); return; }
    reply.send(result);
  }

  // ==================== Reviews ====================

  async createReview(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const rating = parseInt(body.rating as string, 10);
    if (rating < 1 || rating > 5) { reply.code(400).send({ error: 'Rating must be between 1 and 5' }); return; }
    const result = await this.service.createReview({
      targetId: body.targetId as string,
      targetType: body.targetType as string,
      reviewerId: body.reviewerId as string,
      reviewerName: body.reviewerName as string,
      rating,
      title: body.title as string | undefined,
      content: body.content as string | undefined,
    });
    reply.code(201).send(result);
  }

  async getReview(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getReview(id);
    if (!result) { reply.code(404).send({ error: 'Review not found', id }); return; }
    reply.send(result);
  }

  async listReviews(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listReviews({
      page,
      limit,
      targetId: query.targetId,
      targetType: query.targetType,
      reviewerId: query.reviewerId,
    });
    reply.send(result);
  }

  async deleteReview(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const deleted = await this.service.deleteReview(id);
    if (!deleted) { reply.code(404).send({ error: 'Review not found', id }); return; }
    reply.code(204).send();
  }

  // ==================== Feedback ====================

  async createFeedback(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = _request.body as Record<string, unknown>;
    const result = await this.service.createFeedback({
      targetId: body.targetId as string,
      targetType: body.targetType as string,
      userId: body.userId as string,
      userName: body.userName as string,
      type: body.type as string | undefined,
      content: body.content as string,
      severity: (body.severity as FeedbackSeverity) || 'info',
    });
    reply.code(201).send(result);
  }

  async getFeedback(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const result = await this.service.getFeedback(id);
    if (!result) { reply.code(404).send({ error: 'Feedback not found', id }); return; }
    reply.send(result);
  }

  async listFeedback(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = _request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const result = await this.service.listFeedback({
      page,
      limit,
      targetId: query.targetId,
      status: query.status,
      severity: query.severity,
    });
    reply.send(result);
  }

  async updateFeedbackStatus(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = _request.params as { id: string };
    const body = _request.body as Record<string, string>;
    const result = await this.service.updateFeedbackStatus(id, body.status as FeedbackStatus, body.resolution);
    if (!result) { reply.code(404).send({ error: 'Feedback not found', id }); return; }
    reply.send(result);
  }
}

export default CommunityController;
