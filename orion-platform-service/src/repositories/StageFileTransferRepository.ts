/**
 * StageFileTransferRepository — Data access layer for stage_file_transfers table
 *
 * Provides CRUD operations for inter-stage file transfer records.
 * Uses DatabasePool directly (no BaseRepository), following CanaryTrafficRepository pattern.
 */

import { DatabasePool } from '../services/database';

export interface StageFileTransferEntity {
  id: string;
  stageId: string;
  fromStageId?: string;
  toStageId?: string;
  fileName: string;
  content: Buffer;
  sizeBytes: number;
  transferred: boolean;
  transferredAt?: Date;
  createdAt: Date;
}

export class StageFileTransferRepository {
  constructor(private pool: DatabasePool) {}

  async insert(entity: StageFileTransferEntity): Promise<StageFileTransferEntity> {
    const result = await this.pool.query(
      `INSERT INTO stage_file_transfers
        (id, stage_id, from_stage_id, to_stage_id, file_name, content, size_bytes, transferred, transferred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [entity.id, entity.stageId, entity.fromStageId, entity.toStageId,
       entity.fileName, entity.content, entity.sizeBytes, entity.transferred, entity.transferredAt],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByStageId(stageId: string): Promise<StageFileTransferEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_file_transfers WHERE stage_id = $1',
      [stageId],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  async findByStageIdAndName(stageId: string, fileName: string): Promise<StageFileTransferEntity | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM stage_file_transfers WHERE stage_id = $1 AND file_name = $2',
      [stageId, fileName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async transfer(transferId: string, toStageId: string): Promise<StageFileTransferEntity | undefined> {
    const result = await this.pool.query(
      `UPDATE stage_file_transfers
       SET to_stage_id = $2, transferred = true, transferred_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transferId, toStageId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async findTransfersBetweenStages(fromStageId: string, toStageId: string): Promise<StageFileTransferEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_file_transfers WHERE from_stage_id = $1 AND to_stage_id = $2',
      [fromStageId, toStageId],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): StageFileTransferEntity {
    return {
      id: row.id,
      stageId: row.stage_id,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      fileName: row.file_name,
      content: row.content,
      sizeBytes: parseInt(row.size_bytes, 10),
      transferred: row.transferred,
      transferredAt: row.transferred_at,
      createdAt: row.created_at,
    };
  }
}
