/**
 * Tool Adapter - AI 到业务服务的适配器
 *
 * 功能：
 * 1. 工具注册与管理
 * 2. 预置工具 (pipeline, deploy, monitoring, git, log_query)
 * 3. 统一的工具执行接口
 */

import { createLogger } from '../utils/logger';
import {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  BuiltInToolName,
  AgentExecutionContext,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Tool Adapter 核心类
 *
 * 负责：
 * 1. 注册和管理工具
 * 2. 执行工具并返回结果
 * 3. 提供预置工具
 */
export class ToolAdapter {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * 注册工具
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn({ msg: 'Tool already exists, overwriting', toolName: tool.name });
    }
    this.tools.set(tool.name, tool);
    logger.info({ msg: 'Tool registered', toolName: tool.name });
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 获取工具定义
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context: AgentExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found`,
      };
    }

    const startTime = Date.now();
    try {
      logger.debug({
        msg: 'Executing tool',
        toolName,
        userId: context.userId,
        traceId: context.traceId,
      });

      const result = await tool.handler(params, context);

      logger.debug({
        msg: 'Tool executed',
        toolName,
        durationMs: Date.now() - startTime,
        success: result.success,
      });

      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        msg: 'Tool execution failed',
        toolName,
        error: errorMessage,
        traceId: context.traceId,
      });

      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查工具是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 移除工具
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  // ==================== 预置工具实现 ====================

  /**
   * 注册所有预置工具
   */
  private registerBuiltInTools(): void {
    // Pipeline 工具
    this.registerTool({
      name: 'pipeline',
      description: '流水线操作工具 - 用于查询、创建、更新和执行流水线',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete', 'run', 'stop'] },
          pipelineId: { type: 'string' },
          pipelineName: { type: 'string' },
          params: { type: 'object' },
        },
        required: ['action'],
      },
      handler: this.createPipelineHandler(),
    });

    // Deploy 工具
    this.registerTool({
      name: 'deploy',
      description: '部署操作工具 - 用于查询部署状态、执行部署和回滚',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'get', 'deploy', 'rollback', 'status'] },
          deploymentId: { type: 'string' },
          environment: { type: 'string' },
          version: { type: 'string' },
          params: { type: 'object' },
        },
        required: ['action'],
      },
      handler: this.createDeployHandler(),
    });

    // Monitoring 工具
    this.registerTool({
      name: 'monitoring',
      description: '监控查询工具 - 用于查询指标、告警和系统状态',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['metrics', 'alerts', 'status', 'history'] },
          metricType: { type: 'string' },
          timeRange: { type: 'string' },
          filters: { type: 'object' },
        },
        required: ['action'],
      },
      handler: this.createMonitoringHandler(),
    });

    // Git 工具
    this.registerTool({
      name: 'git',
      description: 'Git 操作工具 - 用于查询提交历史、分支和代码差异',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['commits', 'branches', 'diff', 'blame', 'tags'] },
          repo: { type: 'string' },
          branch: { type: 'string' },
          commitHash: { type: 'string' },
          path: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['action'],
      },
      handler: this.createGitHandler(),
    });

    // Log Query 工具
    this.registerTool({
      name: 'log_query',
      description: '日志查询工具 - 用于查询和分析应用日志',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['query', 'search', 'aggregate'] },
          query: { type: 'string' },
          timeRange: { type: 'string' },
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          service: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['action'],
      },
      handler: this.createLogQueryHandler(),
    });

    logger.info({ msg: 'Built-in tools registered', count: this.getToolNames().length });
  }

  /**
   * 创建 Pipeline 工具处理函数
   */
  private createPipelineHandler(): ToolHandler {
    return async (params: Record<string, unknown>, context: AgentExecutionContext) => {
      const { action, pipelineId, pipelineName, params: extraParams } = params;

      try {
        // TODO: 实际调用 PipelineService
        // 这里先返回模拟数据，后续对接真实服务
        switch (action) {
          case 'list':
            return {
              success: true,
              data: {
                pipelines: [],
                total: 0,
                message: 'Pipeline list retrieved',
              },
            };
          case 'get':
            return {
              success: true,
              data: {
                pipelineId,
                status: 'active',
                message: 'Pipeline details retrieved',
              },
            };
          case 'run':
            return {
              success: true,
              data: {
                runId: `run-${Date.now()}`,
                status: 'triggered',
                message: 'Pipeline triggered',
              },
            };
          default:
            return {
              success: false,
              error: `Unsupported action: ${action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
  }

  /**
   * 创建 Deploy 工具处理函数
   */
  private createDeployHandler(): ToolHandler {
    return async (params: Record<string, unknown>, context: AgentExecutionContext) => {
      const { action, deploymentId, environment, version } = params;

      try {
        switch (action) {
          case 'list':
            return {
              success: true,
              data: {
                deployments: [],
                total: 0,
              },
            };
          case 'status':
            return {
              success: true,
              data: {
                deploymentId,
                status: 'running',
                environment,
              },
            };
          case 'deploy':
            return {
              success: true,
              data: {
                deploymentId: `deploy-${Date.now()}`,
                status: 'deployed',
                environment,
                version,
              },
            };
          case 'rollback':
            return {
              success: true,
              data: {
                deploymentId,
                status: 'rolled_back',
                message: 'Rollback initiated',
              },
            };
          default:
            return {
              success: false,
              error: `Unsupported action: ${action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
  }

  /**
   * 创建 Monitoring 工具处理函数
   */
  private createMonitoringHandler(): ToolHandler {
    return async (params: Record<string, unknown>, context: AgentExecutionContext) => {
      const { action, metricType, timeRange, filters } = params;

      try {
        switch (action) {
          case 'metrics':
            return {
              success: true,
              data: {
                metrics: [],
                metricType,
                timeRange,
                message: 'Metrics retrieved',
              },
            };
          case 'alerts':
            return {
              success: true,
              data: {
                alerts: [],
                total: 0,
              },
            };
          case 'status':
            return {
              success: true,
              data: {
                systemStatus: 'healthy',
                components: [],
              },
            };
          default:
            return {
              success: false,
              error: `Unsupported action: ${action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
  }

  /**
   * 创建 Git 工具处理函数
   */
  private createGitHandler(): ToolHandler {
    return async (params: Record<string, unknown>, context: AgentExecutionContext) => {
      const { action, repo, branch, commitHash, path, count } = params;

      try {
        switch (action) {
          case 'commits':
            return {
              success: true,
              data: {
                commits: [],
                repo,
                branch,
                count: count || 10,
              },
            };
          case 'branches':
            return {
              success: true,
              data: {
                branches: [],
                repo,
              },
            };
          case 'diff':
            return {
              success: true,
              data: {
                diff: '',
                from: commitHash,
                to: branch,
                message: 'Diff retrieved',
              },
            };
          default:
            return {
              success: false,
              error: `Unsupported action: ${action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
  }

  /**
   * 创建 Log Query 工具处理函数
   */
  private createLogQueryHandler(): ToolHandler {
    return async (params: Record<string, unknown>, context: AgentExecutionContext) => {
      const { action, query, timeRange, level, service, limit } = params;

      try {
        switch (action) {
          case 'query':
            return {
              success: true,
              data: {
                logs: [],
                total: 0,
                query,
                timeRange,
              },
            };
          case 'search':
            return {
              success: true,
              data: {
                logs: [],
                matched: 0,
                query,
                level,
                service,
              },
            };
          case 'aggregate':
            return {
              success: true,
              data: {
                aggregation: {},
                query,
                timeRange,
                message: 'Aggregation completed',
              },
            };
          default:
            return {
              success: false,
              error: `Unsupported action: ${action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
  }
}