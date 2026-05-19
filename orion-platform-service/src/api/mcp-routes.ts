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
import { RedisCache } from '../services/redis-cache';
import { CacheService } from '../services/cache/CacheService';
import { McpServer } from '../mcp/McpServer';
import { mcpConfig, McpContext, JsonRpcRequest } from '../mcp/mcp-config';
import { allTools } from '../mcp/tools';
import { allResources } from '../mcp/resources';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { AuditRepository } from '../services/audit/AuditRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface McpRoutesOptions {
  database?: DatabasePool;
  redis?: RedisCache;
}

// 扩展 request.user 类型以包含 tenantId
interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
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
 * Authentication middleware for MCP routes
 * Returns auth info if authenticated, sends 401 response and returns null if not
 */
async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  auditRepository?: AuditRepository
): Promise<{ userId: string; tenantId: string } | null> {
  // Check API key first
  const apiKeyAuth = validateApiKey(request);
  if (apiKeyAuth) {
    return apiKeyAuth;
  }

  // Check JWT auth（扩展类型以支持 tenantId）
  const user = request.user as AuthenticatedUser | undefined;
  if (user) {
    return {
      userId: user.userId,
      tenantId: user.tenantId || 'default-tenant',
    };
  }

  // Authentication failed - log and return error
  const clientIp = request.ip;
  const userAgent = request.headers['user-agent'] || 'unknown';

  logger.warn({
    msg: 'MCP authentication failed',
    path: request.url,
    method: request.method,
    clientIp,
    userAgent,
    hasApiKey: !!request.headers['x-api-key'],
    hasJwt: !!request.user,
  });

  // Record audit log for failed auth
  if (auditRepository) {
    try {
      await auditRepository.create({
        tenant_id: 'system',
        user_id: 'anonymous',
        action: 'mcp:auth_failed',
        resource_type: 'mcp_endpoint',
        resource_id: request.url,
        request_body: {
          method: request.method,
          clientIp,
          userAgent,
        },
      });
    } catch (error) {
      logger.error({ msg: 'Failed to record auth audit log', error });
    }
  }

  reply.status(401).send({
    error: 'Authentication required',
    message: 'Provide x-api-key header or valid JWT token',
  });

  return null;
}

/**
 * Build MCP context from request
 */
function buildMcpContext(request: FastifyRequest, database?: DatabasePool, redis?: RedisCache): McpContext {
  const auth = validateApiKey(request);
  const user = request.user as AuthenticatedUser | undefined;

  // Initialize services for context
  const pipelineRepository = database ? new PipelineRepository(database) : null;
  const pipelineCache = redis ? new CacheService(redis, 60) : null;
  const pipelineService = pipelineRepository ? new PipelineService(pipelineRepository, pipelineCache || undefined) : undefined;

  return {
    userId: auth?.userId || user?.userId,
    tenantId: auth?.tenantId || user?.tenantId || 'default-tenant',
    roles: user?.role ? [user.role] : [],
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
  // Initialize audit repository for auth failure logging
  const auditRepository = options.database ? new AuditRepository(options.database) : undefined;

  // Initialize MCP Server with context
  const createContext = (request: FastifyRequest) => buildMcpContext(request, options.database, options.redis);

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
  app.post('/mcp', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mcp', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate authentication using middleware
    const auth = await requireAuth(request, reply, auditRepository);
    if (!auth) {
      return reply; // requireAuth already sent 401 response
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
  app.get('/mcp/sse', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mcp', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate authentication using middleware
    const auth = await requireAuth(request, reply, auditRepository);
    if (!auth) {
      return reply; // requireAuth already sent 401 response
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
   * Requires authentication
   */
  app.get('/mcp/tools', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mcp', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate authentication
    const auth = await requireAuth(request, reply, auditRepository);
    if (!auth) {
      return reply;
    }

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
   * Requires authentication
   */
  app.get('/mcp/resources', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mcp', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate authentication
    const auth = await requireAuth(request, reply, auditRepository);
    if (!auth) {
      return reply;
    }

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
   * Public endpoint - no authentication required
   */
  app.get('/mcp/info', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mcp', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      server: mcpConfig,
      protocolVersion: '2024-11-05',
      documentation: '/docs/mcp',
      authRequired: mcpConfig.authentication.required,
    });
  });

  console.log('[McpRoutes] MCP routes registered with authentication middleware');
}