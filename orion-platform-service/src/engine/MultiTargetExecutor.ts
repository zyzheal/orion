import { StageExecutor } from './StageExecutor';
import { GrayScaleController, ExecutionBatch } from './GrayScaleController';
import { PipelineRun } from '../models/PipelineRun';
import { PipelineExecution } from './PipelineEngine';
import { PipelineStage } from '../models/Pipeline';
import { OrionError, ErrorCode } from '../errors';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TargetResult {
  target: string;
  batchIndex: number;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface BatchResult {
  batchIndex: number;
  targets: string[];
  targetResults: TargetResult[];
  batchSuccess: boolean;
}

export interface MultiTargetResult {
  stageName: string;
  executionMode: string;
  totalTargets: number;
  totalBatches: number;
  batchResults: BatchResult[];
  overallSuccess: boolean;
}

export class MultiTargetExecutor {
  private grayscaleController: GrayScaleController;
  private stageExecutor: StageExecutor;

  constructor(
    grayscaleController: GrayScaleController,
    stageExecutor: StageExecutor
  ) {
    this.grayscaleController = grayscaleController;
    this.stageExecutor = stageExecutor;
  }

  async execute(
    run: PipelineRun,
    execution: PipelineExecution,
    stage: PipelineStage
  ): Promise<MultiTargetResult> {
    const batches = this.grayscaleController.splitBatches(stage);

    if (batches.length === 0) {
      throw new OrionError(
        `Stage '${stage.name}' has no targets to execute`,
        ErrorCode.VALIDATION_ERROR
      );
    }

    const mode = stage.executionMode ?? 'oneshot';
    const batchResults: BatchResult[] = [];
    let overallSuccess = true;

    logger.info(
      { runId: run.id, stage: stage.name, mode, totalBatches: batches.length, totalTargets: batches.reduce((s, b) => s + b.targets.length, 0) },
      'MultiTargetExecutor starting'
    );

    for (const batch of batches) {
      const batchStart = Date.now();
      const targetResults: TargetResult[] = [];

      const promises = batch.targets.map(async (target) => {
        return this.executeTarget(run, execution, stage, target, batch.batchIndex);
      });
      const results = await Promise.all(promises);
      targetResults.push(...results);

      const batchDuration = Date.now() - batchStart;
      const batchSuccess = targetResults.every((r) => r.success);
      if (!batchSuccess) overallSuccess = false;

      logger.info(
        { runId: run.id, stage: stage.name, batchIndex: batch.batchIndex, batchSuccess, batchDuration }
      );

      batchResults.push({
        batchIndex: batch.batchIndex,
        targets: batch.targets,
        targetResults,
        batchSuccess,
      });

      if (!batchSuccess && mode === 'grayScale') {
        logger.warn(
          { runId: run.id, stage: stage.name, failedBatch: batch.batchIndex },
          'GrayScale batch failed, stopping remaining batches'
        );
        break;
      }
    }

    logger.info(
      { runId: run.id, stage: stage.name, overallSuccess, totalBatches: batchResults.length },
      'MultiTargetExecutor complete'
    );

    return {
      stageName: stage.name,
      executionMode: mode,
      totalTargets: batches.reduce((s, b) => s + b.targets.length, 0),
      totalBatches: batches.length,
      batchResults,
      overallSuccess,
    };
  }

  private async executeTarget(
    run: PipelineRun,
    execution: PipelineExecution,
    stage: PipelineStage,
    target: string,
    batchIndex: number
  ): Promise<TargetResult> {
    const start = Date.now();
    const targetLabel = `${stage.name}[${target}]`;

    try {
      const targetedStage: PipelineStage = {
        ...stage,
        name: targetLabel,
        steps: stage.steps.map((step) => ({
          ...step,
          name: `${step.name}-${target}`,
        })),
      };

      await this.stageExecutor.executeStage(
        run.pipelineId,
        run.id,
        targetedStage,
        execution as any
      );

      return {
        target,
        batchIndex,
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      logger.error(
        { runId: run.id, target, batchIndex, error: err.message },
        `Target execution failed`
      );
      return {
        target,
        batchIndex,
        success: false,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }
}
