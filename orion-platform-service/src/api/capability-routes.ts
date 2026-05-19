/**
 * Capability API Routes
 *
 * 路由前缀: /api/v1/capabilities
 * - GET /                          - 列出能力
 * - GET /tree                      - 获取能力树
 * - GET /:id                       - 获取能力详情
 * - POST /                         - 创建能力
 * - PUT /:id                       - 更新能力
 * - DELETE /:id                    - 删除能力
 * - POST /:id/roles                - 分配给角色
 * - DELETE /:id/roles/:roleName    - 从角色撤销
 * - POST /:id/users                - 分配给用户
 * - DELETE /:id/users/:userId      - 从用户撤销
 * - POST /commands/mapping         - 映射命令到能力
 * - GET /commands/:command/actions - 获取命令需要的能力
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CapabilityRepository, CapabilityService } from '../services/capability';
import { DatabasePool } from '../services/database';

interface CreateCapabilityBody {
  capability_id: string;
  name: string;
  description?: string;
  category: string;
  parent_capability_id?: string;
  risk_level?: number;
  requires_approval?: boolean;
  approval_role?: string;
}

interface UpdateCapabilityBody {
  name?: string;
  description?: string;
  risk_level?: number;
  requires_approval?: boolean;
  approval_role?: string;
}

interface GrantToRoleBody {
  roleName: string;
}

interface GrantToUserBody {
  userId: string;
  expiresInHours?: number;
}

interface MapCommandBody {
  command_name: string;
  command_action: string;
  capability_id: string;
  environment_suffix?: string;
}

interface IdParams {
  id: string;
}

interface RoleParams {
  id: string;
  roleName: string;
}

interface UserParams {
  id: string;
  userId: string;
}

export default async function capabilityRoutes(
  app: FastifyInstance,
  options: { database: DatabasePool }
): Promise<void> {
  const capRepo = new CapabilityRepository(options.database);
  const capService = new CapabilityService(capRepo);

  const getUserId = (request: FastifyRequest): string => {
    const user = (request as any).user;
    return user?.id || user?.userId || '';
  };

  // GET /api/v1/capabilities - 列出能力
  app.get('/api/v1/capabilities', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { category?: string };
      const capabilities = await capService.listCapabilities(query?.category);
      reply.send({ data: capabilities });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to list capabilities' });
    }
  });

  // GET /api/v1/capabilities/tree - 获取能力树
  app.get('/api/v1/capabilities/tree', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tree = await capService.getCapabilityTree(null);
      reply.send({ data: tree });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get capability tree' });
    }
  });

  // POST /api/v1/capabilities - 创建能力
  app.post('/api/v1/capabilities', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as CreateCapabilityBody;
      const capability = await capService.createCapability({ ...body, created_by: userId });
      reply.status(201).send({ data: capability });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'PARENT_NOT_FOUND' || code === 'INVALID_RISK_LEVEL' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to create capability' });
    }
  });

  // GET /api/v1/capabilities/:id - 获取能力详情
  app.get('/api/v1/capabilities/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as IdParams;
      const capability = await capService.getCapability(params.id);
      if (!capability) {
        return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Capability not found' });
      }
      reply.send({ data: capability });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get capability' });
    }
  });

  // PUT /api/v1/capabilities/:id - 更新能力
  app.put('/api/v1/capabilities/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as IdParams;
      const body = request.body as UpdateCapabilityBody;
      const capability = await capService.updateCapability(params.id, body);
      reply.send({ data: capability });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'NOT_FOUND' || code === 'INVALID_RISK_LEVEL' ? (code === 'NOT_FOUND' ? 404 : 400) : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to update capability' });
    }
  });

  // DELETE /api/v1/capabilities/:id - 删除能力
  app.delete('/api/v1/capabilities/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as IdParams;
      const deleted = await capService.deleteCapability(params.id);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Capability not found' });
      }
      reply.send({ data: { message: 'Capability deleted' } });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'HAS_CHILDREN' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to delete capability' });
    }
  });

  // POST /api/v1/capabilities/:id/roles - 分配给角色
  app.post('/api/v1/capabilities/:id/roles', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const params = request.params as IdParams;
      const body = request.body as GrantToRoleBody;
      await capService.grantCapabilityToRole(params.id, body.roleName, userId);
      reply.status(201).send({ data: { message: 'Capability granted to role' } });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'NOT_FOUND' || code === 'ROLE_NOT_FOUND' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to grant capability to role' });
    }
  });

  // DELETE /api/v1/capabilities/:id/roles/:roleName - 从角色撤销
  app.delete('/api/v1/capabilities/:id/roles/:roleName', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as RoleParams;
      await capService.revokeCapabilityFromRole(params.id, params.roleName);
      reply.send({ data: { message: 'Capability revoked from role' } });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to revoke capability from role' });
    }
  });

  // POST /api/v1/capabilities/:id/users - 分配给用户
  app.post('/api/v1/capabilities/:id/users', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const params = request.params as IdParams;
      const body = request.body as GrantToUserBody;
      await capService.grantCapabilityToUser(params.id, body.userId, userId, body.expiresInHours);
      reply.status(201).send({ data: { message: 'Capability granted to user' } });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'NOT_FOUND' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to grant capability to user' });
    }
  });

  // DELETE /api/v1/capabilities/:id/users/:userId - 从用户撤销
  app.delete('/api/v1/capabilities/:id/users/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as UserParams;
      await capService.revokeCapabilityFromUser(params.id, params.userId);
      reply.send({ data: { message: 'Capability revoked from user' } });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to revoke capability from user' });
    }
  });

  // POST /api/v1/capabilities/commands/mapping - 映射命令到能力
  app.post('/api/v1/capabilities/commands/mapping', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as MapCommandBody;
      await capService.mapCommandToCapability(body.command_name, body.command_action, body.capability_id, body.environment_suffix);
      reply.status(201).send({ data: { message: 'Command mapped to capability' } });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'NOT_FOUND' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to map command' });
    }
  });

  // GET /api/v1/capabilities/commands/:command/actions/:action - 获取命令需要的能力
  app.get('/api/v1/capabilities/commands/:command/actions/:action', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { command: string; action: string };
      const query = request.query as { environment?: string };
      const capabilityId = await capService.getCapabilityForCommand(params.command, params.action, query.environment);
      reply.send({ data: { capabilityId } });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get command capability' });
    }
  });

  // Permission check endpoint
  app.post('/api/v1/capabilities/check', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const body = request.body as { userId: string; userRoles: string[]; capabilityId: string };
      const result = await capService.checkPermission({
        userId: body.userId || user?.id,
        userRoles: body.userRoles || user?.roles || [],
        capabilityId: body.capabilityId,
      });
      reply.send({ data: result });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to check permission' });
    }
  });

  // ==================== Temporary Permissions ====================

  // POST /api/v1/capabilities/temporary - 授予临时权限（管理员操作）
  app.post('/api/v1/capabilities/temporary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as {
        tenant_id: string;
        user_id: string;
        capability_id: string;
        environment_suffix?: string;
        reason?: string;
        expires_in_hours: number;
      };

      if (!body.expires_in_hours || body.expires_in_hours <= 0) {
        return reply.status(400).send({ success: false, error: 'INVALID_DURATION', message: 'expires_in_hours must be positive' });
      }
      if (body.expires_in_hours > 720) {
        return reply.status(400).send({ success: false, error: 'DURATION_EXCEEDS_LIMIT', message: 'Temporary permissions cannot exceed 720 hours (30 days)' });
      }

      const tempPerm = await capService.grantTemporaryPermission({
        ...body,
        granted_by: userId,
      });
      reply.status(201).send({ data: tempPerm });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'NOT_FOUND' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to grant temporary permission' });
    }
  });

  // GET /api/v1/capabilities/temporary/:userId - 查询用户的活跃临时权限
  app.get('/api/v1/capabilities/temporary/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { userId: string };
      const query = request.query as { tenant_id?: string };
      const perms = await capService.getActiveTemporaryPermissions(params.userId, query.tenant_id);
      reply.send({ data: perms });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get temporary permissions' });
    }
  });

  // DELETE /api/v1/capabilities/temporary/:id - 撤销临时权限
  app.delete('/api/v1/capabilities/temporary/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const params = request.params as { id: string };
      const body = request.body as { reason?: string };
      const revoked = await capService.revokeTemporaryPermission(parseInt(params.id, 10), userId, body.reason);
      if (!revoked) {
        return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Temporary permission not found or already revoked' });
      }
      reply.send({ data: revoked });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to revoke temporary permission' });
    }
  });

  // ==================== Permission Audit ====================

  // GET /api/v1/capabilities/audit - 查询权限审计日志
  app.get('/api/v1/capabilities/audit', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        user_id?: string;
        capability_id?: string;
        action?: string;
        limit?: string;
        offset?: string;
      };
      const result = await capService.getAuditLogs({
        user_id: query.user_id,
        capability_id: query.capability_id,
        action: query.action,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      reply.send({ data: result });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get audit logs' });
    }
  });

  // ==================== Permission Request ====================

  // POST /api/v1/capabilities/request - 提交权限申请
  app.post('/api/v1/capabilities/request', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as {
        tenant_id?: string;
        user_id?: string; // 申请给谁（默认自己）
        capability_id: string;
        environment_suffix?: string;
        duration_hours: number;
        reason: string;
      };

      const targetUserId = body.user_id || userId;
      const duration = body.duration_hours || 8;

      // 验证能力存在
      const cap = await capService.getCapability(body.capability_id);
      if (!cap) {
        return reply.status(400).send({ success: false, error: 'INVALID_CAPABILITY', message: 'Capability not found' });
      }

      // 这里应该创建工单 + 审批流程
      // 简化实现：直接记录权限申请
      const permRequest = await capService.createPermissionRequest({
        ticket_id: 0, // 后续与工单系统集成
        capability_id: body.capability_id,
        environment_suffix: body.environment_suffix,
        duration_hours: duration,
        requested_for_user_id: targetUserId,
        capability_snapshot: { ...cap },
      });

      reply.status(201).send({ data: permRequest });
    } catch (error) {
      const code = (error as any).code;
      const statusCode = code === 'NOT_FOUND' ? 400 : 500;
      reply.status(statusCode).send({ success: false, error: code || 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to create permission request' });
    }
  });

  // GET /api/v1/capabilities/request/:ticketId - 查询权限申请详情
  app.get('/api/v1/capabilities/request/:ticketId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { ticketId: string };
      const permRequest = await capService.getPermissionRequestByTicket(parseInt(params.ticketId, 10));
      if (!permRequest) {
        return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Permission request not found' });
      }
      reply.send({ data: permRequest });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get permission request' });
    }
  });

  // POST /api/v1/capabilities/cleanup - 清理过期临时权限（管理员/定时任务）
  app.post('/api/v1/capabilities/cleanup', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capability', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await capService.cleanupExpiredTemporaryPermissions();
      reply.send({ data: result });
    } catch (error) {
      reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to cleanup expired permissions' });
    }
  });
}