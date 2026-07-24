/**
 * PostgresTransactionLogStorage - PostgreSQL persistence for TransactionLog
 *
 * Uses TransactionLogRepository to store/load saga checkpoint records.
 * Implements the TransactionLogStorage interface.
 */

import { TransactionLogStorage, TransactionLogEntry, TransactionLogFilter } from './TransactionLog';
import { TransactionLogRepository, SagaCheckpointRecord } from '../repositories/TransactionLogRepository';

export class PostgresTransactionLogStorage implements TransactionLogStorage {
  constructor(private repository: TransactionLogRepository) {}

  async save(entry: TransactionLogEntry): Promise<void> {
    await this.repository.save(entry);
  }

  async get(transactionId: string): Promise<TransactionLogEntry | null> {
    const record = await this.repository.get(transactionId);
    if (!record) return null;
    return this.mapToEntry(record);
  }

  async getByRequestId(requestId: string): Promise<TransactionLogEntry | null> {
    const record = await this.repository.getByRequestId(requestId);
    if (!record) return null;
    return this.mapToEntry(record);
  }

  async query(filter: TransactionLogFilter): Promise<TransactionLogEntry[]> {
    const records = await this.repository.query(filter);
    return records.map(r => this.mapToEntry(r));
  }

  async delete(transactionId: string): Promise<void> {
    await this.repository.delete(transactionId);
  }

  // ==================== Mapping ====================

  private mapToEntry(record: SagaCheckpointRecord): TransactionLogEntry {
    return {
      transactionId: record.transaction_id,
      requestId: record.request_id,
      sagaName: record.saga_name,
      status: record.status as any,
      input: record.input,
      output: record.output,
      error: record.error || undefined,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      completedAt: record.completed_at || undefined,
      stepExecutions: record.step_executions as any,
      metadata: record.metadata,
    };
  }
}
