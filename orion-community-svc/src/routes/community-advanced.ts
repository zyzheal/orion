import { FastifyInstance } from 'fastify';
import { getPool } from '../utils/database';
import { CommunityAdvancedService } from '../services/CommunityAdvancedService';

export default async function communityAdvancedRoutes(app: FastifyInstance) {
  const pool = getPool();
  const service = new CommunityAdvancedService(pool);

  // Badges
  app.get('/badges', async (_request, reply) => {
    const badges = await service.listBadges({ page: 1, limit: 100 });
    return reply.send({ data: badges });
  });

  app.post('/badges/award', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const badge = await service.awardBadge(body.userId, body.badgeId);
    return reply.status(201).send(badge);
  });

  // Incentives
  app.get('/incentives', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const userId = query.userId || '';
    const incentives = await service.getUserIncentives(userId);
    return reply.send({ data: incentives });
  });

  // Mentors
  app.get('/mentors', async (_request, reply) => {
    const mentors = await service.getAllMentors();
    return reply.send({ data: mentors });
  });

  // Best Practices
  app.get('/best-practices', async (_request, reply) => {
    const practices = await service.getAllBestPractices();
    return reply.send({ data: practices });
  });

  app.post('/best-practices', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const practice = await service.createBestPractice({
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
