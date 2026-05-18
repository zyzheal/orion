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
import { ArtifactVersionRepository } from '../repositories/ArtifactVersionRepository';
import { ArtifactVersionService } from '../services/pipeline/ArtifactVersionService';

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
  app.get('/', async (request: FastifyRequest<{ Querystring: ArtifactVersionQueryParams }>, reply: FastifyReply) => {
    try {
      const { pipelineId, branch, commitSha, version, artifactName, startDate, endDate, limit, offset } = request.query;

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
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /artifact-versions/:id
   *
   * 获取单个版本详情
   */
  app.get('/:id', async (request: FastifyRequest<{ Params: VersionParams }>, reply: FastifyReply) => {
    try {
      const version = await repository.findById(request.params.id);

      if (!version) {
        return reply.status(404).send({
          success: false,
          error: 'Version not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: version,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /artifact-versions/:id/traceability
   *
   * 获取版本溯源链
   */
  app.get('/:id/traceability', async (request: FastifyRequest<{ Params: TraceabilityParams }>, reply: FastifyReply) => {
    try {
      const chain = await repository.findTraceabilityChain(request.params.id);

      if (!chain) {
        return reply.status(404).send({
          success: false,
          error: 'Version not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: chain,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /artifact-versions/diff
   *
   * 版本对比
   */
  app.get('/diff', async (request: FastifyRequest<{ Querystring: DiffQueryParams }>, reply: FastifyReply) => {
    try {
      const { pipelineId, versionA, versionB } = request.query;

      if (!pipelineId || !versionA || !versionB) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required params: pipelineId, versionA, versionB',
          timestamp: new Date().toISOString(),
        });
      }

      const diff = await repository.getVersionDiff(pipelineId, versionA, versionB);

      return reply.status(200).send({
        success: true,
        data: diff,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /artifact-versions/history/:pipelineId
   *
   * 获取部署历史
   */
  app.get('/history/:pipelineId', async (request: FastifyRequest<{ Params: HistoryParams }>, reply: FastifyReply) => {
    try {
      const limit = request.query.limit ? parseInt(request.query.limit as string, 10) : 20;
      const history = await repository.getDeploymentHistory(request.params.pipelineId, limit);

      return reply.status(200).send({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /artifact-versions/commit/:commitSha
   *
   * 通过 Commit SHA 查找版本（代码溯源）
   */
  app.get('/commit/:commitSha', async (request: FastifyRequest<{ Params: { commitSha: string } }>, reply: FastifyReply) => {
    try {
      const versions = await repository.findByCommitSha(request.params.commitSha);

      return reply.status(200).send({
        success: true,
        data: versions,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /artifact-versions/:id/tags
   *
   * 添加标签
   */
  app.post('/:id/tags', async (request: FastifyRequest<{ Params: VersionParams; Body: { tag: string } }>, reply: FastifyReply) => {
    try {
      const { tag } = request.body;

      if (!tag) {
        return reply.status(400).send({
          success: false,
          error: 'Tag is required',
          timestamp: new Date().toISOString(),
        });
      }

      const version = await service.addTag(request.params.id, tag);

      return reply.status(200).send({
        success: true,
        data: version,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /artifact-versions/:id/tags/:tag
   *
   * 删除标签
   */
  app.delete('/:id/tags/:tag', async (request: FastifyRequest<{ Params: { id: string; tag: string } }>, reply: FastifyReply) => {
    try {
      await service.removeTag(request.params.id, request.params.tag);

      return reply.status(200).send({
        success: true,
        data: { message: 'Tag removed' },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /artifact-versions/:id/promote
   *
   * 晋升版本到目标环境
   */
  app.post('/:id/promote', async (request: FastifyRequest<{ Params: VersionParams; Body: { targetEnvironment: string } }>, reply: FastifyReply) => {
    try {
      const { targetEnvironment } = request.body;

      if (!targetEnvironment) {
        return reply.status(400).send({
          success: false,
          error: 'targetEnvironment is required',
          timestamp: new Date().toISOString(),
        });
      }

      const newVersion = await service.promoteVersion(request.params.id, targetEnvironment);

      return reply.status(200).send({
        success: true,
        data: newVersion,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}