import { FastifyInstance } from 'fastify';
import { getPool } from '../utils/database';
import { CommunityService } from '../services/CommunityService';
import { ContributionType, ContributionStatus, FeedbackSeverity } from '../types/community';

export default async function communityRoutes(app: FastifyInstance) {
  const pool = getPool();
  const service = new CommunityService(pool);

  // Contributions CRUD
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const contributions = await service.listContributions({ page: parseInt(query.page || '1', 10), limit: parseInt(query.limit || '20', 10), type: query.type, status: query.status });
    return reply.send({ data: contributions.data, total: contributions.total });
  });

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

  app.get('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const contribution = await service.getContribution(params.id);
    if (!contribution) return reply.status(404).send({ error: 'Not found' });
    return reply.send(contribution);
  });

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

  app.delete('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    await service.deleteContribution(params.id);
    return reply.status(204).send();
  });

  // Reviews
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

  app.get('/reviews/:targetId', async (request, reply) => {
    const params = request.params as { targetId: string };
    const reviews = await service.getReviews(params.targetId);
    return reply.send(reviews);
  });

  // Feedback
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
}
