import { FastifyInstance, FastifySchema } from 'fastify';
import { z } from 'zod';
import { TaskStatus, Task, AgentStatus } from '../types/agent';
import { v4 as uuidv4 } from 'uuid';

/** Zod enum matching TaskStatus values for JSON Schema compatibility */
const TaskStatusEnum = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

/**
 * In-memory task store.
 * In production, this would be backed by Redis via TaskExecutor.
 */
const taskStore = new Map<string, Task>();

/**
 * Reference to the agent store for validation.
 * Tasks need to verify agent existence and status.
 */
let _agentStore: Map<string, any> | null = null;

export function setAgentStoreRef(store: Map<string, any>): void {
  _agentStore = store;
}

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
            status: TaskStatusEnum,
            agentId: z.string(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
          409: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof dispatchTaskBodySchema>;

      // Validate agent exists and is idle
      if (_agentStore) {
        const agent = _agentStore.get(id);
        if (!agent) {
          return reply.code(404).send({
            error: 'Not Found',
            message: `Agent ${id} not found`,
          });
        }
        if (agent.status !== AgentStatus.IDLE) {
          return reply.code(409).send({
            error: 'Conflict',
            message: `Agent ${id} is not idle (current status: ${agent.status})`,
          });
        }
      }

      const task: Task = {
        id: uuidv4(),
        agentId: id,
        status: TaskStatus.PENDING,
        command: body.command,
        workingDirectory: body.workingDirectory,
        environment: body.environment || {},
        timeoutSeconds: body.timeoutSeconds,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        exitCode: null,
        stdout: '',
        stderr: '',
        errorMessage: null,
      };

      taskStore.set(task.id, task);

      app.log.info(
        { agentId: id, taskId: task.id, command: body.command },
        'Task dispatched to agent',
      );

      return reply.code(202).send({
        taskId: task.id,
        status: task.status,
        agentId: task.agentId,
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
        response: {
          200: z.object({
            id: z.string(),
            agentId: z.string().nullable(),
            status: TaskStatusEnum,
            command: z.string(),
            createdAt: z.string(),
            startedAt: z.string().nullable(),
            completedAt: z.string().nullable(),
            exitCode: z.number().nullable(),
            errorMessage: z.string().nullable(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };
      const task = taskStore.get(tid);

      if (!task || task.agentId !== id) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Task ${tid} not found on agent ${id}`,
        });
      }

      return {
        id: task.id,
        agentId: task.agentId,
        status: task.status,
        command: task.command,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        exitCode: task.exitCode,
        errorMessage: task.errorMessage,
      };
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
        response: {
          200: z.object({
            taskId: z.string(),
            stream: z.string(),
            logs: z.string(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };
      const query = request.query as { stream?: string; tail?: number };
      const task = taskStore.get(tid);

      if (!task || task.agentId !== id) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Task ${tid} not found on agent ${id}`,
        });
      }

      const stream = query.stream || 'combined';
      let logs = '';
      if (stream === 'stdout') {
        logs = task.stdout;
      } else if (stream === 'stderr') {
        logs = task.stderr;
      } else {
        logs = `${task.stdout}\n${task.stderr}`.trim();
      }

      // Apply tail limit
      const lines = logs.split('\n');
      const tail = query.tail || 1000;
      const truncated = lines.slice(-tail).join('\n');

      return {
        taskId: task.id,
        stream,
        logs: truncated,
      };
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
        response: {
          200: z.object({
            taskId: z.string(),
            status: TaskStatusEnum,
            message: z.string(),
          }),
          404: z.object({ error: z.string(), message: z.string() }),
          409: z.object({ error: z.string(), message: z.string() }),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const { id, tid } = request.params as { id: string; tid: string };
      const task = taskStore.get(tid);

      if (!task || task.agentId !== id) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Task ${tid} not found on agent ${id}`,
        });
      }

      if (
        task.status !== TaskStatus.RUNNING &&
        task.status !== TaskStatus.QUEUED &&
        task.status !== TaskStatus.PENDING
      ) {
        return reply.code(409).send({
          error: 'Conflict',
          message: `Task ${tid} cannot be cancelled (current status: ${task.status})`,
        });
      }

      task.status = TaskStatus.CANCELLED;
      task.completedAt = new Date().toISOString();
      task.errorMessage = 'Task cancelled by user';

      app.log.info({ taskId: tid }, 'Task cancelled');

      return {
        taskId: task.id,
        status: task.status,
        message: `Task ${tid} cancelled successfully`,
      };
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
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              agentId: z.string().nullable(),
              status: TaskStatusEnum,
              command: z.string(),
              createdAt: z.string(),
              exitCode: z.number().nullable(),
            }),
          ),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const query = request.query as {
        agentId?: string;
        status?: TaskStatus;
        limit?: number;
      };

      let tasks = Array.from(taskStore.values());

      if (query.agentId) {
        tasks = tasks.filter((t) => t.agentId === query.agentId);
      }
      if (query.status) {
        tasks = tasks.filter((t) => t.status === query.status);
      }

      const limit = query.limit || 20;
      tasks = tasks.slice(0, limit);

      return tasks.map((t) => ({
        id: t.id,
        agentId: t.agentId,
        status: t.status,
        command: t.command,
        createdAt: t.createdAt,
        exitCode: t.exitCode,
      }));
    },
  );
}
