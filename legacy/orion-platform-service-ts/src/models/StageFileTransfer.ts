/**
 * StageFileTransfer — Inter-stage file transfer record
 *
 * Tracks files produced by one stage and consumed by another.
 * Mirrors NeatLogic's FileHandler pattern.
 */

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

export interface StageFileTransfer {
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

export function createStageFileTransfer(input: {
  stageId: string;
  fileName: string;
  content: Buffer;
  fromStageId?: string;
  toStageId?: string;
}): StageFileTransferEntity {
  return {
    id: `xfer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    stageId: input.stageId,
    fromStageId: input.fromStageId,
    toStageId: input.toStageId,
    fileName: input.fileName,
    content: input.content,
    sizeBytes: input.content.length,
    transferred: false,
    createdAt: new Date(),
  };
}
