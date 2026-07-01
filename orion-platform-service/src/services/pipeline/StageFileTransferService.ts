/**
 * StageFileTransferService — Inter-stage file transfer management
 *
 * Implements NeatLogic-style FileHandler for passing files between stages.
 * Files are stored in PostgreSQL (bytea) and transferred by reference.
 */

import pino from 'pino';
import { OrionError, ErrorCode } from '../../errors';
import { StageFileTransferRepository, StageFileTransferEntity } from '../repositories/StageFileTransferRepository';
import { StageFileTransfer, createStageFileTransfer } from '../../models/StageFileTransfer';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class StageFileTransferService {
  constructor(private repo: StageFileTransferRepository) {}

  /**
   * Register a file produced by a stage.
   */
  async register(stageId: string, fileName: string, content: Buffer): Promise<StageFileTransfer> {
    if (!content || content.length === 0) {
      throw new OrionError('File content cannot be empty', ErrorCode.VALIDATION_ERROR);
    }
    const entity = createStageFileTransfer({ stageId, fileName, content });
    const result = await this.repo.insert(entity);
    return this.mapEntity(result);
  }

  /**
   * Resolve a file by stage ID and file name.
   */
  async resolve(stageId: string, fileName: string): Promise<StageFileTransfer | null> {
    const result = await this.repo.findByStageIdAndName(stageId, fileName);
    return result ? this.mapEntity(result) : null;
  }

  /**
   * Transfer a file from one stage to another.
   */
  async transfer(transferId: string, toStageId: string): Promise<StageFileTransfer> {
    const result = await this.repo.transfer(transferId, toStageId);
    if (!result) throw new OrionError('File transfer not found', ErrorCode.NOT_FOUND);
    return this.mapEntity(result);
  }

  /**
   * Get all files transferred between two stages.
   */
  async getTransfersBetweenStages(fromStageId: string, toStageId: string): Promise<StageFileTransfer[]> {
    const results = await this.repo.findTransfersBetweenStages(fromStageId, toStageId);
    return results.map(r => this.mapEntity(r));
  }

  private mapEntity(entity: StageFileTransferEntity): StageFileTransfer {
    return {
      id: entity.id,
      stageId: entity.stageId,
      fromStageId: entity.fromStageId,
      toStageId: entity.toStageId,
      fileName: entity.fileName,
      content: entity.content,
      sizeBytes: entity.sizeBytes,
      transferred: entity.transferred,
      transferredAt: entity.transferredAt,
      createdAt: entity.createdAt,
    };
  }
}
