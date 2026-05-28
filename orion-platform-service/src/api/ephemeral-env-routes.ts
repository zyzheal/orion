/**
 * Ephemeral Dev Environments API Routes
 *
 * Routes under /api/v1/ephemeral-envs
 * Wraps the existing EphemeralEnvService with HTTP endpoints.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EphemeralEnvService } from '../services/ephemeral-env-service';
import { K8sProvisionerService } from '../services/k8s-provisioner-service';
import { EventBusService } from '../services/event-bus-service';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ErrorCode } from '../../errors';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

interface EphemeralEnvRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

export default async function ephemeralEnvRoutes(
  app: FastifyInstance,
  options?: EphemeralEnvRoutesOptions
): Promise<void> {
  const k8sProvisioner = new K8sProvisionerService(options?.database || { query: async () => { throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured'); } });
  const service = new EphemeralEnvService({
    k8sProvisioner,
    eventBus: options?.eventBus,
    database: options?.database,
  });

  // ==================== Environment Lifecycle ====================

  // GET / - List ephemeral environments
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      prId?: string;
      repoId?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    };
    try {
      const envs = await service.list({
        prId: query.prId,
        repoId: query.repoId,
        statusFilter: query.status as any,
      });
      const page = parseInt(query.page || '1', 10);
      const pageSize = parseInt(query.pageSize || '20', 10);
      const start = (page - 1) * pageSize;
      const paginated = envs.slice(start, start + pageSize);
      return reply.send({
        code: 200,
        message: 'OK',
        data: paginated,
        meta: { total: envs.length, page, pageSize },
      });
    } catch (error: unknown) {
      return reply.status(500).send({ code: 500, message: errorMessage(error) });
    }
  });

  // GET /:id - Get environment details
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const env = await service.getById(params.id);
      return reply.send({ code: 200, message: 'OK', data: env });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.includes('not found')) {
        return reply.status(404).send({ code: 404, message: msg });
      }
      return reply.status(500).send({ code: 500, message: msg });
    }
  });

  // POST / - Create ephemeral environment
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      prId: string;
      repoId: string;
      branchName: string;
      templateId?: string;
      commitSha: string;
    };
    try {
      const env = await service.create(body);
      return reply.status(201).send({ code: 201, message: 'Created', data: env });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.includes('already exists')) {
        return reply.status(409).send({ code: 409, message: msg });
      }
      return reply.status(500).send({ code: 500, message: msg });
    }
  });

  // POST /:id/wake - Wake an idle environment
  app.post('/:id/wake', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const env = await service.wake(params.id);
      return reply.send({ code: 200, message: 'OK', data: env });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.includes('not found')) {
        return reply.status(404).send({ code: 404, message: msg });
      }
      return reply.status(400).send({ code: 400, message: msg });
    }
  });

  // POST /:id/teardown - Tear down an environment
  app.post('/:id/teardown', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { reason?: string } | undefined;
    try {
      const env = await service.teardown(params.id, body?.reason);
      return reply.send({ code: 200, message: 'OK', data: env });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.includes('not found')) {
        return reply.status(404).send({ code: 404, message: msg });
      }
      return reply.status(500).send({ code: 500, message: msg });
    }
  });

  // GET /:id/cost - Get environment cost breakdown
  app.get('/:id/cost', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const cost = await service.getCost(params.id);
      return reply.send({ code: 200, message: 'OK', data: cost });
    } catch (error: unknown) {
      const msg = errorMessage(error);
      if (msg.includes('not found')) {
        return reply.status(404).send({ code: 404, message: msg });
      }
      return reply.status(500).send({ code: 500, message: msg });
    }
  });

  // ==================== Templates ====================

  // GET /templates - List environment templates
  app.get('/templates', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ephemeral-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const templates = [
      {
        id: 'tpl-web-frontend',
        name: 'Web Frontend',
        description: 'Standard web frontend with Nginx',
        services: [
          { name: 'web', image: 'nginx:latest', replicas: 1, resources: { cpu: '0.25', memory: '256Mi' } },
        ],
        resourceLimits: { cpuLimit: '1', memoryLimit: '1Gi', storageLimit: '5Gi' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tpl-node-backend',
        name: 'Node.js Backend',
        description: 'Node.js backend with PostgreSQL sidecar',
        services: [
          { name: 'api', image: 'node:18-alpine', replicas: 1, resources: { cpu: '0.5', memory: '512Mi' } },
        ],
        resourceLimits: { cpuLimit: '2', memoryLimit: '2Gi', storageLimit: '10Gi' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    return reply.send({ code: 200, message: 'OK', data: templates });
  });
}
