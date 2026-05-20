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

  // ==================== Instance Management ====================

  async listInstances(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const user = (request as any).user;
      const tenantId = user?.tenantId;

      if (!tenantId) {
        await reply.status(400).send({ success: false, error: 'Tenant ID is required' });
        return;
      }

      const instances = await this.service.listInstances(params.id, tenantId);
      await reply.send({ success: true, data: instances, total: instances.length });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list instances',
      });
    }
  }

  async createInstance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const user = (request as any).user;
      const tenantId = user?.tenantId;

      if (!tenantId) {
        await reply.status(400).send({ success: false, error: 'Tenant ID is required' });
        return;
      }

      if (!body.name) {
        await reply.status(400).send({ success: false, error: 'Instance name is required' });
        return;
      }

      const instance = await this.service.createInstance({
        skill_id: params.id,
        tenant_id: tenantId,
        project_id: body.projectId as string | undefined,
        name: body.name as string,
        description: body.description as string | undefined,
        config: (body.config as Record<string, unknown>) || {},
        bindings: (body.bindings as Record<string, unknown>) || {},
        metadata: (body.metadata as Record<string, unknown>) || {},
        is_default: (body.isDefault as boolean) || false,
        created_by: user?.id,
        version: body.version as string | undefined,
      });

      await reply.status(201).send({ success: true, data: instance });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create instance',
      });
    }
  }

  async updateInstance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const user = (request as any).user;
      const tenantId = user?.tenantId;

      const instance = await this.service.updateInstance(params.instanceId, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        config: body.config as Record<string, unknown> | undefined,
        bindings: body.bindings as Record<string, unknown> | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
        is_default: body.isDefault as boolean | undefined,
        status: body.status as string | undefined,
        project_id: body.projectId as string | undefined,
      }, tenantId);

      await reply.send({ success: true, data: instance });
    } catch (err) {
      if (err instanceof SkillServiceError && (err.code === 'INSTANCE_NOT_FOUND')) {
        await reply.status(404).send({ success: false, error: 'Instance not found' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update instance',
      });
    }
  }

  async deleteInstance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const user = (request as any).user;
      const tenantId = user?.tenantId;

      await this.service.deleteInstance(params.instanceId, tenantId);
      await reply.send({ success: true, message: 'Instance deleted' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'INSTANCE_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Instance not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete instance',
      });
    }
  }

  // ==================== Direct Execution ====================

  async executeSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const user = (request as any).user;
      const tenantId = user?.tenantId || body.tenantId as string;

      if (!tenantId) {
        await reply.status(400).send({ success: false, error: 'Tenant ID is required' });
        return;
      }

      const execution = await this.service.executeSkill(params.id, {
        tenantId,
        projectId: body.projectId as string | undefined,
        userId: user?.id || body.userId as string | undefined,
        capability: body.capability as string | undefined,
        instanceId: body.instanceId as string | undefined,
        input: (body.input as Record<string, unknown>) || {},
        sync: (body.sync as boolean) || false,
        timeout: (body.timeout as number) || 300,
      });

      await reply.status(200).send({ success: true, data: execution });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      if (err instanceof SkillServiceError && err.code === 'INSTANCE_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Instance not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute skill',
      });
    }
  }

  async listExecutions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string | undefined>;
      const user = (request as any).user;
      const tenantId = user?.tenantId;

      if (!tenantId) {
        await reply.status(400).send({ success: false, error: 'Tenant ID is required' });
        return;
      }

      const result = await this.service.getExecutions(
        params.id,
        tenantId,
        query.page ? parseInt(query.page, 10) : 1,
        query.limit ? parseInt(query.limit, 10) : 20
      );

      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list executions',
      });
    }
  }

  async listAllExecutions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const user = (request as any).user;
      const tenantId = user?.tenantId;

      if (!tenantId) {
        await reply.status(400).send({ success: false, error: 'Tenant ID is required' });
        return;
      }

      const result = await this.service.getAllExecutions(
        tenantId,
        query.page ? parseInt(query.page, 10) : 1,
        query.limit ? parseInt(query.limit, 10) : 20,
        query.skillId
      );

      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list executions',
      });
    }
  }

  // ==================== Review Workflow ====================

  async submitForReview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const user = (request as any).user;
      const userId = user?.id;

      if (!userId) {
        await reply.status(400).send({ success: false, error: 'User ID is required' });
        return;
      }

      const skill = await this.service.submitForReview(params.id, userId);
      await reply.send({ success: true, data: skill, message: 'Skill submitted for review' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      if (err instanceof SkillServiceError && err.code === 'INVALID_STATE') {
        await reply.status(400).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to submit for review',
      });
    }
  }

  async approveSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const user = (request as any).user;
      const userId = user?.id;

      if (!userId) {
        await reply.status(400).send({ success: false, error: 'User ID is required' });
        return;
      }

      const skill = await this.service.approveSkill(
        params.id,
        userId,
        body.reason as string | undefined
      );

      await reply.send({ success: true, data: skill, message: 'Skill approved' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      if (err instanceof SkillServiceError && err.code === 'INVALID_STATE') {
        await reply.status(400).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to approve skill',
      });
    }
  }

  async rejectSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const user = (request as any).user;
      const userId = user?.id;

      if (!userId) {
        await reply.status(400).send({ success: false, error: 'User ID is required' });
        return;
      }

      const reason = body.reason as string;
      if (!reason) {
        await reply.status(400).send({ success: false, error: 'Rejection reason is required' });
        return;
      }

      const skill = await this.service.rejectSkill(params.id, userId, reason);
      await reply.send({ success: true, data: skill, message: 'Skill rejected' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      if (err instanceof SkillServiceError && err.code === 'INVALID_STATE') {
        await reply.status(400).send({ success: false, error: err.message });
        return;
      }
      if (err instanceof SkillServiceError && err.code === 'INVALID_INPUT') {
        await reply.status(400).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reject skill',
      });
    }
  }

  async archiveSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const user = (request as any).user;
      const userId = user?.id;

      if (!userId) {
        await reply.status(400).send({ success: false, error: 'User ID is required' });
        return;
      }

      const skill = await this.service.archiveSkill(
        params.id,
        userId,
        body.reason as string | undefined
      );

      await reply.send({ success: true, data: skill, message: 'Skill archived' });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      if (err instanceof SkillServiceError && err.code === 'INVALID_STATE') {
        await reply.status(400).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to archive skill',
      });
    }
  }

  async pendingReview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const result = await this.service.getPendingReview({
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        category: query.category,
      });

      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list pending reviews',
      });
    }
  }

  async getAuditLog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string | undefined>;

      const result = await this.service.getAuditLog(
        params.id,
        query.page ? parseInt(query.page, 10) : 1,
        query.limit ? parseInt(query.limit, 10) : 50
      );

      await reply.send({ success: true, data: result });
    } catch (err) {
      if (err instanceof SkillServiceError && err.code === 'SKILL_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Skill not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get audit log',
      });
    }
  }
}
