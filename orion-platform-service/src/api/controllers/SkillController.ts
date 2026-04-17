/**
 * Skill Controller - Fastify HTTP request/response handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SkillService } from '../../services/skill/SkillService';

export class SkillController {
  private service: SkillService;

  constructor(service: SkillService) {
    this.service = service;
  }

  // ==================== Skill CRUD ====================

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const { skills, total } = await this.service.list({
        q: query.q,
        category: query.category as any,
        tag: query.tag,
        status: query.status as any,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: skills, total });
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
      const skill = await this.service.getById(params.id);
      if (!skill) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, data: skill });
    } catch (err) {
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
      const skill = await this.service.create({
        name: body.name as string,
        version: body.version as string,
        description: body.description as string,
        category: body.category as any,
        tags: (body.tags as string[]) ?? [],
        author: body.author as string,
        schema: (body.schema as Record<string, unknown>) ?? {},
      });

      await reply.status(201).send({ success: true, data: skill });
    } catch (err) {
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
      const skill = await this.service.update(params.id, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        category: body.category as any,
        tags: body.tags as string[] | undefined,
        status: body.status as any,
        schema: body.schema as Record<string, unknown> | undefined,
      });
      if (!skill) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, data: skill });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update skill',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const deleted = await this.service.delete(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, message: 'Skill deleted' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Version Management ====================

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
      const version = await this.service.addVersion({
        skillId: params.id,
        version: body.version as string,
        changelog: body.changelog as string | undefined,
        schema: body.schema as Record<string, unknown> | undefined,
      });

      await reply.status(201).send({ success: true, data: version });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to add version',
      });
    }
  }

  async listVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const skill = await this.service.getById(params.id);
      if (!skill) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      const versions = await this.service.listVersions(params.id);
      await reply.send({ success: true, data: versions, total: versions.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Install / Uninstall ====================

  async install(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const skill = await this.service.install(params.id);
      if (!skill) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, data: skill, message: 'Skill installed' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async uninstall(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const skill = await this.service.uninstall(params.id);
      if (!skill) {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.send({ success: true, data: skill, message: 'Skill uninstalled' });
    } catch (err) {
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
      const review = await this.service.rate({
        skillId: params.id,
        userId: body.userId as string,
        rating: body.rating as number,
        comment: body.comment as string | undefined,
      });

      await reply.status(201).send({ success: true, data: review });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to rate skill',
      });
    }
  }
}
