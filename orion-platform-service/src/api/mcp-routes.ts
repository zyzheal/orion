/**
 * MCP API Routes - HTTP endpoints for MCP Server
 *
 * Provides HTTP endpoints for MCP protocol:
 * - POST /api/v1/mcp - JSON-RPC endpoint
 * - GET /api/v1/mcp/sse - SSE connection endpoint
 * - GET /api/v1/mcp/tools - Tools list (debug)
 * - GET /api/v1/mcp/resources - Resources list (debug)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { McpServer } from '../mcp/McpServer';
import { mcpConfig, McpContext, JsonRpcRequest } from '../mcp/mcp-config';
import { allTools } from '../mcp/tools';
import { allResources } from '../mcp/resources';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';

interface McpRoutesOptions {
  database?: DatabasePool;
}

// Store SSE connections
const sseConnections = new Map<string, { reply: FastifyReply; lastEventId: string }>();

/**
 * Validate API Key for MCP access
 */
function validateApiKey(request: FastifyRequest): { userId: string; tenantId: string } | null {
  // Check for API key in header or query
  const query = request.query as Record<string, string | undefined>;
  const apiKey = request.headers['x-api-key'] as string || query?.['api_key'];

  if (!apiKey) {
    return null;
  }

  // Note: Actual implementation would validate against APIKeyRepository
  // For now, accept any key and return default user
  if (apiKey.startsWith('orion-')) {
    return {
      userId: 'mcp-user',
      tenantId: 'default-tenant',
    };
  }

  return null;
}

/**
 * Build MCP context from request
 */
function buildMcpContext(request: FastifyRequest, database?: DatabasePool): McpContext {
  const auth = validateApiKey(request);

  // Initialize services for context
  const pipelineRepository = database ? new PipelineRepository(database) : null;
  const pipelineService = pipelineRepository ? new PipelineService(pipelineRepository) : undefined;

  return {
    userId: auth?.userId || request.user?.userId,
    tenantId: auth?.tenantId || 'default-tenant',
    roles: request.user?.role ? [request.user.role] : [],
    apiKey: request.headers['x-api-key'] as string,
    database,
    services: {
      pipeline: pipelineService,
    },
  };
}

export default async function mcpRoutes(
  app: FastifyInstance,
  options: McpRoutesOptions
): Promise<void> {
  // Initialize MCP Server with context
  const createContext = (request: FastifyRequest) => buildMcpContext(request, options.database);

  // Create a fresh server instance for each request
  const createServer = (context: McpContext) => {
    const server = new McpServer(context, mcpConfig);

    // Register all tools
    server.registerTools(allTools);

    // Register static resources
    for (const resource of allResources.static) {
      server.registerResource(resource);
    }

    // Register resource templates
    for (const template of allResources.templates) {
      server.registerResourceTemplate(template);
    }

    return server;
  };

  // ==================== Main JSON-RPC Endpoint ====================

  /**
   * POST /api/v1/mcp - JSON-RPC 2.0 endpoint
   * Handles all MCP protocol requests
   */
  app.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate authentication
    const auth = validateApiKey(request);
    if (mcpConfig.authentication.required && !auth) {
      // Also check JWT auth if API key not present
      if (!request.user) {
        return reply.status(401).send({
          error: 'Authentication required',
          message: 'Provide x-api-key header or valid JWT token',
        });
      }
    }

    const context = createContext(request);
    const server = createServer(context);

    // Parse request body
    const rpcRequest = request.body as JsonRpcRequest;

    // Validate JSON-RPC structure
    if (!rpcRequest.jsonrpc || rpcRequest.jsonrpc !== '2.0') {
      return reply.status(400).send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid request: jsonrpc version must be 2.0' },
      });
    }

    // Handle request
    const response = await server.handleRequest(rpcRequest);

    return reply.send(response);
  });

  // ==================== SSE Endpoint ====================

  /**
   * GET /api/v1/mcp/sse - SSE connection for real-time updates
   */
  app.get('/mcp/sse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate authentication
    const auth = validateApiKey(request);
    if (mcpConfig.authentication.required && !auth && !request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
      });
    }

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const connectionId = `sse-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const lastEventId = request.headers['last-event-id'] as string || '';

    // Store connection
    sseConnections.set(connectionId, { reply, lastEventId });

    console.log(`[McpRoutes] SSE connection established: ${connectionId}`);

    // Send initial server info
    reply.raw.write(`event: server-info\ndata: ${JSON.stringify(mcpConfig)}\n\n`);

    // Send periodic keepalive
    const keepaliveInterval = setInterval(() => {
      reply.raw.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 15000);

    // Handle connection close
    request.raw.on('close', () => {
      clearInterval(keepaliveInterval);
      sseConnections.delete(connectionId);
      console.log(`[McpRoutes] SSE connection closed: ${connectionId}`);
    });

    // Keep connection alive
    return reply;
  });

  // ==================== Debug Endpoints ====================

  /**
   * GET /api/v1/mcp/tools - List all available tools (debug)
   */
  app.get('/mcp/tools', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = createContext(request);
    const server = createServer(context);

    return reply.send({
      server: server.getServerInfo(),
      tools: server.getTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  });

  /**
   * GET /api/v1/mcp/resources - List all available resources (debug)
   */
  app.get('/mcp/resources', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = createContext(request);
    const server = createServer(context);

    const staticResources = server.getResources();
    // Note: Templates are not directly accessible via getResources()
    // We'll include them from the allResources export

    return reply.send({
      server: server.getServerInfo(),
      resources: staticResources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
      templates: allResources.templates.map(template => ({
        uriTemplate: template.uriTemplate,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
      })),
    });
  });

  /**
   * GET /api/v1/mcp/info - Server information
   */
  app.get('/mcp/info', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      server: mcpConfig,
      protocolVersion: '2024-11-05',
      documentation: '/docs/mcp',
    });
  });

  console.log('[McpRoutes] MCP routes registered');
}