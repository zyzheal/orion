import { type FastifyInstance, type FastifyPluginOptions, type FastifySchema } from 'fastify';
import { z } from 'zod';
import { MultiAgentOrchestrator, type AgentTask } from '../services/agent/MultiAgentOrchestrator';

// Initialize the orchestrator (singleton)
const orchestrator = new MultiAgentOrchestrator();

/**
 * Task type enum
 */
const TaskTypeEnum = z.enum(['reasoning', 'execution', 'verification', 'research']);

/**
 * Strategy enum
 */
const StrategyEnum = z.enum(['sequential', 'parallel', 'hierarchical', 'hybrid']);

/**
 * Task input schema (without id and status - those are generated)
 */
const taskInputSchema = z.object({
  agentId: z.string(),
  type: TaskTypeEnum,
  prompt: z.string(),
  priority: z.number().int().min(0).max(10).default(5),
  timeout: z.number().int().min(1).max(300000).default(5000),
  dependencies: z.array(z.string()).default([]),
});

/**
 * Create plan request schema
 */
const createPlanBodySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(500).default(''),
  tasks: z.array(taskInputSchema).min(1),
  strategy: StrategyEnum,
  maxConcurrent: z.number().int().min(1).max(10).default(3),
});

/**
 * Task response schema
 */
const taskResponseSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  type: TaskTypeEnum,
  prompt: z.string(),
  priority: z.number(),
  timeout: z.number(),
  dependencies: z.array(z.string()),
  status: z.enum(['pending', 'assigned', 'running', 'completed', 'failed']),
  result: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

/**
 * Plan response schema
 */
const planResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tasks: z.array(taskResponseSchema),
  strategy: StrategyEnum,
  maxConcurrent: z.number(),
  status: z.enum(['draft', 'planning', 'executing', 'completed', 'failed']),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

/**
 * Execution result schema
 */
const executionResultSchema = z.object({
  success: z.boolean(),
  planId: z.string(),
  results: z.record(z.unknown()),
  errors: z.record(z.string()),
  duration: z.number(),
});

/**
 * Params schema for plan ID
 */
const planIdParamsSchema = z.object({
  id: z.string(),
});

export async function orchestrationRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  /**
   * POST /api/v1/agents/orchestration/plans
   * Create a new orchestration plan
   */
  fastify.post(
    '/agents/orchestration/plans',
    {
      schema: {
        body: createPlanBodySchema,
        response: {
          201: planResponseSchema,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createPlanBodySchema>;

      const plan = await orchestrator.createPlan(
        body.name,
        body.description,
        body.tasks,
        body.strategy,
        body.maxConcurrent,
      );

      return reply.code(201).send({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        tasks: plan.tasks.map((t) => ({
          id: t.id,
          agentId: t.agentId,
          type: t.type,
          prompt: t.prompt,
          priority: t.priority,
          timeout: t.timeout,
          dependencies: t.dependencies,
          status: t.status,
          result: t.result,
          error: t.error,
          startedAt: t.startedAt?.toISOString(),
          completedAt: t.completedAt?.toISOString(),
        })),
        strategy: plan.strategy,
        maxConcurrent: plan.maxConcurrent,
        status: plan.status,
        createdAt: plan.createdAt.toISOString(),
        completedAt: plan.completedAt?.toISOString(),
      });
    },
  );

  /**
   * GET /api/v1/agents/orchestration/plans
   * List all orchestration plans
   */
  fastify.get(
    '/agents/orchestration/plans',
    {
      schema: {
        response: {
          200: z.array(planResponseSchema),
        },
      } as FastifySchema,
    },
    async () => {
      const plans = await orchestrator.listPlans();

      return plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        tasks: plan.tasks.map((t) => ({
          id: t.id,
          agentId: t.agentId,
          type: t.type,
          prompt: t.prompt,
          priority: t.priority,
          timeout: t.timeout,
          dependencies: t.dependencies,
          status: t.status,
          result: t.result,
          error: t.error,
          startedAt: t.startedAt?.toISOString(),
          completedAt: t.completedAt?.toISOString(),
        })),
        strategy: plan.strategy,
        maxConcurrent: plan.maxConcurrent,
        status: plan.status,
        createdAt: plan.createdAt.toISOString(),
        completedAt: plan.completedAt?.toISOString(),
      }));
    },
  );

  /**
   * GET /api/v1/agents/orchestration/plans/:id
   * Get a specific orchestration plan
   */
  fastify.get(
    '/agents/orchestration/plans/:id',
    {
      schema: {
        params: planIdParamsSchema,
        response: {
          200: planResponseSchema,
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof planIdParamsSchema>;
      const plan = await orchestrator.getPlan(id);

      if (!plan) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Plan ${id} not found`,
        });
      }

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        tasks: plan.tasks.map((t) => ({
          id: t.id,
          agentId: t.agentId,
          type: t.type,
          prompt: t.prompt,
          priority: t.priority,
          timeout: t.timeout,
          dependencies: t.dependencies,
          status: t.status,
          result: t.result,
          error: t.error,
          startedAt: t.startedAt?.toISOString(),
          completedAt: t.completedAt?.toISOString(),
        })),
        strategy: plan.strategy,
        maxConcurrent: plan.maxConcurrent,
        status: plan.status,
        createdAt: plan.createdAt.toISOString(),
        completedAt: plan.completedAt?.toISOString(),
      };
    },
  );

  /**
   * POST /api/v1/agents/orchestration/plans/:id/execute
   * Execute an orchestration plan
   */
  fastify.post(
    '/agents/orchestration/plans/:id/execute',
    {
      schema: {
        params: planIdParamsSchema,
        response: {
          200: executionResultSchema,
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof planIdParamsSchema>;

      // Check if plan exists first
      const plan = await orchestrator.getPlan(id);
      if (!plan) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Plan ${id} not found`,
        });
      }

      // Check if plan is already running
      if (plan.status === 'executing') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `Plan ${id} is already executing`,
        });
      }

      const result = await orchestrator.executePlan(id);

      // Convert Map to plain object for JSON serialization
      const resultsObj: Record<string, unknown> = {};
      const errorsObj: Record<string, string> = {};
      result.results.forEach((value, key) => {
        resultsObj[key] = value;
      });
      result.errors.forEach((value, key) => {
        errorsObj[key] = value;
      });

      return {
        success: result.success,
        planId: result.planId,
        results: resultsObj,
        errors: errorsObj,
        duration: result.duration,
      };
    },
  );

  /**
   * DELETE /api/v1/agents/orchestration/plans/:id
   * Abort an orchestration plan
   */
  fastify.delete(
    '/agents/orchestration/plans/:id',
    {
      schema: {
        params: planIdParamsSchema,
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof planIdParamsSchema>;

      const success = await orchestrator.abortPlan(id);

      if (!success) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Plan ${id} not found`,
        });
      }

      return {
        success: true,
        message: `Plan ${id} has been aborted`,
      };
    },
  );
}