/**
 * MCP Server Tests
 *
 * Tests for JSON-RPC protocol handling and MCP functionality.
 */

import { McpServer } from '../McpServer';
import { mcpConfig, McpContext, JsonRpcRequest, McpTool, McpResource } from '../mcp-config';

// Mock context for testing
const mockContext: McpContext = {
  userId: 'test-user',
  tenantId: 'test-tenant',
  roles: ['admin'],
  services: {},
};

// Mock tool for testing
const mockTool: McpTool = {
  name: 'test_tool',
  description: 'A test tool',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Test message' },
    },
    required: ['message'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext) => {
    const message = params.message as string;
    return {
      content: [{ type: 'text', text: `Received: ${message}` }],
    };
  },
};

// Mock resource for testing
const mockResource: McpResource = {
  uri: 'test://resource',
  name: 'Test Resource',
  description: 'A test resource',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext) => {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ test: 'data' }),
      }],
    };
  },
};

describe('McpServer', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer(mockContext, mcpConfig);
    server.registerTool(mockTool);
    server.registerResource(mockResource);
  });

  // ==================== Initialize Tests ====================

  describe('initialize', () => {
    it('should return server capabilities on initialize request', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('init-1');
      expect(response.result).toBeDefined();
      expect(response.result).toMatchObject({
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'orion-devops',
          version: '1.0.0',
        },
      });
    });

    it('should report tools capability when enabled', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'init-2',
        method: 'initialize',
      };

      const response = await server.handleRequest(request);

      expect(response.result?.capabilities?.tools).toBeDefined();
    });
  });

  // ==================== JSON-RPC Protocol Tests ====================

  describe('JSON-RPC Protocol', () => {
    it('should reject invalid JSON-RPC version', async () => {
      const request = {
        jsonrpc: '1.0',
        id: 'test-1',
        method: 'ping',
      };

      const response = await server.handleRequest(request as JsonRpcRequest);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid request
    });

    it('should return error for unknown method', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'test-2',
        method: 'unknown_method',
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
    });

    it('should respond to ping', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'ping-1',
        method: 'ping',
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({});
    });
  });

  // ==================== Tools Tests ====================

  describe('tools/list', () => {
    it('should return list of registered tools', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'tools-1',
        method: 'tools/list',
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.tools).toBeInstanceOf(Array);
      expect(response.result?.tools[0].name).toBe('test_tool');
    });

    it('should include tool input schema', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'tools-2',
        method: 'tools/list',
      };

      const response = await server.handleRequest(request);

      expect(response.result?.tools[0].inputSchema).toBeDefined();
      expect(response.result?.tools[0].inputSchema.type).toBe('object');
    });
  });

  describe('tools/call', () => {
    it('should execute tool and return result', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'call-1',
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { message: 'Hello MCP' },
        },
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.content).toBeInstanceOf(Array);
      expect(response.result?.content[0].text).toContain('Hello MCP');
    });

    it('should return error when tool name missing', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'call-2',
        method: 'tools/call',
        params: {
          arguments: { message: 'test' },
        },
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should return error when tool not found', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'call-3',
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle tool execution errors gracefully', async () => {
      const errorTool: McpTool = {
        name: 'error_tool',
        description: 'Tool that throws error',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          throw new Error('Tool execution failed');
        },
      };

      server.registerTool(errorTool);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'call-4',
        method: 'tools/call',
        params: {
          name: 'error_tool',
          arguments: {},
        },
      };

      const response = await server.handleRequest(request);

      expect(response.result?.isError).toBe(true);
      expect(response.result?.content[0].text).toContain('Error: Tool execution failed');
    });
  });

  // ==================== Resources Tests ====================

  describe('resources/list', () => {
    it('should return list of registered resources', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'res-1',
        method: 'resources/list',
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.resources).toBeInstanceOf(Array);
      expect(response.result?.resources[0].uri).toBe('test://resource');
    });

    it('should include resource metadata', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'res-2',
        method: 'resources/list',
      };

      const response = await server.handleRequest(request);

      expect(response.result?.resources[0].name).toBe('Test Resource');
      expect(response.result?.resources[0].mimeType).toBe('application/json');
    });
  });

  describe('resources/read', () => {
    it('should return resource content', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'read-1',
        method: 'resources/read',
        params: {
          uri: 'test://resource',
        },
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.contents).toBeInstanceOf(Array);
      expect(response.result?.contents[0].uri).toBe('test://resource');
      expect(response.result?.contents[0].text).toContain('test');
    });

    it('should return error when URI missing', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'read-2',
        method: 'resources/read',
        params: {},
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });

    it('should return error when resource not found', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'read-3',
        method: 'resources/read',
        params: {
          uri: 'nonexistent://resource',
        },
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ==================== Resource Templates Tests ====================

  describe('resources/templates/list', () => {
    it('should return empty templates list when none registered', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'templates-1',
        method: 'resources/templates/list',
      };

      const response = await server.handleRequest(request);

      expect(response.result?.templates).toBeInstanceOf(Array);
      expect(response.result?.templates.length).toBe(0);
    });
  });

  // ==================== Server Info Tests ====================

  describe('getServerInfo', () => {
    it('should return server configuration', () => {
      const info = server.getServerInfo();

      expect(info.name).toBe('orion-devops');
      expect(info.version).toBe('1.0.0');
      expect(info.capabilities).toBeDefined();
    });
  });

  describe('getTools', () => {
    it('should return array of registered tools', () => {
      const tools = server.getTools();

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBe('test_tool');
    });
  });

  describe('getResources', () => {
    it('should return array of registered resources', () => {
      const resources = server.getResources();

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].uri).toBe('test://resource');
    });
  });
});