/**
 * Circuit Breaker API Routes
 *
 * F003: CRUD and management endpoints for circuit breakers.
 *
 * Prefix: /v1/circuit-breakers
 *
 * Endpoints:
 * - GET    /v1/circuit-breakers              - List all circuit breakers
 * - GET    /v1/circuit-breakers/summary      - Get summary counts
 * - GET    /v1/circuit-breakers/:targetKey   - Get circuit breaker detail
 * - POST   /v1/circuit-breakers              - Register a new circuit breaker
 * - PUT    /v1/circuit-breakers/:targetKey/config - Update configuration
 * - POST   /v1/circuit-breakers/:targetKey/reset  - Reset to CLOSED
 * - POST   /v1/circuit-breakers/:targetKey/trip   - Manually trip to OPEN
 * - GET    /v1/circuit-breakers/:targetKey/events - Get event history
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CircuitBreakerService } from '../services/circuit-breaker/circuit-breaker-service';
import type { CircuitBreakerConfig } from '../utils/rate-limit-circuit-breaker';
import { ValidationError, NotFoundError, ServiceUnavailableError, handleError } from '../errors';

interface CircuitBreakerRoutesOptions {
  circuitBreakerService?: CircuitBreakerService;
}

export default async function circuitBreakerRoutes(
  app: FastifyInstance,
  options: CircuitBreakerRoutesOptions,
): Promise<void> {
  const circuitBreakerService = options.circuitBreakerService;

  // List all circuit breakers
  app.get(
    '/',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const all = await circuitBreakerService.listAll();
      return reply.send({ success: true, data: all, total: all.length });
    },
  );

  // Get summary counts
  app.get(
    '/summary',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const summary = await circuitBreakerService.getSummary();
      return reply.send({ success: true, data: summary });
    },
  );

  // Get circuit breaker detail by target key
  app.get(
    '/:targetKey',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const { targetKey } = request.params as { targetKey: string };
      const state = await circuitBreakerService.getState(targetKey);
      if (!state) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      // Get recent events
      const events = await circuitBreakerService.getEvents(targetKey, 20);

      return reply.send({
        success: true,
        data: {
          targetKey,
          state: state.state,
          config: state.config,
          stats: state.stats,
          recentEvents: events,
        },
      });
    },
  );

  // Register a new circuit breaker
  app.post(
    '/',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const body = request.body as any;
      if (!body.targetKey) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      const config: CircuitBreakerConfig = {
        failureThreshold: body.failureThreshold ?? 5,
        recoveryTimeoutMs: body.recoveryTimeoutMs ?? 60000,
        successThreshold: body.successThreshold ?? 1,
      };

      await circuitBreakerService.register(body.targetKey, config);

      return reply.code(201).send({
        success: true,
        message: `Circuit breaker registered for ${body.targetKey}`,
        data: config,
      });
    },
  );

  // Update configuration
  app.put(
    '/:targetKey/config',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const { targetKey } = request.params as { targetKey: string };
      const body = request.body as any;

      const config: Partial<CircuitBreakerConfig> = {};
      if (body.failureThreshold !== undefined) config.failureThreshold = body.failureThreshold;
      if (body.recoveryTimeoutMs !== undefined) config.recoveryTimeoutMs = body.recoveryTimeoutMs;
      if (body.successThreshold !== undefined) config.successThreshold = body.successThreshold;

      await circuitBreakerService.updateConfig(targetKey, config);

      return reply.send({
        success: true,
        message: `Configuration updated for ${targetKey}`,
      });
    },
  );

  // Reset circuit breaker to CLOSED
  app.post(
    '/:targetKey/reset',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const { targetKey } = request.params as { targetKey: string };
      await circuitBreakerService.reset(targetKey);

      return reply.send({
        success: true,
        message: `Circuit breaker reset to CLOSED for ${targetKey}`,
      });
    },
  );

  // Manually trip circuit breaker to OPEN
  app.post(
    '/:targetKey/trip',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const { targetKey } = request.params as { targetKey: string };
      await circuitBreakerService.trip(targetKey);

      return reply.send({
        success: true,
        message: `Circuit breaker tripped to OPEN for ${targetKey}`,
      });
    },
  );

  // Get event history for a target key
  app.get(
    '/:targetKey/events',
    { preHandler: [authenticateUser, requirePermission({ resource: 'circuit-breaker', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!circuitBreakerService) {
        return handleError(reply, new ServiceUnavailableError('Circuit breaker service not initialized'));
      }

      const { targetKey } = request.params as { targetKey: string };
      const query = request.query as any;
      const limit = parseInt(query.limit || '50', 10);

      const events = await circuitBreakerService.getEvents(targetKey, limit);

      return reply.send({ success: true, data: events, total: events.length });
    },
  );
}
