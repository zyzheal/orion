/**
 * Queue Management Controller
 *
 * Handles API requests for queue job operations: enqueue, dequeue,
 * complete, fail, and listing.
 * PostgreSQL-backed via QueueService + QueueRepository.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { QueueService } from '../../services/queue/QueueService';
import { QueueServiceError } from '../../services/queue/QueueService';

export class QueueController {
  private queueService: QueueService;

  constructor(queueService: QueueService) {
    this.queueService = queueService;
  }

  // ==================== Job Operations ====================

  /**
   * Enqueue a job
   * POST /api/v1/queue/:queueName/jobs
   */
  async enqueue(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { queueName: string };
      const body = request.body as any || {};
      const { tenantId, payload, priority, maxAttempts } = body;

      if (!tenantId || !payload) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: tenantId, payload',
        });
        return;
      }

      const job = await this.queueService.push(tenantId, params.queueName, payload, {
        priority: typeof priority === 'number' ? priority : undefined,
        maxAttempts: typeof maxAttempts === 'number' ? maxAttempts : undefined,
      });

      await reply.status(201).send({
        success: true,
        data: { job },
      });
    } catch (error: any) {
      if (error instanceof QueueServiceError) {
        await reply.status(400).send({
          error: error.code,
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'ENQUEUE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Dequeue jobs (fetch pending jobs for processing)
   * POST /api/v1/queue/:queueName/dequeue
   */
  async dequeue(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { queueName: string };
      const body = request.body as any || {};
      const limit = body.limit ? parseInt(body.limit) : 1;

      const jobs = await this.queueService.pop(params.queueName, limit);

      await reply.status(200).send({
        success: true,
        data: { jobs, count: jobs.length },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'DEQUEUE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Mark a job as completed
   * POST /api/v1/queue/jobs/:id/complete
   */
  async complete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { id: string };

      await this.queueService.complete(params.id);

      await reply.status(200).send({
        success: true,
        message: `Job ${params.id} marked as completed`,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'COMPLETE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Mark a job as failed
   * POST /api/v1/queue/jobs/:id/fail
   */
  async fail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { id: string };
      const body = request.body as any || {};
      const error = body.error || 'Unknown error';

      const result = await this.queueService.fail(params.id, error);

      await reply.status(200).send({
        success: true,
        data: result,
        message: result && result.attempts && result.maxAttempts && result.attempts < result.maxAttempts
          ? `Job ${params.id} marked as failed, will retry`
          : `Job ${params.id} marked as failed (max attempts reached)`,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'FAIL_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Retry a failed job
   * POST /api/v1/queue/jobs/:id/retry
   */
  async retry(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { id: string };
      const body = request.body as any || {};
      const delaySeconds = body.delaySeconds ? parseInt(body.delaySeconds, 10) : undefined;

      const job = await this.queueService.retry(params.id, delaySeconds);

      await reply.status(200).send({
        success: true,
        data: { job },
        message: `Job ${params.id} queued for retry`,
      });
    } catch (error: any) {
      if (error instanceof QueueServiceError) {
        await reply.status(400).send({
          error: error.code,
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'RETRY_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Query Operations ====================

  /**
   * List jobs by status
   * GET /api/v1/queue/jobs
   */
  async listJobs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { tenantId, queue, status } = query;

      // Query jobs filtered by provided parameters
      const jobs = await this.listJobsByFilters({ tenantId, queue, status });

      await reply.status(200).send({
        success: true,
        data: { jobs, count: jobs.length },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'LIST_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get job by ID
   * GET /api/v1/queue/jobs/:id
   */
  async getJob(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { id: string };

      const job = await this.getJobById(params.id);

      if (!job) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Job ${params.id} not found`,
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { job },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'FETCH_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Queue Stats ====================

  /**
   * Get queue statistics
   * GET /api/v1/queue/stats
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.getQueueStats();

      await reply.status(200).send({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'STATS_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Internal helpers ====================

  private async listJobsByFilters(filters: {
    tenantId?: string;
    queue?: string;
    status?: string;
  }): Promise<any> {
    return this.queueService.list(filters);
  }

  private async getJobById(id: string): Promise<any> {
    return this.queueService.findById(id);
  }

  private async getQueueStats(): Promise<any> {
    return this.queueService.getStats();
  }
}
