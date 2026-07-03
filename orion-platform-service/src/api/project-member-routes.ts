/**
 * Project Member API Routes
 * Prefix: /api/v1/project-members
 *
 * 提供项目成员管理的 CRUD 接口。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission, getAuthzEngine } from '../middleware/requirePermission';
import { RelationshipService } from '../services/authz/RelationshipService';
import { DatabasePool } from '../services/database';
import { OrionError, ErrorCode, handleError } from '../errors';

interface MemberRoutesOptions {
  database?: DatabasePool;
}

interface ProjectParams {
  projectId: string;
}

interface UserParams {
  projectId: string;
  userId: string;
}

interface AddMemberBody {
  userId: string;
  role: string;
}

export default async function projectMemberRoutes(
  app: FastifyInstance,
  options: MemberRoutesOptions
): Promise<void> {
  const relService = options.database ? new RelationshipService(options.database) : null;

  if (!relService) {
    app.log.warn('[ProjectMemberRoutes] No database pool provided');
    return;
  }

  function handleError(error: Error, reply: FastifyReply) {
    return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR));
  }

  // GET /api/v1/project-members/:projectId - 获取项目成员列表
  app.get<{ Params: ProjectParams }>('/:projectId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'project', action: 'read' })],
  }, async (request, reply) => {
    try {
      const members = await relService.getProjectMembers(request.params.projectId, request.user!.tenantId);
      return reply.send({ data: members, total: members.length });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // POST /api/v1/project-members/:projectId - 添加项目成员
  app.post<{ Params: ProjectParams; Body: AddMemberBody }>('/:projectId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'project', action: 'write' })],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params;
      const { userId, role } = request.body;
      await relService.addProjectMember(projectId, userId, role, request.user!.tenantId);
      // 失效被添加用户的权限缓存
      const authz = getAuthzEngine();
      if (authz) {
        authz.invalidateUserCache(userId, request.user!.tenantId).catch(() => {});
      }
      return reply.status(201).send({ message: 'Member added', userId, role });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // DELETE /api/v1/project-members/:projectId/:userId - 移除项目成员
  app.delete<{ Params: UserParams }>('/:projectId/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'project', action: 'delete' })],
  }, async (request, reply) => {
    try {
      const { projectId, userId } = request.params;
      await relService.removeProjectMember(projectId, userId, request.user!.tenantId);
      // 失效被移除用户的权限缓存
      const authz = getAuthzEngine();
      if (authz) {
        authz.invalidateUserCache(userId, request.user!.tenantId).catch(() => {});
      }
      return reply.send({ message: 'Member removed' });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // GET /api/v1/project-members/:projectId/check/:userId - 检查用户是否为成员
  app.get<{ Params: UserParams }>('/:projectId/check/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'project', action: 'read' })],
  }, async (request, reply) => {
    try {
      const { projectId, userId } = request.params;
      const isMember = await relService.isProjectMember(projectId, userId, request.user!.tenantId);
      return reply.send({ isMember });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });
}
