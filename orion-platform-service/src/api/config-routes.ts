/**
 * Configuration Management API Routes
 *
 * Provides endpoints for config CRUD, GitOps sync, approval workflows,
 * and config diff/comparison operations.
 *
 * Prefix: /api/v1/config
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ConfigRepository } from '../services/config-mgmt/ConfigRepository';
import { ConfigService } from '../services/config-mgmt/ConfigService';
import { GitOpsService } from '../services/config-mgmt/GitOpsService';
import { ConfigApprovalService } from '../services/config-mgmt/ConfigApprovalService';
import { ConfigDiffService } from '../services/config-mgmt/ConfigDiffService';
import { ConfigController } from './controllers/ConfigController';
import { DatabasePool } from '../services/database';

export interface ConfigRoutesOptions {
  database?: DatabasePool;
}

export default async function configRoutes(
  app: FastifyInstance,
  options: ConfigRoutesOptions
): Promise<void> {
  // Initialize repository with PostgreSQL connection (falls back to in-memory if not provided)
  const configRepo = new ConfigRepository(options.database);

  // Initialize services - all depend on ConfigService which now uses the repository
  const configService = new ConfigService(configRepo);
  const gitOpsService = new GitOpsService({ configService });
  const approvalService = new ConfigApprovalService({ configService });
  const diffService = new ConfigDiffService({ configService });

  // Initialize controller
  const configController = new ConfigController(
    configService,
    gitOpsService,
    approvalService,
    diffService
  );

  // ==================== Config CRUD ====================

  // POST /configs - Create configuration item
  app.post('/configs', async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.create(request, reply);
  });

  // GET /configs - List configurations
  app.get('/configs', async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.list(request, reply);
  });

  // GET /configs/:configId - Get config detail
  app.get(
    '/configs/:configId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getById(request, reply);
    }
  );

  // PUT /configs/:configId - Update configuration
  app.put(
    '/configs/:configId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.update(request, reply);
    }
  );

  // DELETE /configs/:configId - Delete configuration (soft delete)
  app.delete(
    '/configs/:configId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.delete(request, reply);
    }
  );

  // GET /configs/:configId/versions - Get config version history
  app.get(
    '/configs/:configId/versions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getVersions(request, reply);
    }
  );

  // POST /configs/:configId/rollback - Rollback to a specific version
  app.post(
    '/configs/:configId/rollback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.rollback(request, reply);
    }
  );

  // POST /configs/:configId/clone - Clone config to another environment
  app.post(
    '/configs/:configId/clone',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.clone(request, reply);
    }
  );

  // ==================== GitOps ====================

  // POST /gitops - Enable GitOps synchronization
  app.post('/gitops', async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.enableGitOps(request, reply);
  });

  // GET /gitops - List GitOps configurations
  app.get('/gitops', async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.listGitOpsConfigs(request, reply);
  });

  // POST /gitops/:gitOpsConfigId/sync - Trigger manual sync
  app.post(
    '/gitops/:gitOpsConfigId/sync',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.syncFromGit(request, reply);
    }
  );

  // POST /gitops/:gitOpsConfigId/disable - Disable GitOps
  app.post(
    '/gitops/:gitOpsConfigId/disable',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.disableGitOps(request, reply);
    }
  );

  // GET /gitops/drift - Detect configuration drift
  app.get(
    '/gitops/drift',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.detectDrift(request, reply);
    }
  );

  // GET /gitops/sync-status - Get sync status history
  app.get(
    '/gitops/sync-status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getSyncStatus(request, reply);
    }
  );

  // ==================== Approval Workflow ====================

  // POST /change-requests - Create a config change request
  app.post(
    '/change-requests',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.createChangeRequest(request, reply);
    }
  );

  // GET /change-requests - List change requests
  app.get(
    '/change-requests',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.listChangeRequests(request, reply);
    }
  );

  // GET /change-requests/:changeRequestId - Get change request detail
  app.get(
    '/change-requests/:changeRequestId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getChangeRequest(request, reply);
    }
  );

  // POST /change-requests/:changeRequestId/approve - Approve change request
  app.post(
    '/change-requests/:changeRequestId/approve',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.approveChange(request, reply);
    }
  );

  // POST /change-requests/:changeRequestId/reject - Reject change request
  app.post(
    '/change-requests/:changeRequestId/reject',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.rejectChange(request, reply);
    }
  );

  // GET /configs/:configId/audit - Get audit trail for a config
  app.get(
    '/configs/:configId/audit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getAuditTrail(request, reply);
    }
  );

  // ==================== Diff & Comparison ====================

  // GET /diff/:sourceEnv/:targetEnv - Compare environments
  app.get(
    '/diff/:sourceEnv/:targetEnv',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.compareEnvironments(request, reply);
    }
  );

  // GET /configs/:configId/versions/diff - Compare config versions
  app.get(
    '/configs/:configId/versions/diff',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.compareVersions(request, reply);
    }
  );

  // GET /diff/report - Generate comprehensive diff report
  app.get(
    '/diff/report',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getDiffReport(request, reply);
    }
  );
}
