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
import { ConfigApprovalRepository } from '../repositories/ConfigApprovalRepository';
import { GitOpsRepository } from '../repositories/GitOpsRepository';
import { ConfigController } from './controllers/ConfigController';
import { DatabasePool } from '../services/database';
import { RedisCache } from '../services/redis-cache';
import { CacheService } from '../services/cache/CacheService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'config-routes' });

export interface ConfigRoutesOptions {
  database?: DatabasePool;
  redis?: RedisCache;
}

export default async function configRoutes(
  app: FastifyInstance,
  options: ConfigRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[ConfigRoutes] No database pool provided, config routes will not be functional');
    return;
  }
  // Initialize repository with PostgreSQL connection
  const configRepo = new ConfigRepository(options.database);

  // Initialize services - all depend on ConfigService which now uses the repository
  const cache = new CacheService(options.redis || null, 120);
  const configService = new ConfigService(configRepo, cache);
  const gitOpsRepo = new GitOpsRepository(options.database);
  const gitOpsService = new GitOpsService({ configService, repository: gitOpsRepo });
  const approvalRepo = new ConfigApprovalRepository(options.database);
  const approvalService = new ConfigApprovalService({ configService, repository: approvalRepo });
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
  app.post('/configs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.create(request, reply);
  });

  // GET /configs - List configurations
  app.get('/configs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.list(request, reply);
  });

  // GET /configs/:configId - Get config detail
  app.get(
    '/configs/:configId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getById(request, reply);
    }
  );

  // PUT /configs/:configId - Update configuration
  app.put(
    '/configs/:configId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.update(request, reply);
    }
  );

  // DELETE /configs/:configId - Delete configuration (soft delete)
  app.delete(
    '/configs/:configId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'delete' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.delete(request, reply);
    }
  );

  // GET /configs/:configId/versions - Get config version history
  app.get(
    '/configs/:configId/versions',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getVersions(request, reply);
    }
  );

  // POST /configs/:configId/rollback - Rollback to a specific version
  app.post(
    '/configs/:configId/rollback',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.rollback(request, reply);
    }
  );

  // POST /configs/:configId/clone - Clone config to another environment
  app.post(
    '/configs/:configId/clone',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.clone(request, reply);
    }
  );

  // ==================== GitOps ====================

  // POST /gitops - Enable GitOps synchronization
  app.post('/gitops', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.enableGitOps(request, reply);
  });

  // GET /gitops - List GitOps configurations
  app.get('/gitops', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return configController.listGitOpsConfigs(request, reply);
  });

  // POST /gitops/:gitOpsConfigId/sync - Trigger manual sync
  app.post(
    '/gitops/:gitOpsConfigId/sync',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.syncFromGit(request, reply);
    }
  );

  // POST /gitops/:gitOpsConfigId/disable - Disable GitOps
  app.post(
    '/gitops/:gitOpsConfigId/disable',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.disableGitOps(request, reply);
    }
  );

  // GET /gitops/drift - Detect configuration drift
  app.get(
    '/gitops/drift',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.detectDrift(request, reply);
    }
  );

  // GET /gitops/sync-status - Get sync status history
  app.get(
    '/gitops/sync-status',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getSyncStatus(request, reply);
    }
  );

  // ==================== Approval Workflow ====================

  // POST /change-requests - Create a config change request
  app.post(
    '/change-requests',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.createChangeRequest(request, reply);
    }
  );

  // GET /change-requests - List change requests
  app.get(
    '/change-requests',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.listChangeRequests(request, reply);
    }
  );

  // GET /change-requests/:changeRequestId - Get change request detail
  app.get(
    '/change-requests/:changeRequestId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getChangeRequest(request, reply);
    }
  );

  // POST /change-requests/:changeRequestId/approve - Approve change request
  app.post(
    '/change-requests/:changeRequestId/approve',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'approve' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.approveChange(request, reply);
    }
  );

  // POST /change-requests/:changeRequestId/reject - Reject change request
  app.post(
    '/change-requests/:changeRequestId/reject',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'approve' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.rejectChange(request, reply);
    }
  );

  // GET /configs/:configId/audit - Get audit trail for a config
  app.get(
    '/configs/:configId/audit',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getAuditTrail(request, reply);
    }
  );

  // ==================== Diff & Comparison ====================

  // GET /diff/:sourceEnv/:targetEnv - Compare environments
  app.get(
    '/diff/:sourceEnv/:targetEnv',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.compareEnvironments(request, reply);
    }
  );

  // GET /configs/:configId/versions/diff - Compare config versions
  app.get(
    '/configs/:configId/versions/diff',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.compareVersions(request, reply);
    }
  );

  // GET /diff/report - Generate comprehensive diff report
  app.get(
    '/diff/report',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return configController.getDiffReport(request, reply);
    }
  );
}
