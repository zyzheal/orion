import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Represents an environment configuration
 */
interface Environment {
  id: string;
  name: string;
  type: "development" | "staging" | "production" | "canary";
  tenantId: string;
  clusterUrl: string;
  namespace: string;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body for updating environment configuration
 */
interface UpdateEnvironmentConfigRequest {
  config: Record<string, unknown>;
  clusterUrl?: string;
  namespace?: string;
}

/**
 * Register environment routes
 */
export async function environmentRoutes(fastify: FastifyInstance): Promise<void> {
  // TODO: Inject EnvironmentService
  // const environmentService = new EnvironmentService();

  /**
   * GET /api/v1/environments
   * List all environments (optionally filtered by tenant)
   */
  fastify.get<{ Querystring: { tenantId?: string } }>(
    "/api/v1/environments",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { tenantId } = request.query;

      // TODO: Query database for environments
      // TODO: Filter by tenantId if provided
      // TODO: Return enriched environment details (active deployments count, etc.)

      reply.send({
        data: [] as Environment[],
        total: 0,
      });
    },
  );

  /**
   * GET /api/v1/environments/:id
   * Get a single environment by ID
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/environments/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { id } = request.params;

      // TODO: Fetch environment by id
      // TODO: Return 404 if not found

      reply.send({
        id,
        name: "TODO-fetch-from-db",
      });
    },
  );

  /**
   * POST /api/v1/environments/:id/config
   * Update environment configuration
   */
  fastify.post<{ Params: { id: string }; Body: UpdateEnvironmentConfigRequest }>(
    "/api/v1/environments/:id/config",
    {
      schema: {
        body: {
          type: "object",
          required: ["config"],
          properties: {
            config: { type: "object" },
            clusterUrl: { type: "string" },
            namespace: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateEnvironmentConfigRequest;
      }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { id } = request.params;
      const { config, clusterUrl, namespace } = request.body;

      // TODO: Validate environment exists
      // TODO: Validate config schema (check required fields)
      // TODO: Update environment configuration in database
      // TODO: Notify orion-monitor-svc if clusterUrl or namespace changed
      // TODO: Validate connectivity to new clusterUrl if changed

      reply.send({
        id,
        updated: true,
        updatedAt: new Date().toISOString(),
      });
    },
  );

  /**
   * POST /api/v1/environments
   * Create a new environment
   */
  fastify.post<{ Body: Omit<Environment, "id" | "createdAt" | "updatedAt"> }>(
    "/api/v1/environments",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "type", "tenantId", "clusterUrl", "namespace"],
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["development", "staging", "production", "canary"] },
            tenantId: { type: "string" },
            clusterUrl: { type: "string" },
            namespace: { type: "string" },
            config: { type: "object" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: Omit<Environment, "id" | "createdAt" | "updatedAt">;
      }>,
      reply: FastifyReply,
    ): Promise<void> => {
      // TODO: Validate tenant exists via orion-platform-core
      // TODO: Validate cluster connectivity
      // TODO: Create environment record in database

      reply.code(201).send({
        id: "TODO-generate-uuid",
        ...request.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  );
}
