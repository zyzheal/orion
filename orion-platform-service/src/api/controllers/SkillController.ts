/**
 * Skill Controller - Fastify HTTP request/response handlers
 *
 * Bridges HTTP layer to SkillService (PostgreSQL-backed)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SkillService, SkillServiceError } from '../../services/skill/SkillService';

export class SkillController {
  private service: SkillService;

  constructor(service: SkillService) {
    this.service = service;
  }

  // ==================== Skill CRUD ====================

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const tags = query.tags ? query.tags.split(',') : undefined;
      const result = await this.service.listSkills({
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.perPage ? parseInt(query.perPage, 10) : undefined,
        status: query.status,
        category: query.category,
        tags,
      });

      await reply.send({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getDetail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const skill = await this.service.getSkill(params.id);
      await reply.send({ success: true, data: skill });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.name || !body.version || !body.description || !body.category || !body.author) {
        await reply.status(400).send({
          success: false,
          error: 'name, version, description, category, and author are required',
        });
        return;
      }
      const skill = await this.service.createSkill({
        name: body.name as string,
        version: body.version as string,
        description: body.description as string,
        category: body.category as string,
        tags: (body.tags as string[]) ?? [],
        author: body.author as string,
        schema: (body.schema as Record<string, unknown>) ?? {},
      });

      await reply.status(201).send({ success: true, data: skill });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'DUPLICATE_NAME') {
        await reply.status(409).send({
          success: false,
          error: 'Skill name already exists',
        });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create skill',
      });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const skill = await this.service.updateSkill(params.id, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        category: body.category as string | undefined,
        tags: body.tags as string[] | undefined,
        status: body.status as string | undefined,
        schema: body.schema as Record<string, unknown> | undefined,
      });
      await reply.send({ success: true, data: skill });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update skill',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const deleted = await this.service.uninstallSkill(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, message: 'Skill deleted' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Version Management ====================

  async listVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      // Verify skill exists first
      await this.service.getSkill(params.id);
      const versions = await this.service.getVersions(params.id);
      await reply.send({ success: true, data: versions, total: versions.length });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async addVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      if (!body.version) {
        await reply.status(400).send({
          success: false,
          error: 'version is required',
        });
        return;
      }
      const version = await this.service.createVersion(params.id, {
        version: body.version as string,
        changelog: body.changelog as string | undefined,
        schema: body.schema as Record<string, unknown> | undefined,
      });

      await reply.status(201).send({ success: true, data: version });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to add version',
      });
    }
  }

  // ==================== Install / Uninstall ====================

  async install(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      await this.service.installSkill(params.id);
      const skill = await this.service.getSkill(params.id);
      await reply.send({ success: true, data: skill, message: 'Skill installed' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async uninstall(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const uninstalled = await this.service.uninstallSkill(params.id);
      if (!uninstalled) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, message: 'Skill uninstalled' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Rating ====================

  async rate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      if (!body.userId || body.rating === undefined) {
        await reply.status(400).send({
          success: false,
          error: 'userId and rating are required',
        });
        return;
      }
      const review = await this.service.addReview(params.id, {
        user_id: body.userId as string,
        rating: body.rating as number,
        comment: body.comment as string | undefined,
      });

      await reply.status(201).send({ success: true, data: review });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to rate skill',
      });
    }
  }
}
