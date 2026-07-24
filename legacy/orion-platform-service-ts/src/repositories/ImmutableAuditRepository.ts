/**
 * ImmutableAuditRepository
 *
 * PostgreSQL Repository for immutable audit entries and file metadata.
 * Replaces file-based storage with PostgreSQL as primary, file system as fallback.
 */

import { BaseRepository } from '../db/base-repository';
import { ChainedAuditLogEntry } from '../services/audit/AuditTypes';

export interface ImmutableAuditEntryEntity {
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
  fileSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImmutableAuditFileEntity {
  id: string;
  filePath: string;
  entryCount: number;
  lastSequenceNumber: number;
  lastChainHash: string | null;
  fileHash: string | null;
  isReadOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ImmutableAuditEntryRepository extends BaseRepository<ImmutableAuditEntryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'immutable_audit_entries');
  }

  async findBySequenceRange(startSequence: number, endSequence: number): Promise<ImmutableAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM immutable_audit_entries WHERE sequence_number >= $1 AND sequence_number <= $2 ORDER BY sequence_number ASC`,
      [startSequence, endSequence],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<ImmutableAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM immutable_audit_entries WHERE tenant_id = $1 ORDER BY sequence_number DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getMaxSequenceNumber(): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM immutable_audit_entries`,
    );
    return parseInt(result.rows[0]?.max_seq || '0', 10);
  }

  async createFromChainedEntry(entry: ChainedAuditLogEntry, fileSource?: string): Promise<ImmutableAuditEntryEntity> {
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
      file_source: fileSource || null,
    });
  }

  protected mapRowToEntity(row: any): ImmutableAuditEntryEntity {
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
      fileSource: row.file_source,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

export class ImmutableAuditFileRepository extends BaseRepository<ImmutableAuditFileEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'immutable_audit_files');
  }

  async findByFilePath(filePath: string): Promise<ImmutableAuditFileEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM immutable_audit_files WHERE file_path = $1`,
      [filePath],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateEntryCount(id: string, entryCount: number, lastSequenceNumber: number, lastChainHash: string): Promise<void> {
    await this.db.query(
      `UPDATE immutable_audit_files SET entry_count = $1, last_sequence_number = $2, last_chain_hash = $3, updated_at = NOW() WHERE id = $4`,
      [entryCount, lastSequenceNumber, lastChainHash, id],
    );
  }

  async setReadOnly(id: string): Promise<void> {
    await this.db.query(
      `UPDATE immutable_audit_files SET is_read_only = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async updateFileHash(id: string, fileHash: string): Promise<void> {
    await this.db.query(
      `UPDATE immutable_audit_files SET file_hash = $1, updated_at = NOW() WHERE id = $2`,
      [fileHash, id],
    );
  }

  protected mapRowToEntity(row: any): ImmutableAuditFileEntity {
    return {
      id: row.id,
      filePath: row.file_path,
      entryCount: row.entry_count,
      lastSequenceNumber: row.last_sequence_number,
      lastChainHash: row.last_chain_hash,
      fileHash: row.file_hash,
      isReadOnly: row.is_read_only,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
