/**
 * QueueService - Business logic layer for Queue
 */
import { QueueRepository, QueueJob } from './QueueRepository';

export class QueueServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'QueueServiceError'; }
}

export class QueueService {
  private repository: QueueRepository;
  constructor(repository: QueueRepository) { this.repository = repository; }

  async push(tenantId: string, queue: string, payload: Record<string, any>): Promise<QueueJob> {
    return this.repository.enqueue(tenantId, queue, payload);
  }

  async pop(queue: string, limit?: number): Promise<QueueJob[]> {
    return this.repository.dequeue(queue, limit);
  }

  async complete(id: string): Promise<void> {
    return this.repository.complete(id);
  }

  async fail(id: string): Promise<void> {
    return this.repository.fail(id);
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
}