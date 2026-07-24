/**
 * MCP Tools Index - Export all available tools
 *
 * This file exports all MCP tools that can be used by AI assistants
 * to interact with Orion DevOps platform.
 */

import { McpTool } from '../mcp-config';
import { pipelineTools } from './pipeline-tools';
import { deploymentTools } from './deployment-tools';
import { ticketTools } from './ticket-tools';
import { diagnosticTools } from './diagnostic-tools';
import { finopsTools } from './finops-tools';

/**
 * All available MCP tools
 */
export const allTools: McpTool[] = [
  ...pipelineTools,
  ...deploymentTools,
  ...ticketTools,
  ...diagnosticTools,
  ...finopsTools,
];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): McpTool[] {
  switch (category) {
    case 'pipeline':
      return pipelineTools;
    case 'deployment':
      return deploymentTools;
    case 'ticket':
      return ticketTools;
    case 'diagnostic':
      return diagnosticTools;
    case 'finops':
      return finopsTools;
    default:
      return [];
  }
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): McpTool | undefined {
  return allTools.find(tool => tool.name === name);
}

/**
 * List all available tool names
 */
export function listToolNames(): string[] {
  return allTools.map(tool => tool.name);
}

/**
 * Export individual tool modules for direct access
 */
export {
  pipelineTools,
  deploymentTools,
  ticketTools,
  diagnosticTools,
  finopsTools,
};