/**
 * User Controller - Fastify HTTP request/response handlers
 *
 * Bridges HTTP layer to UserService (PostgreSQL-backed)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService, UserServiceError, ListUsersOptions } from '../../services/user/UserService';

export class UserController {
  private service: UserService;

  constructor(service: UserService) {
    this.service = service;
  }

  /**
   * GET /api/v1/users — List users with pagination
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const options: ListUsersOptions = {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        tenantId: query.tenantId,
        status: query.status,
        role: query.role,
      };

      const result = await this.service.listUsers(options);
      await reply.send({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * GET /api/v1/users/:id — Get user detail
   */
  async getDetail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const user = await this.service.getUser(params.id);
      await reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserServiceError && err.code === 'USER_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'User not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * POST /api/v1/users — Create user
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.username || !body.passwordHash) {
        await reply.status(400).send({
          success: false,
          error: 'username and passwordHash are required',
        });
        return;
      }

      const user = await this.service.createUser({
        username: body.username as string,
        email: body.email as string | undefined,
        passwordHash: body.passwordHash as string,
        name: body.name as string | undefined,
        avatar_url: body.avatar_url as string | undefined,
        role: body.role as string | undefined,
        tenantId: body.tenantId as string | undefined,
      });

      await reply.status(201).send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserServiceError) {
        const statusMap: Record<string, number> = {
          INVALID_INPUT: 400,
          INVALID_PASSWORD: 400,
          DUPLICATE_USERNAME: 409,
          DUPLICATE_EMAIL: 409,
          INVALID_EMAIL: 400,
          INVALID_USERNAME_FORMAT: 400,
        };
        const status = statusMap[err.code] || 500;
        await reply.status(status).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create user',
      });
    }
  }

  /**
   * PUT /api/v1/users/:id — Update user
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;

      const user = await this.service.updateUser(params.id, {
        username: body.username as string | undefined,
        email: body.email as string | undefined,
        name: body.name as string | undefined,
        avatar_url: body.avatar_url as string | undefined,
        role: body.role as string | undefined,
        status: body.status as string | undefined,
        settings: body.settings as Record<string, any> | undefined,
      });

      await reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserServiceError && err.code === 'USER_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'User not found' });
        return;
      }
      if (err instanceof UserServiceError) {
        const statusMap: Record<string, number> = {
          DUPLICATE_USERNAME: 409,
          DUPLICATE_EMAIL: 409,
          INVALID_EMAIL: 400,
          UPDATE_FAILED: 500,
        };
        const status = statusMap[err.code] || 500;
        await reply.status(status).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * DELETE /api/v1/users/:id — Soft delete user
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const result = await this.service.deleteUser(params.id);
      await reply.send({ success: true, message: 'User deleted', data: result });
    } catch (err) {
      if (err instanceof UserServiceError && err.code === 'USER_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'User not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * GET /api/v1/users/:id/authenticate — Authenticate user (for internal use)
   */
  async authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, string>;
      if (!body.username || !body.password) {
        await reply.status(400).send({
          success: false,
          error: 'username and password are required',
        });
        return;
      }

      const user = await this.service.authenticate(body.username, body.password);
      await reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserServiceError && err.code === 'INVALID_CREDENTIALS') {
        await reply.status(401).send({ success: false, error: 'Invalid credentials' });
        return;
      }
      if (err instanceof UserServiceError && err.code === 'ACCOUNT_INACTIVE') {
        await reply.status(403).send({ success: false, error: 'Account is inactive' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * POST /api/v1/users/:id/change-password — Change user password
   */
  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, string>;

      if (!body.oldPassword || !body.newPassword) {
        await reply.status(400).send({
          success: false,
          error: 'oldPassword and newPassword are required',
        });
        return;
      }

      await this.service.changePassword(params.id, body.oldPassword, body.newPassword);
      await reply.send({ success: true, message: 'Password changed successfully' });
    } catch (err) {
      if (err instanceof UserServiceError && err.code === 'USER_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'User not found' });
        return;
      }
      if (err instanceof UserServiceError && err.code === 'INVALID_PASSWORD') {
        await reply.status(400).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * GET /api/v1/users/by-tenant/:tenantId — Get users by tenant
   */
  async getUsersByTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const users = await this.service.getUsersByTenant(params.tenantId);
      await reply.send({ success: true, data: users });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * POST /api/v1/users/:userId/tenants/:tenantId — Add user to tenant
   */
  async addUserToTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, string>;
      await this.service.addUserToTenant(params.userId, params.tenantId, body.role || 'member');
      await reply.send({ success: true, message: 'User added to tenant' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * DELETE /api/v1/users/:userId/tenants/:tenantId — Remove user from tenant
   */
  async removeUserFromTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      await this.service.removeUserFromTenant(params.userId, params.tenantId);
      await reply.send({ success: true, message: 'User removed from tenant' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
