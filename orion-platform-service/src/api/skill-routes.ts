/**
 * Skill Management API Routes
 *
 * Routes under /api/v1/skills
 * Migrated to PostgreSQL Repository pattern (M12)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SkillRepository } from '../services/skill/SkillRepository';
import { SkillService } from '../services/skill/SkillService';
import { SkillController } from './controllers/SkillController';

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
    console.warn('[SkillRoutes] No database pool provided, skill routes will not be functional');
    return;
  }

  const service = new SkillService(repository);
  const controller = new SkillController(service);

  // ==================== Skill CRUD ====================

  // GET /api/v1/skills — list/search skills
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/skills/:id — skill detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDetail(request, reply);
  });

  // POST /api/v1/skills — create skill
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // PUT /api/v1/skills/:id — update skill
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /api/v1/skills/:id — delete skill
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Version Management ====================

  // GET /api/v1/skills/:id/versions — list versions
  app.get('/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listVersions(request, reply);
  });

  // POST /api/v1/skills/:id/versions — add version
  app.post('/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addVersion(request, reply);
  });

  // ==================== Install / Uninstall ====================

  // POST /api/v1/skills/:id/install — increment install count
  app.post('/:id/install', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.install(request, reply);
  });

  // POST /api/v1/skills/:id/uninstall — decrement install count
  app.post('/:id/uninstall', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.uninstall(request, reply);
  });

  // ==================== Rating ====================

  // POST /api/v1/skills/:id/rate — add rating
  app.post('/:id/rate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rate(request, reply);
  });
}
