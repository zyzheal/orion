/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/skill/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Skill Management API Routes
 *
 * Routes under /api/v1/skills
 * Migrated to PostgreSQL Repository pattern (M12)
 *
 * Includes:
 * - Skill CRUD
 * - Version management
 * - Instance management (tenant-scoped)
 * - Direct execution (non-Pipeline)
 * - Execution history
 * - Review workflow (submit/approve/reject/archive)
 * - Audit log
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SkillRepository } from '../services/skill/SkillRepository';
import { SkillService } from '../services/skill/SkillService';
import { SkillController } from './controllers/SkillController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';

const logger = createLogger('skill-routes');

/**
 * Skill permissions matrix
 */
const SkillPermissions = {
  READ:    { resource: 'skill', action: 'read' },
  WRITE:   { resource: 'skill', action: 'write' },
  USE:     { resource: 'skill', action: 'use' },
  INSTALL: { resource: 'skill', action: 'install' },
  CONFIG:  { resource: 'skill', action: 'config' },
  ADMIN:   { resource: 'skill', action: 'admin' },
};

interface SkillRoutesOptions {
  database?: DatabasePool;
}

export default async function skillRoutes(
  app: FastifyInstance,
  options: SkillRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new SkillRepository(options.database)
    : undefined;

  if (!repository) {
    logger.warn('[SkillRoutes] No database pool provided, skill routes will not be functional');
    return;
  }

  const service = new SkillService(repository);
  const controller = new SkillController(service);

  // ==================== Skill CRUD ====================

  // GET /api/v1/skills — list/search skills
  app.get('/', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.READ)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/skills/:id — skill detail
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.READ, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDetail(request, reply);
  });

  // POST /api/v1/skills — create skill
  app.post('/', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.WRITE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // PUT /api/v1/skills/:id — update skill
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.WRITE, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /api/v1/skills/:id — delete skill
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Version Management ====================

  // GET /api/v1/skills/:id/versions — list versions
  app.get('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.READ, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listVersions(request, reply);
  });

  // POST /api/v1/skills/:id/versions — add version
  app.post('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.WRITE, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addVersion(request, reply);
  });

  // ==================== Install / Uninstall ====================

  // POST /api/v1/skills/:id/install — increment install count
  app.post('/:id/install', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.INSTALL)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.install(request, reply);
  });

  // POST /api/v1/skills/:id/uninstall — decrement install count
  app.post('/:id/uninstall', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.INSTALL)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.uninstall(request, reply);
  });

  // ==================== Rating ====================

  // POST /api/v1/skills/:id/rate — add rating
  app.post('/:id/rate', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.WRITE, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rate(request, reply);
  });

  // ==================== Instance Management ====================

  // GET /api/v1/skills/:id/instances — list instances for a skill
  app.get('/:id/instances', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.READ, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listInstances(request, reply);
  });

  // POST /api/v1/skills/:id/instances — create instance
  app.post('/:id/instances', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.CONFIG)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createInstance(request, reply);
  });

  // PUT /api/v1/skills/:id/instances/:instanceId — update instance
  app.put('/:id/instances/:instanceId', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.CONFIG)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateInstance(request, reply);
  });

  // DELETE /api/v1/skills/:id/instances/:instanceId — delete instance
  app.delete('/:id/instances/:instanceId', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.CONFIG)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteInstance(request, reply);
  });

  // ==================== Direct Execution ====================

  // POST /api/v1/skills/:id/execute — direct execution (non-Pipeline)
  app.post('/:id/execute', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.USE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeSkill(request, reply);
  });

  // GET /api/v1/skills/:id/executions — execution history for a skill
  app.get('/:id/executions', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.READ, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listExecutions(request, reply);
  });

  // GET /api/v1/skills/executions — all executions (admin)
  app.get('/executions', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listAllExecutions(request, reply);
  });

  // ==================== Review Workflow ====================

  // POST /api/v1/skills/:id/submit — submit for review
  app.post('/:id/submit', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.WRITE, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.submitForReview(request, reply);
  });

  // POST /api/v1/skills/:id/approve — approve skill
  app.post('/:id/approve', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.approveSkill(request, reply);
  });

  // POST /api/v1/skills/:id/reject — reject skill
  app.post('/:id/reject', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rejectSkill(request, reply);
  });

  // POST /api/v1/skills/:id/archive — archive/unpublish skill
  app.post('/:id/archive', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.archiveSkill(request, reply);
  });

  // GET /api/v1/skills/pending-review — pending review list (paginated)
  app.get('/pending-review', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.pendingReview(request, reply);
  });

  // GET /api/v1/skills/:id/audit — audit log for a skill
  app.get('/:id/audit', {
    onRequest: [authenticateUser, requirePermission({ ...SkillPermissions.READ, extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditLog(request, reply);
  });

  // GET /api/v1/skills/audit — global audit log (admin)
  app.get('/audit', {
    onRequest: [authenticateUser, requirePermission(SkillPermissions.ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAllAuditLogs(request, reply);
  });
}