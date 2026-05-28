/**
 * Pipeline Saga - Pipeline 执行的分布式事务实现
 *
 * 步骤定义：
 * 1. createRun - 补偿: deleteRun
 * 2. reserveResources - 补偿: releaseResources
 * 3. executeStages - 补偿: cancelStages
 * 4. updateStatus - 补偿: revertStatus
 * 5. publishEvents - 补偿: publishCancelEvents
 */

import { SagaStep, SagaContext, SagaDefinition } from './types';
import { parsePipelineYaml, PipelineStage as PipelineYamlStage } from '../models/Pipeline';
import { Pipeline } from '../services/pipeline/PipelineRepository';
import { PipelineRun, PipelineRunStatus, TriggerType, createPipelineRun } from '../models/PipelineRun';
import { Stage, StageStatus, createStage } from '../models/Stage';
import { Task, createTask } from '../models/Task';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { OrionError, ErrorCode } from '../../errors';

/**
 * Pipeline Saga 输入
 */
export interface PipelineSagaInput {
  /** Pipeline ID */
  pipelineId: string;
  /** 触发类型 */
  triggerType: TriggerType;
  /** 触发者 */
  triggerBy?: string;
  /** 执行上下文 */
  context?: Record<string, unknown>;
}

/**
 * Pipeline Saga 输出
 */
export interface PipelineSagaOutput {
  /** PipelineRun 实例 */
  run: PipelineRun;
  /** 执行的阶段 */
  stages: Stage[];
  /** 执行的任务 */
  tasks: Task[];
  /** 执行结果 */
  result?: {
    status: PipelineRunStatus;
    message?: string;
  };
}

/**
 * Pipeline Saga 步骤输出
 */
interface CreateRunOutput {
  run: PipelineRun;
  pipeline: Pipeline;
  spec: { stages: PipelineYamlStage[] };
}

interface ReserveResourcesOutput {
  stages: Stage[];
  tasksByStage: Map<string, Task[]>;
  reserved: boolean;
}

interface ExecuteStagesOutput {
  executedStages: Stage[];
  status: StageStatus;
  error?: string;
}

interface UpdateStatusOutput {
  status: PipelineRunStatus;
  previousStatus: PipelineRunStatus;
}

interface PublishEventsOutput {
  published: boolean;
  events: string[];
}

/**
 * 内存存储（与 PipelineRunService 共享）
 */
const pipelineRuns = new Map<string, PipelineRun>();
const stagesByRun = new Map<string, Stage[]>();
const tasksByStage = new Map<string, Task[]>();

/**
 * 创建 Pipeline Saga 定义
 */
