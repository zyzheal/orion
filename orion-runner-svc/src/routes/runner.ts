/**
 * Runner Service Routes
 *
 * HTTP endpoints for task execution, health checks, and platform callbacks.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginOptions } from 'fastify';
import { RunnerService } from '../services/RunnerService';

interface RunnerRoutesOptions {
  runner: RunnerService;
}

export async function runnerRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions & RunnerRoutesOptions): Promise<void> {
  const runner = (opts as RunnerRoutesOptions).runner;
  // Execute task (called by Platform to dispatch work)
  fastify.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { jobId: string; task: { type: string; parameters?: Record<string, unknown> } };

    if (!body || !body.task) {
      return reply.code(400).send({ error: 'Missing task payload' });
    }

    // Check capacity
    if (runner.activeJobs >= runner.status.maxConcurrent) {
      return reply.code(503).send({ error: 'Runner at capacity', activeJobs: runner.activeJobs });
    }

    const { jobId, task } = body;

    try {
      const result = await runner.executeJob(jobId, task);

      return {
        jobId,
        status: result.success ? 'completed' : 'failed',
        result: {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration: result.duration,
        },
      };
    } catch (error) {
      return reply.code(500).send({
        jobId,
        status: 'failed',
        error: (error as Error).message,
      });
    }
  });

  // Health check
  fastify.get('/health', async () => {
    return runner.status;
  });

  // Get runner info
  fastify.get('/info', async () => {
    return {
      ...runner.status,
      version: '0.1.0',
      nodeVersion: process.version,
      os: process.platform,
      arch: process.arch,
    };
  });
}
