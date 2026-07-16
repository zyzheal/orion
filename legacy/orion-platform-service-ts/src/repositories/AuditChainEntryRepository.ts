/**
 * AuditChainEntryRepository
 *
 * PostgreSQL Repository for chained audit log entries.
 * Implements IAuditLogChainRepository interface used by AuditLogChain.
 */

import { BaseRepository } from '../db/base-repository';
import { ChainedAuditLogEntry, ChainVerificationResult, ChainBreak } from '../services/audit/AuditTypes';
import { IAuditLogChainRepository } from '../services/audit/AuditLogChain';

export interface AuditChainEntryEntity {
  id: string;
  tenantId: string | null;
  sequenceNumber: number;
  action: string;
  userId: string;
  timestamp: Date;
  prevHash: string;
  contentHash: string;
  chainHash: string;
  details: Record<string, any>;
  signature: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AuditChainEntryRepository extends BaseRepository<AuditChainEntryEntity> implements IAuditLogChainRepository {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'audit_chain_entries');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<AuditChainEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_chain_entries WHERE tenant_id = $1 ORDER BY sequence_number DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByUserId(userId: string, limit: number = 100): Promise<AuditChainEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_chain_entries WHERE user_id = $1 ORDER BY sequence_number DESC LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAction(action: string, limit: number = 100): Promise<AuditChainEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_chain_entries WHERE action = $1 ORDER BY sequence_number DESC LIMIT $2`,
      [action, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getMaxSequenceNumber(): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM audit_chain_entries`,
    );
    return parseInt(result.rows[0]?.max_seq || '0', 10);
  }

  // IAuditLogChainRepository implementation

  async getEntries(options?: { startSequence?: number; endSequence?: number; limit?: number }): Promise<ChainedAuditLogEntry[]> {
    let query = `SELECT * FROM audit_chain_entries WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.startSequence !== undefined) {
      query += ` AND sequence_number >= $${paramIndex++}`;
      params.push(options.startSequence);
    }
    if (options?.endSequence !== undefined) {
      query += ` AND sequence_number <= $${paramIndex++}`;
      params.push(options.endSequence);
    }

    query += ` ORDER BY sequence_number ASC`;

    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToChainedEntry(row));
  }

  async getLastEntry(): Promise<ChainedAuditLogEntry | undefined> {
    const result = await this.db.query(
      `SELECT * FROM audit_chain_entries ORDER BY sequence_number DESC LIMIT 1`,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToChainedEntry(result.rows[0]);
  }

  async getNextSequenceNumber(): Promise<number> {
    const maxSeq = await this.getMaxSequenceNumber();
    return maxSeq + 1;
  }

  async verifyChain(options?: { startSequence?: number; endSequence?: number }): Promise<ChainVerificationResult> {
    const entries = await this.getEntries(options);
    const breaks: ChainBreak[] = [];
    let verifiedCount = 0;

    // Check sequence continuity
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedSeq = (options?.startSequence || 1) + i;

      if (entry.sequenceNumber !== expectedSeq) {
        breaks.push({
          sequenceNumber: expectedSeq,
          entryId: '',
          expectedHash: '',
          actualHash: '',
          breakType: 'SEQUENCE_GAP',
          description: `Missing entry at sequence ${expectedSeq}`,
          detectedAt: new Date(),
        });
        continue;
      }

      // Verify chain hash continuity
      if (i > 0) {
        const prevEntry = entries[i - 1];
        if (entry.prevHash !== prevEntry.chainHash) {
          breaks.push({
            sequenceNumber: entry.sequenceNumber,
            entryId: entry.id,
            expectedHash: prevEntry.chainHash,
            actualHash: entry.prevHash,
            breakType: 'HASH_MISMATCH',
            description: `Chain hash mismatch at sequence ${entry.sequenceNumber}`,
            detectedAt: new Date(),
          });
        }
      }

      verifiedCount++;
    }

    return {
      valid: breaks.length === 0,
      verifiedCount,
      totalCount: entries.length,
      breaks,
      verifiedAt: new Date(),
    };
  }

  async createFromChainedEntry(entry: ChainedAuditLogEntry): Promise<AuditChainEntryEntity> {
    return this.create({
      id: entry.id,
      tenant_id: entry.tenantId || null,
      sequence_number: entry.sequenceNumber,
      action: entry.action,
      user_id: entry.userId,
      timestamp: entry.timestamp,
      prev_hash: entry.prevHash,
      content_hash: entry.contentHash,
      chain_hash: entry.chainHash,
      details: entry.details,
      signature: entry.signature || null,
    });
  }

  protected mapRowToEntity(row: any): AuditChainEntryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sequenceNumber: row.sequence_number,
      action: row.action,
      userId: row.user_id,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
      prevHash: row.prev_hash,
      contentHash: row.content_hash,
      chainHash: row.chain_hash,
      details: row.details || {},
      signature: row.signature,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapRowToChainedEntry(row: any): ChainedAuditLogEntry {
    return {
      id: row.id,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
      action: row.action,
      userId: row.user_id,
      tenantId: row.tenant_id || undefined,
      prevHash: row.prev_hash,
      contentHash: row.content_hash,
      chainHash: row.chain_hash,
      details: row.details || {},
      signature: row.signature || undefined,
      sequenceNumber: row.sequence_number,
    };
  }
}
