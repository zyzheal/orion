import { FastifyInstance, FastifySchema } from 'fastify';
import { z } from 'zod';
import { TaskStatus } from '../types/agent';

const dispatchTaskBodySchema = z.object({
  command: z.string().min(1).max(8192),
  workingDirectory: z.string().default('/workspace'),
  environment: z.record(z.string(), z.string()).optional(),
  timeoutSeconds: z.number().min(1).max(3600).default(300),
});

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/agents/:id/tasks
   * Dispatch a task to an agent for execution
   */
  app.post(
    '/agents/:id/tasks',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: dispatchTaskBodySchema,
        response: {
          202: z.object({
            taskId: z.string(),
            status: z.nativeEnum(TaskStatus),
            agentId: z.string(),
          }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      // TODO: Implement TaskExecutor.dispatch()
      // - Validate agent exists and is IDLE
      // - Create task record
      // - Submit to sandbox for execution
      // - Return task ID and initial status

      const { id } = request.params as { id: string };
      const { command } = request.body as z.infer<typeof dispatchTaskBodySchema>;

      app.log.info({ agentId: id, command }, 'Dispatching task to agent');

      reply.status(501).send({
        error: 'Not Implemented',
        message: 'Task dispatch is not yet implemented',
      });
    },
  );

  /**
   * GET /api/v1/agents/:id/tasks/:tid
   * Get task status and details
   */
  app.get(
    '/agents/:id/tasks/:tid',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          tid: z.string().uuid(),
        }),
      } as FastifySchema,
    },
    async (request, reply) => {
      // TODO: Implement TaskExecutor.getTask()
      // - Fetch task status
      // - Include exit code, duration if completed

      const { id, tid } = request.params as { id: string; tid: string };

      reply.status(501).send({
        error: 'Not Implemented',
        message: `Task ${tid} lookup is not yet implemented`,
      });
    },
  );

  /**
   * GET /api/v1/agents/:id/tasks/:tid/logs
   * Get task execution logs (stdout + stderr)
   */
  app.get(
    '/agents/:id/tasks/:tid/logs',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          tid: z.string().uuid(),
        }),
        querystring: z.object({
          stream: z
            .enum(['stdout', 'stderr', 'combined'])
            .default('combined')
            .optional(),
          tail: z.coerce.number().min(1).max(10000).default(1000).optional(),
        }),
      } as FastifySchema,
    },
    async (request, reply) => {
      // TODO: Implement TaskExecutor.getLogs()
      // - Fetch logs from sandbox container or stored output
      // - Support stdout/stderr/combined streams
      // - Support tail lines parameter

      const { id, tid } = request.params as { id: string; tid: string };

      reply.status(501).send({
        error: 'Not Implemented',
        message: `Task ${tid} logs retrieval is not yet implemented`,
      });
    },
  );

  /**
   * POST /api/v1/agents/:id/tasks/:tid/cancel
   * Cancel a running task
   */
  app.post(
    '/agents/:id/tasks/:tid/cancel',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          tid: z.string().uuid(),
        }),
      } as FastifySchema,
    },
    async (request, reply) => {
      // TODO: Implement TaskExecutor.cancel()
      // - Signal sandbox container to stop
      // - Update task status to CANCELLED
      // - Free agent for new tasks

      const { id, tid } = request.params as { id: string; tid: string };

      reply.status(501).send({
        error: 'Not Implemented',
        message: `Task ${tid} cancellation is not yet implemented`,
      });
    },
  );

  /**
   * GET /api/v1/tasks
   * List all tasks (optional: filter by agent, status)
   */
  app.get(
    '/tasks',
    {
      schema: {
        querystring: z.object({
          agentId: z.string().uuid().optional(),
          status: z.nativeEnum(TaskStatus).optional(),
          limit: z.coerce.number().min(1).max(100).default(20).optional(),
        }),
      } as FastifySchema,
    },
    async (request, reply) => {
      // TODO: Implement TaskExecutor.listTasks()
      // - Query tasks from storage
      // - Filter by agentId and/or status
      // - Paginate with limit

      reply.status(501).send({
        error: 'Not Implemented',
        message: 'Task listing is not yet implemented',
      });
    },
  );
}
