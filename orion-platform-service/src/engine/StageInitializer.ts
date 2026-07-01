/**
 * StageInitializer - Stage 和 Task 工厂
 *
 * 从 YAML 定义创建 Stage 和 Task 实例。
 * 纯函数式类，无副作用。
 */

import { PipelineStage as PipelineYamlStage } from '../models/Pipeline';
import { Stage, createStage } from '../models/Stage';
import { Task, createTask } from '../models/Task';

export class StageInitializer {
  /**
   * 初始化 Stages（原始 YAML stages）
   */
  initializeStages(runId: string, yamlStages: PipelineYamlStage[]): Stage[] {
    return yamlStages.map((yamlStage, index) => {
      const stage = createStage({
        runId,
        name: yamlStage.name,
        sequence: index,
        dependsOn: yamlStage.dependsOn || [],
        condition: yamlStage.if,
        timeoutSeconds: yamlStage.timeout || 3600,
        maxRetries: yamlStage.retries || 0,
      });
      // Store stage outputs declaration for later registration
      if (yamlStage.outputs) {
        stage.result = { outputs: yamlStage.outputs };
      }
      return stage;
    });
  }

  /**
   * 初始化 Stages（从展开后的 matrix stages）— GAP-02
   */
  initializeStagesFromExpanded(
    runId: string,
    expandedStages: Array<{ stage: PipelineYamlStage; name: string }>
  ): Stage[] {
    return expandedStages.map((expanded, index) =>
      createStage({
        runId,
        name: expanded.name,
        sequence: index,
        dependsOn: expanded.stage.dependsOn || [],
        condition: expanded.stage.if,
        timeoutSeconds: expanded.stage.timeout || 3600,
        maxRetries: expanded.stage.retries || 0,
      })
    );
  }

  /**
   * 初始化 Tasks
   */
  initializeTasks(
    stageId: string,
    steps: { name: string; uses: string; with?: Record<string, unknown> }[],
    runsOn?: string
  ): Task[] {
    const runnerLabels = runsOn ? runsOn.split(',').map(l => l.trim()).filter(Boolean) : [];
    return steps.map((step, index) => {
      const [type] = step.uses.split('@');
      const parameters: Record<string, unknown> = {
        ...(step.with || {}),
      };
      // GAP-CN-07: Pass runner labels for remote runner selection
      if (runnerLabels.length > 0) {
        parameters.__runnerLabels = runnerLabels;
      }
      return createTask({
        stageId,
        name: step.name,
        type,
        sequence: index,
        config: { uses: step.uses } as Record<string, unknown>,
        parameters,
        timeoutSeconds: 600,
      });
    });
  }
}
