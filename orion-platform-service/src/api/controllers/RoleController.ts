/**
 * Role Controller - Fastify HTTP request/response handlers
 *
 * Bridges HTTP layer to RoleService (PostgreSQL-backed)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { RoleService, RoleServiceError } from '../../services/role/RoleService';

export class RoleController {
  private service: RoleService;

  constructor(service: RoleService) {
    this.service = service;
  }

  // ==================== Role CRUD ====================

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const tenantId = query.tenantId;
      if (!tenantId) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId query parameter is required',
        });
        return;
      }
      const roles = await this.service.listRoles(tenantId);
      await reply.send({ success: true, data: roles, total: roles.length });
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
      const role = await this.service.getRole(params.id);
      await reply.send({ success: true, data: role });
    } catch (err) {
      if (err instanceof RoleServiceError && err.code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Role not found' });
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
      if (!body.tenantId || !body.name) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId and name are required',
        });
        return;
      }
      const role = await this.service.createRole(
        body.tenantId as string,
        body.name as string,
        (body.permissions as string[]) ?? []
      );
      await reply.status(201).send({ success: true, data: role });
    } catch (err) {
      if (err instanceof RoleServiceError && err.code === 'INVALID_INPUT') {
        await reply.status(400).send({
          success: false,
          error: err.message,
        });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create role',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const deleted = await this.service.deleteRole(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Role not found' });
        return;
      }
      await reply.send({ success: true, message: 'Role deleted' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
