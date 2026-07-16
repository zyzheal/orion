/**
 * Artifact Version API Routes
 *
 * 制品版本追踪 REST API
 * 路由前缀: /api/v1/artifact-versions
 *
 * 提供：
 * - 版本列表查询（分页、过滤）
 * - 版本详情
 * - 部署历史
 * - 版本对比
 * - 溯源链查询
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ArtifactVersionRepository } from '../repositories/ArtifactVersionRepository';
import { ArtifactVersionService } from '../services/pipeline/ArtifactVersionService';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

interface ArtifactVersionQueryParams {
  pipelineId?: string;
  branch?: string;
  commitSha?: string;
  version?: string;
  artifactName?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

interface VersionParams {
  id: string;
}

interface TraceabilityParams {
  id: string;
}

interface DiffQueryParams {
  pipelineId: string;
  versionA: string;
  versionB: string;
}

interface HistoryParams {
  pipelineId: string;
  limit?: string;
}

export default async function artifactVersionRoutes(
  app: FastifyInstance,
  options: { database?: any }
): Promise<void> {

  // 创建 Repository 和 Service
  const repository = new ArtifactVersionRepository(options.database);
  const service = new ArtifactVersionService(repository);

  /**
   * GET /artifact-versions
   *
   * 获取制品版本列表（支持分页、过滤）
   */
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { pipelineId, branch, commitSha, version, artifactName, startDate, endDate, limit, offset } = request.query as ArtifactVersionQueryParams;

      const result = await repository.findWithFilters({
        pipelineId,
        branch,
        commitSha,
        version,
        artifactName,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return reply.status(200).send({
        success: true,
        data: {
          versions: result.versions,
          total: result.total,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /artifact-versions/:id
   *
   * 获取单个版本详情
   */
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const version = await repository.findById((request.params as any).id);

      if (!version) {
        return handleError(reply, new NotFoundError('Version not found'))
      }

      return reply.status(200).send({
        success: true,
        data: version,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /artifact-versions/:id/traceability
   *
   * 获取版本溯源链
   */
  app.get('/:id/traceability', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const chain = await repository.findTraceabilityChain((request.params as any).id);

      if (!chain) {
        return handleError(reply, new NotFoundError('Version not found'))
      }

      return reply.status(200).send({
        success: true,
        data: chain,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /artifact-versions/diff
   *
   * 版本对比
   */
  app.get('/diff', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { pipelineId, versionA, versionB } = request.query as any;

      if (!pipelineId || !versionA || !versionB) {
        return handleError(reply, new ValidationError('Missing required params: pipelineId, versionA, versionB'))
      }

      const diff = await repository.getVersionDiff(pipelineId, versionA, versionB);

      return reply.status(200).send({
        success: true,
        data: diff,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /artifact-versions/history/:pipelineId
   *
   * 获取部署历史
   */
  app.get('/history/:pipelineId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const limit = (request.query as any).limit ? parseInt((request.query as any).limit as string, 10) : 20;
      const history = await repository.getDeploymentHistory((request.params as any).pipelineId, limit);

      return reply.status(200).send({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /artifact-versions/commit/:commitSha
   *
   * 通过 Commit SHA 查找版本（代码溯源）
   */
  app.get('/commit/:commitSha', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const versions = await repository.findByCommitSha((request.params as any).commitSha);

      return reply.status(200).send({
        success: true,
        data: versions,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * POST /artifact-versions/:id/tags
   *
   * 添加标签
   */
  app.post('/:id/tags', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tag } = request.body as any;

      if (!tag) {
        return handleError(reply, new ValidationError('Tag is required'))
      }

      const version = await service.addTag((request.params as any).id, tag);

      return reply.status(200).send({
        success: true,
        data: version,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * DELETE /artifact-versions/:id/tags/:tag
   *
   * 删除标签
   */
  app.delete('/:id/tags/:tag', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await service.removeTag((request.params as any).id, (request.params as any).tag);

      return reply.status(200).send({
        success: true,
        data: { message: 'Tag removed' },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * POST /artifact-versions/:id/promote
   *
   * 晋升版本到目标环境
   */
  app.post('/:id/promote', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact-version', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetEnvironment } = request.body as any;

      if (!targetEnvironment) {
        return handleError(reply, new ValidationError('targetEnvironment is required'))
      }

      const newVersion = await service.promoteVersion((request.params as any).id, targetEnvironment);

      return reply.status(200).send({
        success: true,
        data: newVersion,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });
}