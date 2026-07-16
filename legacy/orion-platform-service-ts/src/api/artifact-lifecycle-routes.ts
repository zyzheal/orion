/**
 * Artifact Lifecycle, Replication, and ACL API Routes
 * 制品生命周期、跨Registry复制、ACL控制 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { LifecycleService } from '../services/artifact/LifecycleService';
import { ReplicationService } from '../services/artifact/ReplicationService';
import { AclService } from '../services/artifact/AclService';
import { ArtifactLifecyclePolicyRepository, ArtifactReplicationRepository } from '../repositories/ArtifactLifecycleRepository';
import { ArtifactAclRepository } from '../repositories/ArtifactAclRepository';
import { PostgresArtifactRepository } from '../repositories/ArtifactRepository';
import { OrionError, ValidationError, NotFoundError, handleError } from '../errors';

interface ArtifactLifecycleRoutesOptions {
  database?: any;
}

export default async function artifactLifecycleRoutes(
  app: FastifyInstance,
  options: ArtifactLifecycleRoutesOptions
): Promise<void> {
  // 初始化依赖
  const db = options.database;
  const lifecyclePolicyRepository = db ? new ArtifactLifecyclePolicyRepository(db) : null;
  const replicationRepository = db ? new ArtifactReplicationRepository(db) : null;
  const aclRepository = db ? new ArtifactAclRepository(db) : null;
  const artifactRepository = db ? new PostgresArtifactRepository(db) : null;

  const lifecycleService = lifecyclePolicyRepository && artifactRepository
    ? new LifecycleService(lifecyclePolicyRepository, artifactRepository)
    : null;
  const replicationService = replicationRepository && artifactRepository
    ? new ReplicationService(replicationRepository, artifactRepository)
    : null;
  const aclService = aclRepository && artifactRepository
    ? new AclService(aclRepository, artifactRepository)
    : null;

  // DB 不可用时的统一错误响应
  const dbUnavailable = async (_request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE'));
  };

  // ==================== 生命周期管理 ====================

  // POST /lifecycle/promote - 制品升级（dev→test→prod）
  app.post('/lifecycle/promote', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!lifecycleService) return dbUnavailable(request, reply);
    try {
      const { artifactId, toStage, reason, approvedBy } = request.body as {
        artifactId: string;
        toStage: string;
        reason?: string;
        approvedBy?: string;
      };

      if (!artifactId || !toStage) {
        return handleError(reply, new ValidationError('artifactId and toStage are required'));
      }

      // 使用 PromotionService 进行升级
      const { PromotionService } = await import('../services/artifact/PromotionService');
      const promotionService = new PromotionService(db);

      let record;
      if (approvedBy) {
        record = await promotionService.promoteWithApproval(artifactId, (request.user as any)?.id || 'system', approvedBy, reason);
      } else {
        record = await promotionService.promote(artifactId, (request.user as any)?.id || 'system', reason);
      }

      return reply.send({ success: true, data: record });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // POST /lifecycle/expire - 设置过期策略
  app.post('/lifecycle/expire', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!lifecycleService) return dbUnavailable(request, reply);
    try {
      const { artifactId, maxAgeDays, maxVersions, maxSizeMb, protectedTags, schedule, enabled } = request.body as {
        artifactId: string;
        maxAgeDays: number;
        maxVersions?: number;
        maxSizeMb?: number;
        protectedTags?: string[];
        schedule?: string;
        enabled?: boolean;
      };

      if (!artifactId || !maxAgeDays) {
        return handleError(reply, new ValidationError('artifactId and maxAgeDays are required'));
      }

      const policy = await lifecycleService.createPolicy({
        artifactId,
        policyType: 'expire',
        config: {
          max_age_days: maxAgeDays,
          max_versions: maxVersions,
          max_size_mb: maxSizeMb,
          protected_tags: protectedTags || [],
          schedule: schedule,
        },
        enabled: enabled ?? true,
        createdBy: (request.user as any)?.id || 'system',
      });

      return reply.send({ success: true, data: policy });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // ==================== 跨 Registry 复制 ====================

  // POST /replicate - 跨 Registry 复制
  app.post('/replicate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!replicationService) return dbUnavailable(request, reply);
    try {
      const { artifactId, sourceRegistry, targetRegistry } = request.body as {
        artifactId: string;
        sourceRegistry: string;
        targetRegistry: string;
      };

      if (!artifactId || !sourceRegistry || !targetRegistry) {
        return handleError(reply, new ValidationError('artifactId, sourceRegistry, and targetRegistry are required'));
      }

      const replication = await replicationService.createReplication({
        artifactId,
        sourceRegistry,
        targetRegistry,
        initiatedBy: (request.user as any)?.id || 'system',
      });

      return reply.send({ success: true, data: replication });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // GET /replication-status/:id - 复制状态
  app.get('/replication-status/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!replicationService) return dbUnavailable(request, reply);
    try {
      const { id } = request.params as { id: string };
      const replication = await replicationService.getReplicationStatus(id);

      if (!replication) {
        return handleError(reply, new NotFoundError('Replication not found'));
      }

      return reply.send({ success: true, data: replication });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // ==================== ACL 控制 ====================

  // POST /acl - 设置 ACL 权限
  app.post('/acl', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!aclService) return dbUnavailable(request, reply);
    try {
      const { artifactId, subjectType, subjectId, permissions, effect } = request.body as {
        artifactId: string;
        subjectType: 'user' | 'group' | 'service';
        subjectId: string;
        permissions: string[];
        effect?: 'allow' | 'deny';
      };

      if (!artifactId || !subjectType || !subjectId || !permissions || !Array.isArray(permissions) || permissions.length === 0) {
        return handleError(reply, new ValidationError('artifactId, subjectType, subjectId, and permissions are required'));
      }

      const acl = await aclService.createAcl({
        artifactId,
        subjectType,
        subjectId,
        permissions,
        effect: effect || 'allow',
        createdBy: (request.user as any)?.id || 'system',
      });

      return reply.send({ success: true, data: acl });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // GET /acl/:artifactId - 获取 ACL
  app.get('/acl/:artifactId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!aclService) return dbUnavailable(request, reply);
    try {
      const { artifactId } = request.params as { artifactId: string };
      const acls = await aclService.getAclsByArtifact(artifactId);
      return reply.send({ success: true, data: acls });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // PUT /acl/:id - 更新 ACL
  app.put('/acl/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!aclService) return dbUnavailable(request, reply);
    try {
      const { id } = request.params as { id: string };
      const { permissions, effect } = request.body as {
        permissions?: string[];
        effect?: 'allow' | 'deny';
      };

      if (!permissions && !effect) {
        return handleError(reply, new ValidationError('permissions or effect is required'));
      }

      const acl = await aclService.updateAcl(id, { permissions, effect });
      return reply.send({ success: true, data: acl });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });
}
