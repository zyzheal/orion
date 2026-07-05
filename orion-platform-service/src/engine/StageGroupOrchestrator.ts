import { OrionError, ErrorCode } from '../errors';
import { Stage, StageStatus } from '../models/Stage';
import { PipelineExecution } from './PipelineEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger('StageGroupOrchestrator');

/**
 * StageGroupOrchestrator — Multi-stage batch execution (Phase Group)
 *
 * Extends Orion's grayScale from single-stage to multi-stage group level.
 * When stages are grouped, the entire group executes as a unit:
 * - Stage A (batch 1) → Stage B (batch 1) → Stage A (batch 2) → Stage B (batch 2)
 * - vs current: Stage A (all targets) → Stage B (all targets)
 *
 * Mirrors NeatLogic's PhaseGroup with GRAYSCALE policy at group level.
 */
export interface StageGroup {
  id: string;
  name: string;
  stages: Stage[];
  executionMode: 'oneshot' | 'grayScale';
  batchSize: number;
  targets: string[];
}

export class StageGroupOrchestrator {
  /**
   * Group stages by their groupPhaseId or stage group declarations.
   *
   * @param stages - All stages in the pipeline
   * @param stageGroupMap - Map of groupName -> [stageNames]
   * @returns Map of groupName -> Stage[]
   */
  groupStages(stages: Stage[], stageGroupMap: Record<string, string[]>): Map<string, Stage[]> {
    const groups = new Map<string, Stage[]>();

    // Create a lookup by name
    const stageMap = new Map(stages.map(s => [s.name, s]));

    // Group stages
    for (const [groupName, stageNames] of Object.entries(stageGroupMap)) {
      const groupStages = stageNames
        .map(name => stageMap.get(name))
        .filter((s): s is Stage => s !== undefined);
      if (groupStages.length > 0) {
        groups.set(groupName, groupStages);
      }
    }

    // Ungrouped stages get their own group (key = stage.id)
    for (const stage of stages) {
      const inGroup = Object.values(stageGroupMap).some(names => names.includes(stage.name));
      if (!inGroup) {
        groups.set(stage.id, [stage]);
      }
    }

    return groups;
  }

  /**
   * Execute a stage group with batch awareness.
   *
   * For grayScale groups, stages within each batch execute sequentially,
   * but batches execute in order. This differs from single-stage grayScale
   * where stages execute independently per target.
   *
   * @param groupName - The group identifier
   * @param groupStages - Stages in this group
   * @param execution - Pipeline execution context
   * @param executeStageFn - Function to execute a single stage (provided by StageOrchestrator)
   */
  async executeGroup(
    groupName: string,
    groupStages: Stage[],
    execution: PipelineExecution,
    executeStageFn: (stage: Stage) => Promise<{ success: boolean }>,
  ): Promise<void> {
    if (groupStages.length === 0) return;

    // Determine if any stage in the group uses multi-target
    const hasMultiTarget = groupStages.some(s => s.targets && s.targets.length > 0);
    const executionMode = groupStages[0]?.executionMode || 'oneshot';

    if (hasMultiTarget && executionMode === 'grayScale') {
      await this.executeGrayScaleGroup(groupName, groupStages, execution, executeStageFn);
    } else {
      // Sequential execution within the group
      for (const stage of groupStages) {
        if (execution.completedStages.has(stage.id) || execution.runningStages.has(stage.id)) {
          continue;
        }
        execution.pendingStages.add(stage.id);
        await executeStageFn(stage);
      }
    }
  }

  /**
   * Execute a grayScale group: stages execute in sequence per batch.
   *
   * Batch flow for group [StageA, StageB] with targets [t1, t2, t3] and batchSize=2:
   *   Batch 1: StageA(t1,t2) → StageB(t1,t2)
   *   Batch 2: StageA(t3) → StageB(t3)
   */
  private async executeGrayScaleGroup(
    groupName: string,
    groupStages: Stage[],
    execution: PipelineExecution,
    executeStageFn: (stage: Stage) => Promise<{ success: boolean }>,
  ): Promise<void> {
    const targets = groupStages[0].targets!;
    const batchSize = groupStages[0].batchSize || 1;

    if (batchSize < 1) {
      throw new OrionError(
        `Invalid batchSize ${batchSize} for group '${groupName}': must be >= 1`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Split targets into batches
    const batches: string[][] = [];
    for (let i = 0; i < targets.length; i += batchSize) {
      batches.push(targets.slice(i, i + batchSize));
    }

    logger.info(
      { groupName, batchSize, totalBatches: batches.length, totalTargets: targets.length },
      'GrayScale group batches split complete'
    );

    // Execute each batch: all stages in group for this batch, then next batch
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      for (const stage of groupStages) {
        execution.pendingStages.add(stage.id);
        await executeStageFn(stage);
      }
    }
  }
}
