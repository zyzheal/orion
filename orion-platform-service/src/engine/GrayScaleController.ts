import { PipelineStage } from '../models/Pipeline';
import { OrionError, ErrorCode } from '../errors';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ExecutionBatch {
  batchIndex: number;
  targets: string[];
  totalTargets: number;
  totalBatches: number;
}

export class GrayScaleController {
  splitBatches(stage: PipelineStage): ExecutionBatch[] {
    const targets = stage.targets ?? [];

    if (targets.length === 0) {
      return [];
    }

    if (!stage.executionMode) {
      return [{
        batchIndex: 0,
        targets: [...targets],
        totalTargets: targets.length,
        totalBatches: 1,
      }];
    }

    const mode = stage.executionMode;

    if (mode === 'oneshot') {
      return [{
        batchIndex: 0,
        targets: [...targets],
        totalTargets: targets.length,
        totalBatches: 1,
      }];
    }

    if (mode === 'grayScale') {
      const batchSize = stage.batchSize ?? 1;

      if (batchSize < 1) {
        throw new OrionError(
          `Invalid batchSize ${batchSize} for stage '${stage.name}': must be >= 1`,
          ErrorCode.VALIDATION_ERROR
        );
      }

      const batches: ExecutionBatch[] = [];
      let batchIndex = 0;

      for (let i = 0; i < targets.length; i += batchSize) {
        const batchTargets = targets.slice(i, i + batchSize);
        batches.push({
          batchIndex: batchIndex++,
          targets: batchTargets,
          totalTargets: targets.length,
          totalBatches: Math.ceil(targets.length / batchSize),
        });
      }

      logger.info(
        { stage: stage.name, batchSize, totalBatches: batches.length, totalTargets: targets.length },
        'GrayScale batches split complete'
      );

      return batches;
    }

    logger.warn(
      { stage: stage.name, unknownMode: mode },
      'Unknown executionMode, falling back to oneshot'
    );
    return [{
      batchIndex: 0,
      targets: [...targets],
      totalTargets: targets.length,
      totalBatches: 1,
    }];
  }
}
