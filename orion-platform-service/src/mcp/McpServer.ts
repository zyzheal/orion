/**
 * MCP Server - Model Context Protocol Implementation
 *
 * Implements JSON-RPC 2.0 protocol for AI assistants to interact
 * with Orion DevOps platform.
 *
 * @see https://modelcontextprotocol.io/specification
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('LMcp-LServer');
import {
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
  mcpConfig,
} from './mcp-config';

// Standard JSON-RPC error codes
const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
} as const;

export class McpServer {
  private config: McpConfig;
  private tools: Map<string, McpTool> = new Map();
  private resources: Map<string, McpResource> = new Map();
  private resourceTemplates: Map<string, McpResourceTemplate> = new Map();
  private context: McpContext;

  constructor(context: McpContext, config: McpConfig = mcpConfig) {
    this.config = config;
    this.context = context;
  }

  /**
   * Register a tool
   */
  registerTool(tool: McpTool): void {
    this.tools.set(tool.name, tool);
    logger.info(`[McpServer] Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: McpTool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Register a static resource
   */
  registerResource(resource: McpResource): void {
    this.resources.set(resource.uri, resource);
    logger.info(`[McpServer] Registered resource: ${resource.uri}`);
  }

  /**
   * Register a resource template (with URI pattern)
   */
  registerResourceTemplate(template: McpResourceTemplate): void {
    this.resourceTemplates.set(template.uriTemplate, template);
    logger.info(`[McpServer] Registered resource template: ${template.uriTemplate}`);
  }

  /**
   * Handle JSON-RPC request
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      // Validate JSON-RPC version
      if (request.jsonrpc !== '2.0') {
        return this.createErrorResponse(request.id, JSON_RPC_ERRORS.INVALID_REQUEST);
      }

      // Route to appropriate handler
      const [namespace, method] = this.parseMethod(request.method);

      switch (namespace) {
        case 'initialize':
          return this.handleInitialize(request);

        case 'tools':
          return await this.handleToolsMethod(method, request);

        case 'resources':
          return await this.handleResourcesMethod(method, request);

        case 'prompts':
          return this.handlePromptsMethod(request);

        case 'ping':
          return this.createSuccessResponse(request.id, {});

        default:
          return this.createErrorResponse(request.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND);
      }
    } catch (error) {
      logger.error('[McpServer] Error handling request:', error);
      return this.createErrorResponse(
        request.id,
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Parse method into namespace and method name
   */
  private parseMethod(method: string): [string, string] {
    const parts = method.split('/');
    if (parts.length === 1) {
      return [parts[0], ''];
    }
    return [parts[0], parts.slice(1).join('/')];
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    return this.createSuccessResponse(request.id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: this.config.capabilities.tools ? {} : undefined,
        resources: this.config.capabilities.resources ? {} : undefined,
        prompts: this.config.capabilities.prompts ? {} : undefined,
      },
      serverInfo: {
        name: this.config.serverName,
        version: this.config.serverVersion,
      },
    });
  }

  /**
   * Handle tools/* methods
   */
  private async handleToolsMethod(method: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    switch (method) {
      case 'list':
        return this.handleToolsList(request);

      case 'call':
        return await this.handleToolsCall(request);

      default:
        return this.createErrorResponse(request.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND);
    }
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return this.createSuccessResponse(request.id, { tools });
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;

    if (!params?.name) {
      return this.createErrorResponse(request.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Tool name is required');
    }

    const tool = this.tools.get(params.name);
    if (!tool) {
      return this.createErrorResponse(
        request.id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Tool not found: ${params.name}`
      );
    }

    try {
      const result = await tool.handler(params.arguments || {}, this.context);
      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createSuccessResponse(request.id, {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      } as McpToolResult);
    }
  }

  /**
   * Handle resources/* methods
   */
  private async handleResourcesMethod(method: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    switch (method) {
      case 'list':
        return this.handleResourcesList(request);

      case 'read':
        return await this.handleResourcesRead(request);

      case 'templates/list':
        return this.handleResourceTemplatesList(request);

      default:
        return this.createErrorResponse(request.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND);
    }
  }

  /**
   * Handle resources/list request
   */
  private handleResourcesList(request: JsonRpcRequest): JsonRpcResponse {
    const resources = Array.from(this.resources.values()).map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));

    return this.createSuccessResponse(request.id, { resources });
  }

  /**
   * Handle resources/read request
   */
  private async handleResourcesRead(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params as { uri?: string } | undefined;

    if (!params?.uri) {
      return this.createErrorResponse(request.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Resource URI is required');
    }

    const uri = params.uri;

    // Try static resource first
    const staticResource = this.resources.get(uri);
    if (staticResource) {
      try {
        const content = await staticResource.handler(uri, this.context);
        return this.createSuccessResponse(request.id, content);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return this.createErrorResponse(request.id, JSON_RPC_ERRORS.INTERNAL_ERROR, errorMessage);
      }
    }

    // Try resource templates
    for (const [pattern, template] of this.resourceTemplates) {
      const params = this.matchUriTemplate(pattern, uri);
      if (params) {
        try {
          const content = await template.handler(uri, params, this.context);
          return this.createSuccessResponse(request.id, content);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return this.createErrorResponse(request.id, JSON_RPC_ERRORS.INTERNAL_ERROR, errorMessage);
        }
      }
    }

    return this.createErrorResponse(
      request.id,
      JSON_RPC_ERRORS.INVALID_PARAMS,
      `Resource not found: ${uri}`
    );
  }

  /**
   * Handle resources/templates/list request
   */
  private handleResourceTemplatesList(request: JsonRpcRequest): JsonRpcResponse {
    const templates = Array.from(this.resourceTemplates.values()).map((template) => ({
      uriTemplate: template.uriTemplate,
      name: template.name,
      description: template.description,
      mimeType: template.mimeType,
    }));

    return this.createSuccessResponse(request.id, { templates });
  }

  /**
   * Handle prompts/* methods (not implemented yet)
   */
  private handlePromptsMethod(request: JsonRpcRequest): JsonRpcResponse {
    return this.createSuccessResponse(request.id, { prompts: [] });
  }

  /**
   * Match URI against template pattern
   * Example: "pipelines://{id}/runs" matches "pipelines://abc-123/runs"
   */
  private matchUriTemplate(pattern: string, uri: string): Record<string, string> | null {
    // Convert pattern to regex
    // Replace {param} with named capture groups
    const regexPattern = pattern.replace(/\{([^}]+)\}/g, '(?<$1>[^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);
    const match = uri.match(regex);

    if (match && match.groups) {
      return match.groups;
    }

    return null;
  }

  /**
   * Create success response
   */
  private createSuccessResponse(id: string | number | null, result: unknown): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number | null,
    error: { code: number; message: string },
    data?: unknown
  ): JsonRpcResponse {
    const jsonRpcError: JsonRpcError = {
      code: error.code,
      message: error.message,
    };

    if (data !== undefined) {
      jsonRpcError.data = data;
    }

    return {
      jsonrpc: '2.0',
      id,
      error: jsonRpcError,
    };
  }

  /**
   * Get server info for SSE endpoint
   */
  getServerInfo() {
    return {
      name: this.config.serverName,
      version: this.config.serverVersion,
      capabilities: this.config.capabilities,
    };
  }

  /**
   * Get all registered tools (for debugging)
   */
  getTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all registered resources (for debugging)
   */
  getResources(): McpResource[] {
    return Array.from(this.resources.values());
  }
}