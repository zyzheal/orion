/**
 * Config Management Enhanced API Routes
 *
 * Prefix: /api/v1/config-mgmt
 *
 * Provides endpoints for enhanced config change management
 * (change requests, drift detection, remediation).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ConfigChangeService } from '../services/config-mgmt/ConfigChangeService';
import { ConfigDriftDetector } from '../services/config-mgmt/ConfigDriftDetector';
import { ConfigManagementController } from './controllers/ConfigManagementController';

export interface ConfigMgmtEnhancedRoutesOptions {
  database?: DatabasePool;
}

export default async function configMgmtEnhancedRoutes(
  app: FastifyInstance,
  options: ConfigMgmtEnhancedRoutesOptions
): Promise<void> {
  // Initialize services
  const changeService = new ConfigChangeService({ database: options.database });
  const driftDetector = new ConfigDriftDetector({ database: options.database });
  const controller = new ConfigManagementController(changeService, driftDetector);

  // ==================== Change Requests ====================

  // POST /config-mgmt/change-requests - Submit change request
  app.post('/v1/config-mgmt/change-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createChangeRequest(request, reply);
  });

  // GET /config-mgmt/change-requests - List change requests
  app.get('/v1/config-mgmt/change-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listChangeRequests(request, reply);
  });

  // GET /config-mgmt/change-requests/:id - Get change request details
  app.get('/v1/config-mgmt/change-requests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getChangeRequest(request, reply);
  });

  // POST /config-mgmt/change-requests/:id/approve - Approve/reject change request
  app.post('/v1/config-mgmt/change-requests/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.approveChangeRequest(request, reply);
  });

  // POST /config-mgmt/change-requests/:id/execute - Execute change request
  app.post('/v1/config-mgmt/change-requests/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeChangeRequest(request, reply);
  });

  // POST /config-mgmt/change-requests/:id/rollback - Rollback change request
  app.post('/v1/config-mgmt/change-requests/:id/rollback', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rollbackChangeRequest(request, reply);
  });

  // GET /config-mgmt/change-requests/:id/history - Get change history
  app.get('/v1/config-mgmt/change-requests/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getChangeHistory(request, reply);
  });

  // ==================== Drift Detection ====================

  // POST /config-mgmt/drift-detect - Detect configuration drift
  app.post('/v1/config-mgmt/drift-detect', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectDrift(request, reply);
  });

  // POST /config-mgmt/drift/:id/remediate - Remediate drift
  app.post('/v1/config-mgmt/drift/:id/remediate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.remediateDrift(request, reply);
  });

  // GET /config-mgmt/drift-report - Get drift report
  app.get('/v1/config-mgmt/drift-report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDriftReport(request, reply);
  });
}
