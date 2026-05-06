/**
 * Performance API Routes
 *
 * Routes under /v1/performance
 * PostgreSQL Repository pattern: receives database pool, creates repositories and services.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PerformanceController } from './controllers/PerformanceController';

interface PerformanceRoutesOptions {
  database?: DatabasePool;
}

let controller: PerformanceController | null = null;

export default async function performanceRoutes(
  app: FastifyInstance,
  opts?: PerformanceRoutesOptions,
): Promise<void> {
  const db = opts?.database;

  if (!db) {
    app.log.warn('Performance routes: no database pool provided, using in-memory fallback');
    // Create controller with a minimal mock db for in-memory fallback
    const mockDb = {
      query: async () => ({ rows: [], rowCount: 0 }),
    };
    controller = new PerformanceController(mockDb);
  } else {
    controller = new PerformanceController(db);
  }

  // POST /v1/performance/baselines - Create baseline
  app.post('/baselines', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.createBaseline(request, reply);
  });

  // GET /v1/performance/baselines - List baselines
  app.get('/baselines', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.listBaselines(request, reply);
  });

  // GET /v1/performance/baselines/:id - Get baseline by ID
  app.get('/baselines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.getBaselineById(request, reply);
  });

  // GET /v1/performance/baselines/:id/evaluations - Get evaluation history
  app.get('/baselines/:id/evaluations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.getEvaluationHistory(request, reply);
  });

  // POST /v1/performance/evaluate - Evaluate performance
  app.post('/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.evaluatePerformance(request, reply);
  });

  // GET /v1/performance/profile/:serviceName - Profile service
  app.get('/profile/:serviceName', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.profileService(request, reply);
  });

  // GET /v1/performance/profile/:profileId/bottlenecks - Get bottlenecks
  app.get('/profile/:profileId/bottlenecks', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.getBottlenecks(request, reply);
  });

  // GET /v1/performance/profile/:serviceName/suggestions - Get suggestions
  app.get('/profile/:serviceName/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.getSuggestions(request, reply);
  });

  // POST /v1/performance/regression - Detect regression
  app.post('/regression', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.detectRegression(request, reply);
  });

  // POST /v1/performance/test-results - Record test result
  app.post('/test-results', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.recordTestResult(request, reply);
  });

  // GET /v1/performance/test-results/:service - Get test results
  app.get('/test-results/:service', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller!.getTestResults(request, reply);
  });
}
