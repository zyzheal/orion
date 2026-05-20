/**
 * Workflow Dependency Analysis API Routes
 * 工作流依赖分析 REST API 路由
 *
 * Prefix: /v1/workflow-dependencies (handled by register)
 *
 * Endpoints:
 * - GET /v1/workflow-dependencies/graph - 获取依赖图和循环检测结果
 * - GET /v1/workflow-dependencies/check/:definitionId - 检查单个工作流的循环依赖
 * - GET /v1/workflow-dependencies/visualization - 获取可视化数据
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkflowDependencyAnalyzer } from '../services/lowcode/WorkflowDependencyAnalyzer';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

/**
 * 路由选项接口
 */
interface WorkflowDependencyRoutesOptions {
  dependencyAnalyzer?: WorkflowDependencyAnalyzer;
}

/**
 * 检查参数
 */
interface CheckParams {
  definitionId: string;
}

/**
 * 默认导出函数
 */
export default async function workflowDependencyRoutes(
  app: FastifyInstance,
  options: WorkflowDependencyRoutesOptions
): Promise<void> {
  const analyzer = options.dependencyAnalyzer || new WorkflowDependencyAnalyzer();

  // ==================== GET /v1/workflow-dependencies/graph - 依赖图 ====================
  app.get(
    '/graph',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const result = await analyzer.analyze();

        return reply.send({
          success: true,
          data: {
            isSafe: result.isSafe,
            totalDefinitions: result.totalDefinitions,
            totalEdges: result.totalEdges,
            cycles: result.cycles,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== GET /v1/workflow-dependencies/check/:definitionId - 检查单个定义 ====================
  app.get<{ Params: CheckParams }>(
    '/check/:definitionId',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: CheckParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { definitionId } = request.params;
        const result = await analyzer.checkDefinition(definitionId);

        return reply.send({
          success: true,
          data: {
            definitionId,
            isSafe: result.isSafe,
            dependencies: result.dependencies,
            cycles: result.cycles,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== GET /v1/workflow-dependencies/visualization - 可视化数据 ====================
  app.get(
    '/visualization',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const vizData = await analyzer.getVisualizationData();

        return reply.send({
          success: true,
          data: vizData,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );
}
