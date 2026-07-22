import { type FastifyInstance, type FastifyPluginOptions, type FastifySchema } from 'fastify';
import { z } from 'zod';
import { AgentStatus, AgentMetadata } from '../types/agent';
import { v4 as uuidv4 } from 'uuid';

/** Zod enum matching AgentStatus values for JSON Schema compatibility */
const AgentStatusEnum = z.enum([
  'registering',
  'idle',
  'busy',
  'draining',
  'dead',
  'stale',
]);

/**
 * In-memory agent store.
 * In production, this would be backed by PostgreSQL via AgentRepository.
 * Exported for cross-route validation (task dispatch checks agent status).
 */
export interface RegisteredAgent {
  id: string;
  name: string;
  status: AgentStatus;
  registeredAt: string;
  lastHeartbeat: string;
  currentTaskId: string | null;
  tasksCompleted: number;
  tasksFailed: number;
  metadata: AgentMetadata;
}

export const agentStore = new Map<string, RegisteredAgent>();

const registerBodySchema = z.object({
  name: z.string().min(1).max(128),
  metadata: z.object({
    host: z.string(),
    os: z.string(),
    arch: z.string(),
    capabilities: z.array(z.string()),
    version: z.string(),
    labels: z.record(z.string(), z.string()).optional(),
  }),
});

const heartbeatBodySchema = z.object({
  status: AgentStatusEnum.optional(),
  currentTaskId: z.string().nullable().optional(),
  metrics: z
    .object({
      cpuUsage: z.number().optional(),
      memoryUsage: z.number().optional(),
      activeTasks: z.number().optional(),
    })
    .optional(),
});

const agentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: AgentStatusEnum,
  lastHeartbeat: z.string(),
  metadata: z.object({
    host: z.string(),
    os: z.string(),
    arch: z.string(),
    capabilities: z.array(z.string()),
    version: z.string(),
  }),
});

export async function agentRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  /**
   * GET /api/v1/agents
   * List all registered agents with optional status filter
   */
  fastify.get(
    '/agents',
    {
      schema: {
        response: {
          200: z.array(agentResponseSchema),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const query = request.query as { status?: AgentStatus };
      let agents = Array.from(agentStore.values());

      if (query.status) {
        agents = agents.filter((a) => a.status === query.status);
      }

      return agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        lastHeartbeat: a.lastHeartbeat,
        metadata: {
          host: a.metadata.host,
          os: a.metadata.os,
          arch: a.metadata.arch,
          capabilities: a.metadata.capabilities,
          version: a.metadata.version,
        },
      }));
    },
  );

  /**
   * POST /api/v1/agents
   * Register a new agent
   */
  fastify.post(
    '/agents',
    {
      schema: {
        body: registerBodySchema,
        response: {
          201: agentResponseSchema.extend({
            registeredAt: z.string(),
          }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof registerBodySchema>;

      const agent: RegisteredAgent = {
        id: uuidv4(),
        name: body.name,
        status: AgentStatus.REGISTERING,
        registeredAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        currentTaskId: null,
        tasksCompleted: 0,
        tasksFailed: 0,
        metadata: body.metadata,
      };

      agentStore.set(agent.id, agent);

      fastify.log.info({ agentId: agent.id, name: agent.name }, 'Agent registered');

      return reply.code(201).send({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        registeredAt: agent.registeredAt,
        metadata: agent.metadata,
      });
    },
  );

  /**
   * GET /api/v1/agents/:id
   * Get agent details by ID
   */
  fastify.get(
    '/agents/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: agentResponseSchema.extend({
            registeredAt: z.string(),
            currentTaskId: z.string().nullable(),
            tasksCompleted: z.number(),
            tasksFailed: z.number(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const agent = agentStore.get(id);

      if (!agent) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Agent ${id} not found`,
        });
      }

      return {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        registeredAt: agent.registeredAt,
        lastHeartbeat: agent.lastHeartbeat,
        currentTaskId: agent.currentTaskId,
        tasksCompleted: agent.tasksCompleted,
        tasksFailed: agent.tasksFailed,
        metadata: agent.metadata,
      };
    },
  );

  /**
   * POST /api/v1/agents/:id/heartbeat
   * Update agent heartbeat and optionally status
   */
  fastify.post(
    '/agents/:id/heartbeat',
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: heartbeatBodySchema,
        response: {
          200: z.object({
            id: z.string(),
            status: AgentStatusEnum,
            lastHeartbeat: z.string(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof heartbeatBodySchema>;
      const agent = agentStore.get(id);

      if (!agent) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Agent ${id} not found`,
        });
      }

      agent.lastHeartbeat = new Date().toISOString();

      if (body.status) {
        agent.status = body.status as AgentStatus;
      }
      if (body.currentTaskId !== undefined) {
        agent.currentTaskId = body.currentTaskId;
      }

      fastify.log.debug({ agentId: id, status: agent.status }, 'Heartbeat received');

      return {
        id: agent.id,
        status: agent.status,
        lastHeartbeat: agent.lastHeartbeat,
      };
    },
  );
}
