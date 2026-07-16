/**
 * Developer Efficiency Enhanced API Routes
 *
 * Routes under /v1/efficiency
 *
 * Note: This provides additional efficiency endpoints beyond the existing efficiency-routes.ts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function efficiencyEnhancedRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/efficiency/metrics - Get efficiency metrics
  app.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      metrics: {
        deploymentFrequency: '5.2/day',
        leadTime: '2.3 hours',
        mttr: '15 minutes',
        changeFailureRate: '3.2%',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // GET /v1/efficiency/trends - Get efficiency trends
  app.get('/trends', async (request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      trends: [
        { date: '2026-05-01', deploymentFrequency: 4.8, leadTime: 2.5 },
        { date: '2026-05-02', deploymentFrequency: 5.1, leadTime: 2.4 },
        { date: '2026-05-03', deploymentFrequency: 5.5, leadTime: 2.1 },
        { date: '2026-05-04', deploymentFrequency: 5.3, leadTime: 2.2 },
        { date: '2026-05-05', deploymentFrequency: 5.2, leadTime: 2.3 },
      ],
    });
  });

  // GET /v1/efficiency/team-performance - Get team performance
  app.get('/team-performance', async (request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      teams: [
        { team: 'platform', score: 92, velocity: 'high' },
        { team: 'frontend', score: 88, velocity: 'high' },
        { team: 'backend', score: 85, velocity: 'medium' },
      ],
    });
  });
}