export function createPipelineSagaDefinition(
  pipelineService: PipelineService,
  eventPublisher: PipelineEventPublisher,
  stageExecutor?: any // StageExecutor instance for real execution (FIXED P0-5)
): SagaDefinition<PipelineSagaInput, PipelineSagaOutput> {
  const steps: SagaStep<PipelineSagaInput, unknown>[] = [
    // 步骤 1: 创建 PipelineRun
    {
      name: 'createRun',
      sequence: 1,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<CreateRunOutput> => {
        // 获取 Pipeline 定义
        const pipeline = await pipelineService.getById(input.pipelineId);
        if (!pipeline) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Pipeline '${input.pipelineId}' not found`);
        }

        // 解析 YAML
        let spec: { stages: PipelineYamlStage[] };
        try {
          if (!pipeline.yamlDefinition) {
            throw new OrionError(ErrorCode.OPERATION_FAILED, 'Pipeline has no YAML definition');
          }
          const result = parsePipelineYaml(pipeline.yamlDefinition);
          spec = result.spec;
        } catch (error) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Failed to parse pipeline YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 创建 PipelineRun
        const run = createPipelineRun({
          pipelineId: input.pipelineId,
          pipelineVersion: String(pipeline.version || 1),
          triggerType: input.triggerType,
          triggerBy: input.triggerBy,
          context: input.context,
        });

        // 存储到内存
        pipelineRuns.set(run.id, run);

        // 将 runId 存储到上下文元数据中，供后续步骤使用
        context.metadata.runId = run.id;
        context.metadata.pipelineId = input.pipelineId;

        // 发布创建事件
        await eventPublisher.publishRunCreated(run);

        return { run, pipeline, spec };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as CreateRunOutput;
        const runId = context.metadata.runId as string || typedOutput.run.id;

        // 删除 PipelineRun
        pipelineRuns.delete(runId);
        stagesByRun.delete(runId);

        // 删除相关任务
        const stages = stagesByRun.get(runId) || [];
        for (const stage of stages) {
          tasksByStage.delete(stage.id);
        }

        // 发布删除事件
        await eventPublisher.publishRunCancelled(typedOutput.run);
      },
      retryConfig: {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        multiplier: 2,
      },
    },

    // 步骤 2: 资源预留
    {
      name: 'reserveResources',
      sequence: 2,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<ReserveResourcesOutput> => {
        const runId = context.metadata.runId as string;
        const previousOutput = context.stepExecutions[0]?.output as CreateRunOutput;

        if (!runId || !previousOutput) {
          throw new OrionError(ErrorCode.NOT_FOUND, 'Missing runId or previous step output');
        }

        const spec = previousOutput.spec;

        // 初始化 Stages
        const stages: Stage[] = spec.stages.map((yamlStage, index) =>
          createStage({
            runId,
            name: yamlStage.name,
            sequence: index,
            dependsOn: yamlStage.dependsOn || [],
            condition: yamlStage.if,
            timeoutSeconds: yamlStage.timeout || 3600,
            maxRetries: yamlStage.retries || 0,
          })
        );

        // 存储 Stages
        stagesByRun.set(runId, stages);

        // 初始化 Tasks
        const tasksByStageMap = new Map<string, Task[]>();
        for (const yamlStage of spec.stages) {
          const stage = stages.find(s => s.name === yamlStage.name)!;
          const tasks: Task[] = yamlStage.steps.map((step, index) => {
            const [type] = step.uses.split('@');
            return createTask({
              stageId: stage.id,
              name: step.name,
              type,
              sequence: index,
              config: { uses: step.uses } as Record<string, unknown>,
              parameters: step.with || {},
              timeoutSeconds: 600,
            });
          });
          tasksByStageMap.set(stage.id, tasks);
          tasksByStage.set(stage.id, tasks);
        }

        // 资源预留 — ResourceService 尚未实现，显式失败而非静默成功
        // TODO: 注入 ResourceService 后替换为真实调用
        throw new OrionError('OPERATION_FAILED', 'ResourceService not implemented — cannot reserve resources for pipeline run. Implement ResourceService and inject it into PipelineSaga.');
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as ReserveResourcesOutput;
        const runId = context.metadata.runId as string;

        // 清理 Stages 和 Tasks（内存清理仍需执行）
        stagesByRun.delete(runId);
        for (const stage of typedOutput.stages) {
          tasksByStage.delete(stage.id);
        }
        // TODO: ResourceService 实现后，此处应调用 releaseResources
      },
      timeoutMs: 10000,
    },

    // 步骤 3: 执行阶段 (FIXED P0-5)
    {
      name: 'executeStages',
      sequence: 3,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<ExecuteStagesOutput> => {
        const runId = context.metadata.runId as string;
        const stages = stagesByRun.get(runId) || [];

        if (!stages.length) {
          return { executedStages: [], status: StageStatus.SUCCESS };
        }

        // 如果有真实的 StageExecutor，则使用它执行
        if (stageExecutor) {
          const executedStages: Stage[] = [];
          for (const stage of stages) {
            // 更新 Stage 状态为 running
            const runningStage: Stage = {
              ...stage,
              status: StageStatus.RUNNING,
              startedAt: new Date(),
            };
            stagesByRun.set(runId, stages.map(s => s.id === stage.id ? runningStage : s));
            await eventPublisher.publishStageStarted(runId, runningStage);

            try {
              // 获取 Stage 的 Tasks 并执行
              const tasks = tasksByStage.get(stage.id) || [];
              const pipelineId = context.metadata.pipelineId as string;
              const result = await stageExecutor.executeStage(pipelineId, runId, stage, tasks);

              // 更新 Stage 状态
              const completedStage: Stage = {
                ...runningStage,
                status: result.success ? StageStatus.SUCCESS : StageStatus.FAILED,
                completedAt: new Date(),
                durationMs: Date.now() - runningStage.startedAt!.getTime(),
                error: result.error,
              };
              stagesByRun.set(runId, stages.map(s => s.id === stage.id ? completedStage : s));

              if (!result.success) {
                await eventPublisher.publishStageFailed(runId, completedStage, result.error || 'Unknown error');
                // Stage 失败，跳过后续 stages
                return {
                  executedStages: [...executedStages, completedStage],
                  status: StageStatus.FAILED,
                  error: result.error,
                };
              }

              await eventPublisher.publishStageCompleted(runId, completedStage);
              executedStages.push(completedStage);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              const failedStage: Stage = {
                ...runningStage,
                status: StageStatus.FAILED,
                completedAt: new Date(),
                durationMs: Date.now() - runningStage.startedAt!.getTime(),
                error: errorMessage,
              };
              stagesByRun.set(runId, stages.map(s => s.id === stage.id ? failedStage : s));
              await eventPublisher.publishStageFailed(runId, failedStage, errorMessage);
              return {
                executedStages: [...executedStages, failedStage],
                status: StageStatus.FAILED,
                error: errorMessage,
              };
            }
          }

          return { executedStages, status: StageStatus.SUCCESS };
        }

        // Fallback: 无 StageExecutor 时模拟执行（原有行为）
        const executedStages: Stage[] = [];
        for (const stage of stages) {
          const executedStage: Stage = {
            ...stage,
            status: StageStatus.SUCCESS,
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: 1000,
          };
          executedStages.push(executedStage);
        }

        stagesByRun.set(runId, executedStages);
        return { executedStages, status: StageStatus.SUCCESS };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const runId = context.metadata.runId as string;
        const stages = stagesByRun.get(runId) || [];

        // 取消所有阶段
        for (const stage of stages) {
          const cancelledStage: Stage = {
            ...stage,
            status: StageStatus.SKIPPED,
            completedAt: new Date(),
          };
          await eventPublisher.publishStageSkipped(runId, cancelledStage);
        }

        // 更新存储
        stagesByRun.set(runId, stages.map(s => ({
          ...s,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
        })));
      },
      timeoutMs: 300000, // 5 分钟
    },

    // 步骤 4: 更新状态
    {
      name: 'updateStatus',
      sequence: 4,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<UpdateStatusOutput> => {
        const runId = context.metadata.runId as string;
        const run = pipelineRuns.get(runId);

        if (!run) {
          throw new OrionError(ErrorCode.NOT_FOUND, `PipelineRun '${runId}' not found`);
        }

        const previousStatus = run.status;
        const stages = stagesByRun.get(runId) || [];

        // 判断最终状态
        const hasFailure = stages.some(s => s.status === StageStatus.FAILED);
        const status = hasFailure ? PipelineRunStatus.FAILED : PipelineRunStatus.SUCCESS;

        // 更新 PipelineRun
        const now = new Date();
        const startedAt = run.startedAt || run.createdAt;
        const updatedRun: PipelineRun = {
          ...run,
          status,
          completedAt: now,
          durationMs: now.getTime() - startedAt.getTime(),
          updatedAt: now,
        };

        pipelineRuns.set(runId, updatedRun);

        return { status, previousStatus };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as UpdateStatusOutput;
        const runId = context.metadata.runId as string;
        const run = pipelineRuns.get(runId);

        if (run) {
          // 恢复之前的状态
          const revertedRun: PipelineRun = {
            ...run,
            status: typedOutput.previousStatus,
            completedAt: undefined,
            durationMs: undefined,
            updatedAt: new Date(),
          };
          pipelineRuns.set(runId, revertedRun);
        }
      },
    },

    // 步骤 5: 发布事件
    {
      name: 'publishEvents',
      sequence: 5,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<PublishEventsOutput> => {
        const runId = context.metadata.runId as string;
        const run = pipelineRuns.get(runId);
        const stages = stagesByRun.get(runId) || [];

        if (!run) {
          throw new OrionError(ErrorCode.NOT_FOUND, `PipelineRun '${runId}' not found`);
        }

        const events: string[] = [];

        // 发布完成/失败事件
        if (run.status === PipelineRunStatus.SUCCESS) {
          await eventPublisher.publishRunCompleted(run);
          events.push('run.completed');
        } else {
          await eventPublisher.publishRunFailed(run);
          events.push('run.failed');
        }

        // 发布阶段完成事件
        for (const stage of stages) {
          if (stage.status === StageStatus.SUCCESS) {
            await eventPublisher.publishStageCompleted(runId, stage);
            events.push(`stage.${stage.name}.completed`);
          } else if (stage.status === StageStatus.FAILED) {
            await eventPublisher.publishStageFailed(runId, stage, stage.error || 'Unknown error');
            events.push(`stage.${stage.name}.failed`);
          }
        }

        return { published: true, events };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const runId = context.metadata.runId as string;
        const run = pipelineRuns.get(runId);

        if (run) {
          // 发布取消事件
          await eventPublisher.publishRunCancelled(run);
        }
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        multiplier: 2,
      },
    },
  ];

  // finalize 函数
  const finalize = async (input: PipelineSagaInput, context: SagaContext): Promise<PipelineSagaOutput> => {
    const runId = context.metadata.runId as string;
    const run = pipelineRuns.get(runId);
    const stages = stagesByRun.get(runId) || [];
    const tasks: Task[] = [];
    for (const stage of stages) {
      const stageTasks = tasksByStage.get(stage.id) || [];
      tasks.push(...stageTasks);
    }

    if (!run) {
      throw new OrionError(ErrorCode.NOT_FOUND, `PipelineRun '${runId}' not found`);
    }

    return {
      run,
      stages,
      tasks,
      result: {
        status: run.status,
      },
    };
  };

  return {
    name: 'PipelineExecutionSaga',
    steps,
    finalize,
  };
}

/**
 * Pipeline Saga 服务
 */
export class PipelineSaga {
  private definition: SagaDefinition<PipelineSagaInput, PipelineSagaOutput>;
  private pipelineService: PipelineService;

  constructor(
    pipelineService: PipelineService,
    eventPublisher: PipelineEventPublisher,
    stageExecutor?: any // StageExecutor (FIXED P0-5)
  ) {
    this.pipelineService = pipelineService;
    this.definition = createPipelineSagaDefinition(pipelineService, eventPublisher, stageExecutor);
  }

  /**
   * 获取 Saga 定义
   */
  getDefinition(): SagaDefinition<PipelineSagaInput, PipelineSagaOutput> {
    return this.definition;
  }

  /**
   * 获取 PipelineRun
   */
  getRun(runId: string): PipelineRun | null {
    return pipelineRuns.get(runId) || null;
  }

  /**
   * 获取 Stages
   */
  getStages(runId: string): Stage[] {
    return stagesByRun.get(runId) || [];
  }

  /**
   * 获取 Tasks
   */
  getTasks(stageId: string): Task[] {
    return tasksByStage.get(stageId) || [];
  }

  /**
   * 清理数据
   */
  cleanup(runId: string): void {
    pipelineRuns.delete(runId);
    const stages = stagesByRun.get(runId) || [];
    stagesByRun.delete(runId);
    for (const stage of stages) {
      tasksByStage.delete(stage.id);
    }
  }
}