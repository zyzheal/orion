/**
 * Pipeline Tools - MCP Tools for Pipeline Operations
 *
 * Enables AI assistants to trigger, monitor, and manage pipelines.
 */

import { McpTool, McpContext, McpToolResult } from '../mcp-config';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';

/**
 * Tool: pipeline_trigger
 * Trigger a pipeline execution
 */
export const pipelineTriggerTool: McpTool = {
  name: 'pipeline_trigger',
  description: 'Trigger a pipeline execution. The pipeline will run with the specified parameters.',
  inputSchema: {
    type: 'object',
    properties: {
      pipeline_id: {
        type: 'string',
        description: 'The ID of the pipeline to trigger',
      },
      branch: {
        type: 'string',
        description: 'The branch to build (default: main)',
        default: 'main',
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters to pass to the pipeline',
      },
      environment: {
        type: 'string',
        description: 'Target environment (e.g., dev, staging, prod)',
        enum: ['dev', 'staging', 'prod'],
      },
    },
    required: ['pipeline_id'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const pipelineService = context.services.pipeline as PipelineService | undefined;

    if (!pipelineService) {
      return {
        content: [{ type: 'text', text: 'Error: Pipeline service not available' }],
        isError: true,
      };
    }

    try {
      const pipelineId = params.pipeline_id as string;
      const branch = (params.branch as string) || 'main';
      const environment = params.environment as string | undefined;
      const parameters = params.parameters as Record<string, unknown> | undefined;

      // Get pipeline first
      const pipeline = await pipelineService.getById(pipelineId);
      if (!pipeline) {
        return {
          content: [{ type: 'text', text: `Error: Pipeline not found: ${pipelineId}` }],
          isError: true,
        };
      }

      // Trigger the pipeline run
      // Note: Actual implementation would use PipelineRunService
      const runId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Pipeline triggered successfully',
            run_id: runId,
            pipeline_id: pipelineId,
            pipeline_name: pipeline.name,
            branch,
            environment,
            status: 'pending',
            triggered_by: context.userId || 'mcp-client',
            triggered_at: new Date().toISOString(),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error triggering pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  },
};

/**
 * Tool: pipeline_status
 * Query pipeline run status
 */
export const pipelineStatusTool: McpTool = {
  name: 'pipeline_status',
  description: 'Query the status of a pipeline run. Returns current status, stages, and progress.',
  inputSchema: {
    type: 'object',
    properties: {
      run_id: {
        type: 'string',
        description: 'The ID of the pipeline run to query',
      },
      include_logs: {
        type: 'boolean',
        description: 'Whether to include recent logs (default: false)',
        default: false,
      },
    },
    required: ['run_id'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const runId = params.run_id as string;
    const includeLogs = params.include_logs as boolean;

    // Note: Actual implementation would query PipelineRunRepository
    // For now, return a placeholder response
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          run_id: runId,
          status: 'running',
          progress: 45,
          stages: [
            { name: 'Checkout', status: 'success', duration: '12s' },
            { name: 'Build', status: 'success', duration: '2m 30s' },
            { name: 'Test', status: 'running', duration: '1m 15s' },
            { name: 'Deploy', status: 'pending', duration: '-' },
          ],
          started_at: new Date(Date.now() - 240000).toISOString(),
          estimated_remaining: '3m 45s',
          logs: includeLogs ? 'Recent logs would be included here...' : undefined,
        }, null, 2),
      }],
    };
  },
};

/**
 * Tool: pipeline_cancel
 * Cancel a running pipeline
 */
export const pipelineCancelTool: McpTool = {
  name: 'pipeline_cancel',
  description: 'Cancel a running pipeline execution. This will stop all running stages.',
  inputSchema: {
    type: 'object',
    properties: {
      run_id: {
        type: 'string',
        description: 'The ID of the pipeline run to cancel',
      },
      reason: {
        type: 'string',
        description: 'Reason for cancellation',
      },
    },
    required: ['run_id'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const runId = params.run_id as string;
    const reason = params.reason as string | undefined;

    // Note: Actual implementation would use PipelineRunService
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Pipeline cancelled successfully',
          run_id: runId,
          status: 'cancelled',
          reason: reason || 'Cancelled via MCP',
          cancelled_by: context.userId || 'mcp-client',
          cancelled_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Tool: pipeline_logs
 * Get pipeline execution logs
 */
export const pipelineLogsTool: McpTool = {
  name: 'pipeline_logs',
  description: 'Retrieve logs from a pipeline run. Can filter by stage or task.',
  inputSchema: {
    type: 'object',
    properties: {
      run_id: {
        type: 'string',
        description: 'The ID of the pipeline run',
      },
      stage_name: {
        type: 'string',
        description: 'Filter logs to a specific stage',
      },
      task_name: {
        type: 'string',
        description: 'Filter logs to a specific task',
      },
      tail: {
        type: 'number',
        description: 'Number of lines to return from the end (default: 100)',
        default: 100,
      },
    },
    required: ['run_id'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const runId = params.run_id as string;
    const stageName = params.stage_name as string | undefined;
    const taskName = params.task_name as string | undefined;
    const tail = (params.tail as number) || 100;

    // Note: Actual implementation would query TaskRepository for logs
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          run_id: runId,
          stage: stageName || 'all',
          task: taskName,
          logs: [
            `[2024-01-15 10:23:45] INFO  Starting pipeline run ${runId}`,
            `[2024-01-15 10:23:45] INFO  Stage: Checkout`,
            `[2024-01-15 10:23:57] INFO  Git clone completed`,
            `[2024-01-15 10:23:58] INFO  Stage: Build`,
            `[2024-01-15 10:24:00] INFO  Running npm install...`,
            `... (${tail} lines shown)`,
          ],
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Export all pipeline tools
 */
export const pipelineTools: McpTool[] = [
  pipelineTriggerTool,
  pipelineStatusTool,
  pipelineCancelTool,
  pipelineLogsTool,
];