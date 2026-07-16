/**
 * Dependency Coordination API Routes
 *
 * Pipeline依赖协调API
 *
 * Routes:
 *   POST   /api/v1/pipelines/:id/dependencies           - 注册依赖
 *   GET    /api/v1/pipelines/:id/dependencies           - 获取依赖
 *   DELETE /api/v1/pipelines/:id/dependencies           - 注销依赖
 *   GET    /api/v1/pipelines/dependencies/graph         - 获取依赖图
 *   POST   /api/v1/pipelines/dependencies/resolve/:id   - 解析指定pipeline的依赖
 *   GET    /api/v1/pipelines/dependencies/cycles        - 检测循环依赖
 *   GET    /api/v1/pipelines/dependencies/topological   - 获取拓扑排序
 *   POST   /api/v1/pipelines/dependencies/resolve-all   - 批量解析所有依赖
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DependencyCoordinationService, PipelineResult } from '../services/pipeline/DependencyCoordinationService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

export interface DependencyCoordinationRouteDeps {
  dependencyCoordinationService: DependencyCoordinationService;
}

export async function registerDependencyCoordinationRoutes(
  app: FastifyInstance,
  deps: DependencyCoordinationRouteDeps
): Promise<void> {
  const { dependencyCoordinationService } = deps;

  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // ==================== POST /api/v1/pipelines/:id/dependencies ====================
    // 注册pipeline依赖
    instance.post(
      '/v1/pipelines/:id/dependencies',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'write' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const params = request.params as { id: string };
          const body = request.body as {
            dependsOn: string[];
            requiredInputs?: Record<string, unknown>;
            blockingStatus?: ('success' | 'failed' | 'any')[];
          };

          const { dependsOn, requiredInputs, blockingStatus } = body;

          if (!dependsOn || !Array.isArray(dependsOn)) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          await dependencyCoordinationService.registerDependency(
            params.id,
            dependsOn,
            requiredInputs,
            blockingStatus
          );

          return reply.send({
            message: 'Dependency registered successfully',
            pipelineId: params.id,
            dependsOn,
            requiredInputs: requiredInputs || {},
            blockingStatus: blockingStatus || ['success'],
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== GET /api/v1/pipelines/:id/dependencies ====================
    // 获取指定pipeline的依赖信息
    instance.get(
      '/v1/pipelines/:id/dependencies',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const params = request.params as { id: string };

          const dependency = await dependencyCoordinationService.getDependency(params.id);

          if (!dependency) {
            return handleError(reply, new NotFoundError('NOT_FOUND'))
          }

          return reply.send(dependency);
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== DELETE /api/v1/pipelines/:id/dependencies ====================
    // 注销pipeline依赖
    instance.delete(
      '/v1/pipelines/:id/dependencies',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'delete' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const params = request.params as { id: string };

          const deleted = await dependencyCoordinationService.unregisterDependency(params.id);

          if (!deleted) {
            return handleError(reply, new NotFoundError('NOT_FOUND'))
          }

          return reply.send({
            message: 'Dependency unregistered successfully',
            pipelineId: params.id,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== GET /api/v1/pipelines/dependencies/graph ====================
    // 获取完整依赖图
    instance.get(
      '/v1/pipelines/dependencies/graph',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const graph = await dependencyCoordinationService.getDependencyGraph();

          return reply.send(graph);
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== POST /api/v1/pipelines/dependencies/resolve/:id ====================
    // 解析指定pipeline的依赖状态
    instance.post(
      '/v1/pipelines/dependencies/resolve/:id',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'execute' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const params = request.params as { id: string };
          const body = request.body as {
            pipelineResults: Record<string, { status: string; outputs: Record<string, unknown> }>;
          };

          if (!body?.pipelineResults) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          const pipelineResultsMap = new Map<string, PipelineResult>(
            Object.entries(body.pipelineResults)
          );

          const resolution = await dependencyCoordinationService.resolveDependencies(
            params.id,
            pipelineResultsMap
          );

          return reply.send(resolution);
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== GET /api/v1/pipelines/dependencies/cycles ====================
    // 检测循环依赖
    instance.get(
      '/v1/pipelines/dependencies/cycles',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const cycles = await dependencyCoordinationService.findCycles();

          return reply.send({
            hasCycles: cycles.length > 0,
            cycles,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== GET /api/v1/pipelines/dependencies/topological ====================
    // 获取拓扑排序顺序
    instance.get(
      '/v1/pipelines/dependencies/topological',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const order = await dependencyCoordinationService.getTopologicalOrder();

          return reply.send({
            order,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== POST /api/v1/pipelines/dependencies/resolve-all ====================
    // 批量解析所有依赖
    instance.post(
      '/v1/pipelines/dependencies/resolve-all',
      { onRequest: [requirePermission({ resource: 'dependency', action: 'execute' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as {
            pipelineResults: Record<string, { status: string; outputs: Record<string, unknown> }>;
          };

          if (!body?.pipelineResults) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          const pipelineResultsMap = new Map<string, PipelineResult>(
            Object.entries(body.pipelineResults)
          );

          const results = await dependencyCoordinationService.resolveAllDependencies(pipelineResultsMap);

          // Convert Map to plain object for JSON serialization
          const resultsObj: Record<string, any> = {};
          for (const [key, value] of results) {
            resultsObj[key] = value;
          }

          return reply.send({
            resolutions: resultsObj,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );
  });
}