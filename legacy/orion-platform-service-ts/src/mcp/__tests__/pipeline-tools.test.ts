/**
 * Pipeline Tools Tests
 *
 * Tests for MCP Pipeline tools functionality.
 */

import { pipelineTools, pipelineTriggerTool, pipelineStatusTool, pipelineCancelTool, pipelineLogsTool } from '../tools/pipeline-tools';
import { McpContext, McpToolResult } from '../mcp-config';

// Mock context
const mockContext: McpContext = {
  userId: 'test-user',
  tenantId: 'test-tenant',
  roles: ['admin'],
  services: {},
};

describe('Pipeline Tools', () => {
  describe('Tool Registration', () => {
    it('should export all 4 pipeline tools', () => {
      expect(pipelineTools.length).toBe(4);
      expect(pipelineTools.map(t => t.name)).toEqual([
        'pipeline_trigger',
        'pipeline_status',
        'pipeline_cancel',
        'pipeline_logs',
      ]);
    });

    it('should have valid input schemas', () => {
      for (const tool of pipelineTools) {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have required parameters defined', () => {
      expect(pipelineTriggerTool.inputSchema.required).toContain('pipeline_id');
      expect(pipelineStatusTool.inputSchema.required).toContain('run_id');
      expect(pipelineCancelTool.inputSchema.required).toContain('run_id');
      expect(pipelineLogsTool.inputSchema.required).toContain('run_id');
    });
  });

  describe('pipeline_trigger', () => {
    it('should return error when pipeline service not available', async () => {
      const result = await pipelineTriggerTool.handler(
        { pipeline_id: 'pipe-001' },
        mockContext
      ) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Pipeline service not available');
    });

    it('should validate required parameters', () => {
      const schema = pipelineTriggerTool.inputSchema;

      expect(schema.properties.pipeline_id).toBeDefined();
      expect(schema.properties.pipeline_id.type).toBe('string');
      expect(schema.properties.branch).toBeDefined();
      expect(schema.properties.environment?.enum).toEqual(['dev', 'staging', 'prod']);
    });
  });

  describe('pipeline_status', () => {
    it('should return status information', async () => {
      const result = await pipelineStatusTool.handler(
        { run_id: 'run-001' },
        mockContext
      ) as McpToolResult;

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text!);

      expect(data.run_id).toBe('run-001');
      expect(data.status).toBeDefined();
      expect(data.stages).toBeInstanceOf(Array);
    });

    it('should include logs when requested', async () => {
      const result = await pipelineStatusTool.handler(
        { run_id: 'run-001', include_logs: true },
        mockContext
      ) as McpToolResult;

      const data = JSON.parse(result.content[0].text!);

      expect(data.logs).toBeDefined();
    });
  });

  describe('pipeline_cancel', () => {
    it('should return cancellation result', async () => {
      const result = await pipelineCancelTool.handler(
        { run_id: 'run-001', reason: 'User request' },
        mockContext
      ) as McpToolResult;

      const data = JSON.parse(result.content[0].text!);

      expect(data.success).toBe(true);
      expect(data.status).toBe('cancelled');
      expect(data.reason).toBe('User request');
    });
  });

  describe('pipeline_logs', () => {
    it('should return logs for a run', async () => {
      const result = await pipelineLogsTool.handler(
        { run_id: 'run-001' },
        mockContext
      ) as McpToolResult;

      const data = JSON.parse(result.content[0].text!);

      expect(data.run_id).toBe('run-001');
      expect(data.logs).toBeInstanceOf(Array);
    });

    it('should support filtering by stage', async () => {
      const result = await pipelineLogsTool.handler(
        { run_id: 'run-001', stage_name: 'Build' },
        mockContext
      ) as McpToolResult;

      const data = JSON.parse(result.content[0].text!);

      expect(data.stage).toBe('Build');
    });

    it('should respect tail limit', async () => {
      const result = await pipelineLogsTool.handler(
        { run_id: 'run-001', tail: 50 },
        mockContext
      ) as McpToolResult;

      const data = JSON.parse(result.content[0].text!);

      expect(data.logs.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Descriptions', () => {
    it('should have meaningful descriptions', () => {
      for (const tool of pipelineTools) {
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });
  });
});