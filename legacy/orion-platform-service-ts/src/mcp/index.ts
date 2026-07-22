/**
 * MCP Module Index - Export all MCP components
 *
 * This file provides the main entry point for the MCP (Model Context Protocol)
 * implementation, enabling AI assistants to interact with Orion DevOps platform.
 */

// Core components
export { McpServer } from './McpServer';
export { mcpConfig } from './mcp-config';
export type {
  McpConfig,
  McpContext,
  McpTool,
  McpResource,
  McpResourceTemplate,
  McpToolResult,
  McpResourceContent,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
} from './mcp-config';

// Tools
export { allTools, getToolsByCategory, getToolByName, listToolNames } from './tools';
export { pipelineTools } from './tools/pipeline-tools';
export { deploymentTools } from './tools/deployment-tools';
export { ticketTools } from './tools/ticket-tools';
export { diagnosticTools } from './tools/diagnostic-tools';
export { finopsTools } from './tools/finops-tools';

// Resources
export { allResources, staticResources, resourceTemplates } from './resources';