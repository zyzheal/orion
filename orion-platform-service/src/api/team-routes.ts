/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/team/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Team API Routes
 *
 * 路由前缀: /
 * - GET /                          - 列出团队
 * - POST /                         - 创建团队
 * - GET /:id                       - 获取团队详情
 * - PUT /:id                       - 更新团队
 * - DELETE /:id                    - 删除团队
 * - GET /:id/members               - 获取团队成员
 * - POST /:id/members              - 添加成员
 * - DELETE /:id/members/:userId    - 移除成员
 * - PUT /:id/members/:userId/role  - 更新成员角色
 * - GET /:id/roles                 - 获取团队角色
 * - POST /:id/roles                - 分配角色
 * - DELETE /:id/roles/:roleName    - 移除角色
 * - GET /my                        - 获取当前用户的团队
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { TeamRepository, TeamService } from '../services/team';
import { DatabasePool } from '../services/database';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { OrionError, NotFoundError, ErrorCode, handleError } from '../errors';

interface CreateTeamBody {
  name: string;
  slug: string;
  description?: string;
  team_type?: 'functional' | 'project' | 'sre' | 'dba' | 'security';
  parent_team_id?: string;
  external_id?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateTeamBody {
  name?: string;
  description?: string;
  team_type?: string;
  parent_team_id?: string;
  metadata?: Record<string, unknown>;
}

interface AddMemberBody {
  userId: string;
  role?: 'member' | 'lead' | 'admin';
}

interface UpdateMemberRoleBody {
  role: 'member' | 'lead' | 'admin';
}

interface AssignRoleBody {
  roleName: string;
}

interface IdParams {
  id: string;
}

interface UserIdParams {
  id: string;
  userId: string;
}

interface RoleNameParams {
  id: string;
  roleName: string;
}

export default async function teamRoutes(
  app: FastifyInstance,
  options: { database: DatabasePool }
): Promise<void> {
  const teamRepo = new TeamRepository(options.database);
  const teamService = new TeamService(teamRepo);

  const getTenantId = (request: FastifyRequest): string => {
    const user = (request as any).user;
    return user?.tenantId || getCurrentTenantId();
  };

  const getUserId = (request: FastifyRequest): string => {
    const user = (request as any).user;
    return user?.id || user?.userId || '';
  };

  // GET / - 列出团队（支持分页和过滤）
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string | undefined>;
      const type = query.type;
      const limit = Math.min(Math.max(parseInt(query.limit || '50', 10), 1), 100);
      const offset = Math.max(parseInt(query.offset || '0', 10), 0);

      const result = await teamService.listTeams(tenantId, type, limit, offset);

      reply.send({ data: result.teams, total: result.total, limit, offset });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // POST / - 创建团队
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as CreateTeamBody;

      const team = await teamService.createTeam({
        tenant_id: tenantId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        team_type: body.team_type,
        parent_team_id: body.parent_team_id,
        external_id: body.external_id,
        metadata: body.metadata,
        created_by: userId,
      });

      reply.status(201).send({ data: team });
    } catch (error) {
      const code = (error as any).code === 'DUPLICATE_SLUG' ? 409 :
                   (error as any).code === 'INVALID_SLUG' ? 400 :
                   (error as any).code === 'INVALID_PARENT_TEAM' ? 400 : 500;
      reply.status(code).send({
        error: (error as any).code || 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create team',
      });
    }
  });

  // GET /my - 获取当前用户的团队
  app.get('/my', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const teams = await teamService.getUserTeams(userId, tenantId);

      reply.send({ data: teams });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // GET /:id - 获取团队详情
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as IdParams;
      const team = await teamService.getTeam(params.id, tenantId);

      if (!team) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      reply.send({ data: team });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // PUT /:id - 更新团队
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as IdParams;
      const body = request.body as UpdateTeamBody;
      const team = await teamService.updateTeam(params.id, tenantId, body);

      reply.send({ data: team });
    } catch (error) {
      const code = (error as any).code === 'TEAM_NOT_FOUND' ? 404 :
                   (error as any).code === 'CIRCULAR_REFERENCE' ? 400 :
                   (error as any).code === 'INVALID_PARENT_TEAM' ? 400 : 500;
      reply.status(code).send({
        error: (error as any).code || 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update team',
      });
    }
  });

  // DELETE /:id - 删除团队
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as IdParams;
      const result = await teamService.deleteTeam(params.id, tenantId);

      if (!result.deleted) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      const response: { message: string; orphanedChildren?: number } = { message: 'Team deleted' };
      if (result.orphanedChildren > 0) {
        response.orphanedChildren = result.orphanedChildren;
      }
      reply.send({ data: response });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // GET /:id/members - 获取团队成员
  app.get('/:id/members', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as IdParams;
      const members = await teamService.getTeamMembers(params.id, tenantId);

      reply.send({ data: members });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // POST /:id/members - 添加成员 (已存在时更新角色)
  app.post('/:id/members', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const params = request.params as IdParams;
      const body = request.body as AddMemberBody;
      const member = await teamService.addMember(params.id, body.userId, tenantId, body.role, userId);

      reply.status(201).send({ data: member });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // DELETE /:id/members/:userId - 移除成员
  app.delete('/:id/members/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as UserIdParams;
      const removed = await teamService.removeMember(params.id, params.userId, tenantId);

      if (!removed) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      reply.send({ data: { message: 'Member removed' } });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // PUT /:id/members/:userId/role - 更新成员角色
  app.put('/:id/members/:userId/role', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as UserIdParams;
      const body = request.body as UpdateMemberRoleBody;
      const member = await teamService.updateMemberRole(params.id, params.userId, tenantId, body.role);

      reply.send({ data: member });
    } catch (error) {
      const code = (error as any).code === 'MEMBER_NOT_FOUND' ? 404 :
                   (error as any).code === 'TEAM_NOT_FOUND' ? 404 : 500;
      reply.status(code).send({
        error: (error as any).code || 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update member role',
      });
    }
  });

  // GET /:id/roles - 获取团队角色
  app.get('/:id/roles', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as IdParams;
      const roles = await teamService.getTeamRoles(params.id, tenantId);

      reply.send({ data: roles });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // POST /:id/roles - 分配角色
  app.post('/:id/roles', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const params = request.params as IdParams;
      const body = request.body as AssignRoleBody;
      await teamService.assignRole(params.id, body.roleName, tenantId, userId);

      reply.status(201).send({ data: { message: 'Role assigned' } });
    } catch (error) {
      const code = (error as any).code === 'INVALID_ROLE' ? 400 :
                   (error as any).code === 'TEAM_NOT_FOUND' ? 404 : 500;
      reply.status(code).send({
        error: (error as any).code || 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to assign role',
      });
    }
  });

  // DELETE /:id/roles/:roleName - 移除角色
  app.delete('/:id/roles/:roleName', {
    onRequest: [authenticateUser, requirePermission({ resource: 'team', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.params as RoleNameParams;
      const removed = await teamService.removeRole(params.id, params.roleName, tenantId);

      if (!removed) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      reply.send({ data: { message: 'Role removed' } });
    } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });
}