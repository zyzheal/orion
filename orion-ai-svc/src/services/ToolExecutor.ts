// orion-ai-svc/src/services/ToolExecutor.ts

import { ToolRegistry } from './agent/ToolRegistry';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ToolExecutionRequest {
  tool: string;
  params: Record<string, unknown>;
  userId?: string;
  traceId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  result?: unknown;
  error?: string;
  executionTime: number;
}

export class ToolExecutor {
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const tool = this.toolRegistry.get(request.tool);
      if (!tool) {
        return {
          success: false,
          tool: request.tool,
          error: `Tool not found: ${request.tool}`,
          executionTime: Date.now() - startTime,
        };
      }

      if (tool.requiresApproval) {
        logger.warn({ tool: request.tool }, 'Tool requires approval, skipping for now');
        return {
          success: false,
          tool: request.tool,
          error: 'Tool requires approval, please get approval first',
          executionTime: Date.now() - startTime,
        };
      }

      const result = await tool.execute({
        params: request.params,
        userId: request.userId,
        traceId: request.traceId,
      });

      return {
        success: true,
        tool: request.tool,
        result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error, tool: request.tool }, 'Tool execution failed');
      return {
        success: false,
        tool: request.tool,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    }
  }

  async executeMultiple(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
    return Promise.all(requests.map((req) => this.execute(req)));
  }

  listAvailableTools(): string[] {
    return this.toolRegistry.list().map((t) => t.name);
  }
}
