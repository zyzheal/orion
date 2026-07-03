/**
 * Chaos Engineering API Routes
 *
 * Routes under /api/v1/chaos
 *
 * Provides chaos experiment management, fault injection execution, and recovery validation
 * via ChaosExperimentService, ChaosExecutor, and ChaosRecoveryValidator.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ChaosExperimentService } from '../services/chaos-engineering/ChaosExperimentService';
import { ChaosExecutor } from '../services/chaos-engineering/ChaosExecutor';
import { ChaosRecoveryValidator } from '../services/chaos-engineering/ChaosRecoveryValidator';
import { DatabasePool } from '../services/database';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { ServiceUnavailableError, handleError } from '../errors';


interface ChaosRoutesOptions {
  database?: DatabasePool;
}

export default async function chaosRoutes(
  app: FastifyInstance,
  options: ChaosRoutesOptions = {}
): Promise<void> {
  const db = options.database;

  if (!db) {
    // Register placeholder handlers when DB is not available
    app.all('/*', async (_request: FastifyRequest, reply: FastifyReply) => {
      return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'))
    });
    return;
  }

  const experimentService = new ChaosExperimentService(db);
  const chaosExecutor = new ChaosExecutor(db);
  const recoveryValidator = new ChaosRecoveryValidator();

  // ==================== Experiment CRUD ====================

  /**
   * POST /chaos/experiments - Create a chaos experiment
   */
  app.post('/experiments', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'create' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.name || !body.scope || !body.faults) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name, scope, and faults are required');
      }

      const experiment = await experimentService.createExperiment({
        tenant_id: (body.tenant_id as string) || getCurrentTenantId(),
        name: body.name as string,
        description: body.description as string | undefined,
        scope: body.scope as any,
        faults: body.faults as any[],
        steady_state_hypothesis: body.steady_state_hypothesis as string | undefined,
        auto_rollback: body.auto_rollback as boolean | undefined,
        created_by: body.created_by as string | undefined,
      });

      return created(reply, request, { experiment });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to create experiment');
    }
  });

  /**
   * GET /chaos/experiments - List chaos experiments
   */
  app.get('/experiments', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const result = await experimentService.listExperiments({
      tenant_id: query.tenant_id,
      status: query.status,
    });

    return success(reply, request, result);
  });

  /**
   * GET /chaos/experiments/:id - Get experiment by ID
   */
  app.get('/experiments/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const experiment = await experimentService.getExperiment(id);
      return success(reply, request, { experiment });
    } catch (error) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Experiment ${id} not found`);
    }
  });

  /**
   * PUT /chaos/experiments/:id - Update experiment
   */
  app.put('/experiments/:id', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'update' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      const experiment = await experimentService.updateExperiment(id, body as any);
      return success(reply, request, { experiment });
    } catch (error) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, error instanceof Error ? error.message : 'Experiment not found');
    }
  });

  /**
   * POST /chaos/experiments/:id/activate - Activate an experiment
   */
  app.post('/experiments/:id/activate', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const experiment = await experimentService.activateExperiment(id);
      return success(reply, request, { experiment });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to activate experiment');
    }
  });

  /**
   * POST /chaos/experiments/:id/archive - Archive an experiment
   */
  app.post('/experiments/:id/archive', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await experimentService.archiveExperiment(id);
      return success(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to archive experiment');
    }
  });

  // ==================== Experiment Execution ====================

  /**
   * POST /chaos/experiments/:id/run - Run an experiment
   */
  app.post('/experiments/:id/run', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      const result = await experimentService.runExperiment(id, body as any);
      return created(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to run experiment');
    }
  });

  /**
   * GET /chaos/runs/:runId - Get run details
   */
  app.get('/runs/:runId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    try {
      const run = await experimentService.getRun(runId);
      return success(reply, request, { run });
    } catch (error) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Run ${runId} not found`);
    }
  });

  /**
   * POST /chaos/runs/:runId/rollback - Rollback a run
   */
  app.post('/runs/:runId/rollback', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    const body = request.body as Record<string, unknown>;
    try {
      const result = await experimentService.rollbackRun(runId, body.reason as string | undefined);
      return success(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to rollback run');
    }
  });

  // ==================== Fault Injection (Direct) ====================

  /**
   * POST /chaos/inject/cpu-spike - Direct CPU spike injection
   */
  app.post('/inject/cpu-spike', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.target || !body.config) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'target and config are required');
      }
      const result = await chaosExecutor.executeCPUSpike(body.target as string, body.config as any);
      return created(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'CPU spike injection failed');
    }
  });

  /**
   * POST /chaos/inject/memory-leak - Direct memory leak injection
   */
  app.post('/inject/memory-leak', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.target || !body.config) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'target and config are required');
      }
      const result = await chaosExecutor.executeMemoryLeak(body.target as string, body.config as any);
      return created(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Memory leak injection failed');
    }
  });

  /**
   * POST /chaos/inject/network-latency - Direct network latency injection
   */
  app.post('/inject/network-latency', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.target || !body.config) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'target and config are required');
      }
      const result = await chaosExecutor.executeNetworkLatency(body.target as string, body.config as any);
      return created(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Network latency injection failed');
    }
  });

  /**
   * POST /chaos/inject/service-down - Direct service down injection
   */
  app.post('/inject/service-down', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.target || !body.config) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'target and config are required');
      }
      const result = await chaosExecutor.executeServiceDown(body.target as string, body.config as any);
      return created(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Service down injection failed');
    }
  });

  // ==================== Experiment Status & Recovery ====================

  /**
   * GET /chaos/experiments/running - Get running experiments
   */
  app.get('/experiments-running', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const running = chaosExecutor.getRunningExperiments();
    return success(reply, request, { experiments: running, total: running.length });
  });

  /**
   * POST /chaos/recover/:experimentId - Recover an experiment
   */
  app.post('/recover/:experimentId', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    try {
      const result = await chaosExecutor.recoverExperiment(experimentId);
      return success(reply, request, result);
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Recovery failed');
    }
  });

  /**
   * POST /chaos/validate-recovery/:experimentId - Validate recovery after experiment
   */
  app.post('/validate-recovery/:experimentId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    const validation = await recoveryValidator.validateRecovery(experimentId);
    return success(reply, request, { validation });
  });

  /**
   * GET /chaos/recovery-report/:experimentId - Get recovery report
   */
  app.get('/recovery-report/:experimentId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    const report = await recoveryValidator.generateRecoveryReport(experimentId);
    return success(reply, request, { report });
  });

  // ==================== Pre-release Verify ====================

  /**
   * POST /chaos/pre-release-verify - Run pre-release verification
   */
  app.post('/pre-release-verify', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'chaos-engineering', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.service_id || !body.environment) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'service_id and environment are required');
      }

      const result = await experimentService.preReleaseVerify(body as any);
      return success(reply, request, { verification: result });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Pre-release verification failed');
    }
  });
}
