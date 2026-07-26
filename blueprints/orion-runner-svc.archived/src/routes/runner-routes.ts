/**
 * Runner Service Routes
 *
 * HTTP endpoints for task execution, health checks, and platform callbacks.
 * Mounted under /runner prefix.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginOptions } from 'fastify';
import { RunnerService } from '../services/RunnerService';

interface RunnerRoutesOptions {
  runner: RunnerService;
}

interface ExecuteBody {
  jobId: string;
  task: {
    type: string;
    parameters?: Record<string, unknown>;
  };
}

export async function runnerRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & RunnerRoutesOptions
): Promise<void> {
  const runner = (opts as RunnerRoutesOptions).runner;

  /**
   * POST /runner/execute
   * Execute task (called by Platform to dispatch work)
   */
  fastify.post('/execute', async (request: FastifyRequest<{ Body: ExecuteBody }>, reply: FastifyReply) => {
    const body = request.body as ExecuteBody;

    if (!body || !body.task) {
      return reply.code(400).send({ error: 'Missing task payload' });
    }

    // Check capacity
    if (runner.activeJobs >= runner.status.maxConcurrent) {
      return reply.code(503).send({
        error: 'Runner at capacity',
        activeJobs: runner.activeJobs,
        maxConcurrent: runner.status.maxConcurrent,
      });
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

  /**
   * GET /runner/health
   * Health check
   */
  fastify.get('/health', async () => {
    return runner.status;
  });

  /**
   * GET /runner/info
   * Get runner info
   */
  fastify.get('/info', async () => {
    return {
      ...runner.status,
      version: '0.1.0',
      nodeVersion: process.version,
      os: process.platform,
      arch: process.arch,
    };
  });

  /**
   * GET /runner/metrics
   * Get runner metrics (active jobs, status, etc.)
   */
  fastify.get('/metrics', async () => {
    const status = runner.status;
    return {
      runnerId: status.runnerId,
      activeJobs: status.activeJobs,
      maxConcurrent: status.maxConcurrent,
      status: status.status,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  });
}