import { FastifyInstance } from 'fastify';
import { getPool } from '../utils/database';
import { CommunityService } from '../services/CommunityService';
import { CommunityAdvancedService } from '../services/CommunityAdvancedService';
import { ContributionType, ContributionStatus, FeedbackSeverity } from '../types/community';

/**
 * Community Service Routes
 * Combines community and community-advanced endpoints under /api/v1/community
 */
export default async function communityRoutes(app: FastifyInstance) {
  const pool = getPool();
  const service = new CommunityService(pool);
  const advancedService = new CommunityAdvancedService(pool);

  // ==================== Base Endpoints ====================

  // Health check
  app.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: '@orion/community-svc',
    });
  });

  // ==================== Contributions Endpoints ====================

  // List contributions
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const contributions = await service.listContributions({
      page: parseInt(query.page || '1', 10),
      limit: parseInt(query.limit || '20', 10),
      type: query.type,
      status: query.status,
    });
    return reply.send({ data: contributions.data, total: contributions.total });
  });

  // Create contribution
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const contribution = await service.createContribution({
      authorId: body.authorId as string,
      authorName: body.authorName as string,
      type: body.type as ContributionType,
      title: body.title as string,
      description: body.description as string | undefined,
      repositoryUrl: body.repositoryUrl as string | undefined,
      documentationUrl: body.documentationUrl as string | undefined,
      version: body.version as string | undefined,
      tags: body.tags as string[] | undefined,
    });
    return reply.status(201).send(contribution);
  });

  // Get contribution by ID
  app.get('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const contribution = await service.getContribution(params.id);
    if (!contribution) return reply.status(404).send({ error: 'Contribution not found' });
    return reply.send(contribution);
  });

  // Update contribution
  app.put('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const updated = await service.updateContribution(params.id, {
      title: body.title as string | undefined,
      description: body.description as string | undefined,
      repositoryUrl: body.repositoryUrl as string | undefined,
      documentationUrl: body.documentationUrl as string | undefined,
      version: body.version as string | undefined,
      tags: body.tags as string[] | undefined,
      status: body.status as ContributionStatus | undefined,
    });
    return reply.send(updated);
  });

  // Delete contribution
  app.delete('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    await service.deleteContribution(params.id);
    return reply.status(204).send();
  });

  // ==================== Reviews Endpoints ====================

  // Create review
  app.post('/reviews', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const review = await service.createReview({
      targetId: body.targetId as string,
      targetType: body.targetType as string,
      reviewerId: body.reviewerId as string,
      reviewerName: body.reviewerName as string,
      rating: parseInt(body.rating as string, 10),
      title: body.title as string | undefined,
      content: body.content as string | undefined,
    });
    return reply.status(201).send(review);
  });

  // Get reviews by target
  app.get('/reviews/:targetId', async (request, reply) => {
    const params = request.params as { targetId: string };
    const reviews = await service.getReviews(params.targetId);
    return reply.send(reviews);
  });

  // ==================== Feedback Endpoints ====================

  // Create feedback
  app.post('/feedback', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const feedback = await service.createFeedback({
      targetId: body.targetId as string,
      targetType: body.targetType as string,
      userId: body.userId as string,
      userName: body.userName as string,
      type: body.type as string | undefined,
      content: body.content as string,
      severity: (body.severity as FeedbackSeverity) || 'info',
    });
    return reply.status(201).send(feedback);
  });

  // ==================== Badges Endpoints ====================

  // List badges
  app.get('/badges', async (_request, reply) => {
    const badges = await advancedService.listBadges({ page: 1, limit: 100 });
    return reply.send({ data: badges });
  });

  // Award badge
  app.post('/badges/award', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const badge = await advancedService.awardBadge(body.userId, body.badgeId);
    return reply.status(201).send(badge);
  });

  // ==================== Incentives Endpoints ====================

  // Get user incentives
  app.get('/incentives', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const userId = query.userId || '';
    const incentives = await advancedService.getUserIncentives(userId);
    return reply.send({ data: incentives });
  });

  // ==================== Mentors Endpoints ====================

  // Get all mentors
  app.get('/mentors', async (_request, reply) => {
    const mentors = await advancedService.getAllMentors();
    return reply.send({ data: mentors });
  });

  // ==================== Best Practices Endpoints ====================

  // Get all best practices
  app.get('/best-practices', async (_request, reply) => {
    const practices = await advancedService.getAllBestPractices();
    return reply.send({ data: practices });
  });

  // Create best practice
  app.post('/best-practices', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const practice = await advancedService.createBestPractice({
      title: body.title as string,
      description: body.description as string,
      category: body.category as string,
      content: (body.content as Record<string, unknown>) || {},
      authorId: body.authorId as string,
      authorName: body.authorName as string,
      tags: body.tags as string[] | undefined,
    });
    return reply.status(201).send(practice);
  });
}