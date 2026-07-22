/**
 * MCP Server Configuration
 *
 * Configuration for the Model Context Protocol server
 * that enables AI assistants to interact with Orion DevOps platform.
 */

export interface McpConfig {
  serverName: string;
  serverVersion: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
  authentication: {
    required: boolean;
    methods: ('api_key' | 'jwt')[];
  };
}

export const mcpConfig: McpConfig = {
  serverName: 'orion-devops',
  serverVersion: '1.0.0',
  capabilities: {
    tools: true,
    resources: true,
    prompts: false, // Not implemented yet
  },
  authentication: {
    required: true,
    methods: ['api_key', 'jwt'],
  },
};

/**
 * JSON-RPC 2.0 Types
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Tool Types
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
      items?: { type: string };
    }>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>, context: McpContext) => Promise<McpToolResult>;
}

export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      uri: string;
      mimeType?: string;
    };
  }>;
  isError?: boolean;
}

/**
 * MCP Resource Types
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: (uri: string, context: McpContext) => Promise<McpResourceContent>;
}

export interface McpResourceContent {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: (uri: string, params: Record<string, string>, context: McpContext) => Promise<McpResourceContent>;
}

/**
 * MCP Context - Passed to tool/resource handlers
 */
export interface McpContext {
  userId?: string;
  tenantId?: string;
  roles?: string[];
  apiKey?: string;
  database?: unknown; // DatabasePool
  services: {
    pipeline?: unknown;
    deployment?: unknown;
    ticket?: unknown;
    diagnostic?: unknown;
    finops?: unknown;
    project?: unknown;
  };
}