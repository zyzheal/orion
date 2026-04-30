/**
 * QueueService - Business logic layer for Queue
 *
 * Supports:
 * - Priority-based dequeuing (higher priority first)
 * - Automatic retry with exponential backoff
 * - Configurable max attempts per job
 */
import { QueueRepository, QueueJob } from './QueueRepository';

export class QueueServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'QueueServiceError'; }
}

export interface PushOptions {
  priority?: number;
  maxAttempts?: number;
}

export class QueueService {
  private repository: QueueRepository;
  private retryIntervalMs: number;

  constructor(repository: QueueRepository, options?: { retryIntervalMs?: number }) {
    this.repository = repository;
    this.retryIntervalMs = options?.retryIntervalMs ?? 10_000;
  }

  async push(tenantId: string, queue: string, payload: Record<string, any>, options?: PushOptions): Promise<QueueJob> {
    return this.repository.enqueue(tenantId, queue, payload, {
      priority: options?.priority ?? 0,
      maxAttempts: options?.maxAttempts ?? 3,
    });
  }

  async pop(queue: string, limit?: number): Promise<QueueJob[]> {
    return this.repository.dequeue(queue, limit);
  }

  async complete(id: string): Promise<void> {
    return this.repository.complete(id);
  }

  async fail(id: string, error?: string): Promise<{ shouldRetry: boolean; delaySeconds?: number }> {
    const job = await this.repository.findById(id);
    if (!job) throw new QueueServiceError(`Job not found: ${id}`, 'NOT_FOUND');

    const maxAttempts = (job as any).max_attempts ?? 3;
    return this.repository.failWithRetry(id, error || 'Unknown error', maxAttempts);
  }

  async retry(id: string, delaySeconds?: number): Promise<QueueJob | null> {
    const job = await this.repository.findById(id);
    if (!job) throw new QueueServiceError(`Job not found: ${id}`, 'NOT_FOUND');

    if (job.status !== 'failed' && job.status !== 'processing') {
      throw new QueueServiceError(`Cannot retry job in '${job.status}' state`, 'INVALID_STATE');
    }

    return this.repository.retry(id, delaySeconds ?? Math.pow(2, job.attempts));
  }

  async processRetryableJobs(): Promise<number> {
    const jobs = await this.repository.getRetryableJobs();
    let processed = 0;
    for (const job of jobs) {
      await this.repository.retry(job.id, 0);
      processed++;
    }
    return processed;
  }

  async findById(id: string): Promise<QueueJob | null> {
    return this.repository.findById(id);
  }

  async list(filters: {
    tenantId?: string;
    queue?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<QueueJob[]> {
    return this.repository.list(filters);
  }

  async getStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    return this.repository.countByStatus();
  }

  /**
   * Start a background loop that processes retryable jobs.
   * Returns a cleanup function to stop the loop.
   */
  startRetryLoop(intervalMs: number = this.retryIntervalMs): () => void {
    let stopped = false;
    const loop = async () => {
      while (!stopped) {
        try {
          await this.processRetryableJobs();
        } catch {
          // Silently ignore errors in retry loop
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    };
    loop();
    return () => { stopped = true; };
  }
}
