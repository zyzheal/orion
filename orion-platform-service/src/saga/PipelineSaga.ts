/**
 * Pipeline Saga - Pipeline 执行的分布式事务实现
 *
 * 步骤定义：
 * 1. createRun - 补偿: cancelRun
 * 2. reserveResources - 补偿: releaseResources
 * 3. executeStages - 补偿: cancelStages
 * 4. updateStatus - 补偿: revertStatus
 * 5. publishEvents - 补偿: publishCancelEvents
 *
 * 所有状态通过 PipelineRunService 持久化到 PostgreSQL，不再使用模块级内存 Map。
 */

import { SagaStep, SagaContext, SagaDefinition } from './types';
import { parsePipelineYaml, PipelineStage as PipelineYamlStage } from '../models/Pipeline';
import { Pipeline } from '../services/pipeline/PipelineRepository';
import { PipelineRun, PipelineRunStatus, TriggerType, createPipelineRun } from '../models/PipelineRun';
import { Stage, StageStatus, createStage } from '../models/Stage';
import { Task, createTask } from '../models/Task';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { OrionError, ErrorCode } from '../errors';

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
 * 创建 Pipeline Saga 定义
 */
export function createPipelineSagaDefinition(
  pipelineService: PipelineService,
  eventPublisher: PipelineEventPublisher,
  pipelineRunService: PipelineRunService,
  stageExecutor?: any // StageExecutor instance for real execution
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
          throw new OrionError(`Pipeline '${input.pipelineId}' not found`, ErrorCode.NOT_FOUND);
        }

        // 解析 YAML
        let spec: { stages: PipelineYamlStage[] };
        try {
          if (!pipeline.yamlDefinition) {
            throw new OrionError('Pipeline has no YAML definition', ErrorCode.OPERATION_FAILED);
          }
          const result = parsePipelineYaml(pipeline.yamlDefinition);
          spec = result.spec;
        } catch (error) {
          throw new OrionError(`Failed to parse pipeline YAML: ${error instanceof Error ? error.message : 'Unknown error'}`, ErrorCode.NOT_FOUND);
        }

        // 通过 PipelineRunService 创建 PipelineRun（持久化到 PostgreSQL）
        const run = await pipelineRunService.createRun({
          pipelineId: input.pipelineId,
          pipelineVersion: String(pipeline.version || 1),
          triggerType: input.triggerType,
          triggerBy: input.triggerBy,
          context: input.context,
        });

        // 将 runId 存储到上下文元数据中，供后续步骤使用
        context.metadata.runId = run.id;
        context.metadata.pipelineId = input.pipelineId;

        // createRun 已通过 PipelineRunService 发布 publishRunCreated 事件

        return { run, pipeline, spec };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as CreateRunOutput;
        const runId = context.metadata.runId as string || typedOutput.run.id;

        // 删除 PipelineRun（硬删除，因为是刚创建还未执行）
        await pipelineRunService.deleteRun(runId);

        // 发布取消事件
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
          throw new OrionError('Missing runId or previous step output', ErrorCode.NOT_FOUND);
        }

        const spec = previousOutput.spec;

        // 初始化 Stages（使用 createStage 生成 ID）
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

        // 持久化 Stages 到 PostgreSQL
        const persistedStages: Stage[] = [];
        for (const stage of stages) {
          const persistedStage = await pipelineRunService.addStage(runId, stage);
          persistedStages.push(persistedStage);
        }

        // 初始化 Tasks 并使用持久化后的 Stage ID
        const tasksByStageMap = new Map<string, Task[]>();
        for (const yamlStage of spec.stages) {
          const persistedStage = persistedStages.find(s => s.name === yamlStage.name)!;
          const tasks: Task[] = yamlStage.steps.map((step, index) => {
            const [type] = step.uses.split('@');
            return createTask({
              stageId: persistedStage.id,
              name: step.name,
              type,
              sequence: index,
              config: { uses: step.uses } as Record<string, unknown>,
              parameters: step.with || {},
              timeoutSeconds: 600,
            });
          });

          // 持久化 Tasks 到 PostgreSQL
          for (const task of tasks) {
            await pipelineRunService.addTask(persistedStage.id, task);
          }
          tasksByStageMap.set(persistedStage.id, tasks);
        }

        // 资源预留 — ResourceService 尚未实现，显式失败而非静默成功
        // TODO: 注入 ResourceService 后替换为真实调用
        throw new OrionError('ResourceService not implemented — cannot reserve resources for pipeline run. Implement ResourceService and inject it into PipelineSaga.', 'OPERATION_FAILED');
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        // 资源预留失败时，由 createRun 的补偿清理 PipelineRun
        // Stage 和 Task 记录会随 PipelineRun 一起被删除
        // TODO: ResourceService 实现后，此处应调用 releaseResources
      },
      timeoutMs: 10000,
    },

    // 步骤 3: 执行阶段
    {
      name: 'executeStages',
      sequence: 3,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<ExecuteStagesOutput> => {
        const runId = context.metadata.runId as string;
        const stages = await pipelineRunService.getStages(runId);

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
            await pipelineRunService.updateStage(runningStage);
            await eventPublisher.publishStageStarted(runId, runningStage);

            try {
              // 获取 Stage 的 Tasks 并执行
              const tasks = await pipelineRunService.getTasks(stage.id);
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
              await pipelineRunService.updateStage(completedStage);

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
              await pipelineRunService.updateStage(failedStage);
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
          await pipelineRunService.updateStage(executedStage);
        }

        return { executedStages, status: StageStatus.SUCCESS };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const runId = context.metadata.runId as string;
        const stages = await pipelineRunService.getStages(runId);

        // 取消所有阶段
        for (const stage of stages) {
          const cancelledStage: Stage = {
            ...stage,
            status: StageStatus.SKIPPED,
            completedAt: new Date(),
          };
          await pipelineRunService.updateStage(cancelledStage);
          await eventPublisher.publishStageSkipped(runId, cancelledStage);
        }
      },
      timeoutMs: 300000, // 5 分钟
    },

    // 步骤 4: 更新状态
    {
      name: 'updateStatus',
      sequence: 4,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<UpdateStatusOutput> => {
        const runId = context.metadata.runId as string;
        const run = await pipelineRunService.getRun(runId);

        if (!run) {
          throw new OrionError(`PipelineRun '${runId}' not found`, ErrorCode.NOT_FOUND);
        }

        const previousStatus = run.status;
        const stages = await pipelineRunService.getStages(runId);

        // 判断最终状态
        const hasFailure = stages.some(s => s.status === StageStatus.FAILED);
        const status = hasFailure ? PipelineRunStatus.FAILED : PipelineRunStatus.SUCCESS;

        // 通过 PipelineRunService 持久化最终状态（completeRun 已发布完成/失败事件）
        await pipelineRunService.completeRun(runId, status);

        return { status, previousStatus };
      },
      compensate: async (input: PipelineSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as UpdateStatusOutput;
        const runId = context.metadata.runId as string;
        const run = await pipelineRunService.getRun(runId);

        if (run) {
          // 恢复之前的状态 — 通过 repository 直接更新状态
          // 需要使用 PipelineRunService 的内容，但 completeRun 不支持回退到任意状态
          // 标记为 cancelled 作为补偿
          await pipelineRunService.cancelRun(runId);
        }
      },
    },

    // 步骤 5: 发布事件
    {
      name: 'publishEvents',
      sequence: 5,
      execute: async (input: PipelineSagaInput, context: SagaContext): Promise<PublishEventsOutput> => {
        const runId = context.metadata.runId as string;
        const run = await pipelineRunService.getRun(runId);
        const stages = await pipelineRunService.getStages(runId);

        if (!run) {
          throw new OrionError(`PipelineRun '${runId}' not found`, ErrorCode.NOT_FOUND);
        }

        const events: string[] = [];

        // 发布完成/失败事件（completeRun 已发布，但此处确保事件发送）
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
        const run = await pipelineRunService.getRun(runId);

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
    const run = await pipelineRunService.getRun(runId);
    const stages = await pipelineRunService.getStages(runId);
    const tasks: Task[] = [];
    for (const stage of stages) {
      const stageTasks = await pipelineRunService.getTasks(stage.id);
      tasks.push(...stageTasks);
    }

    if (!run) {
      throw new OrionError(`PipelineRun '${runId}' not found`, ErrorCode.NOT_FOUND);
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
  private pipelineRunService: PipelineRunService;

  constructor(
    pipelineService: PipelineService,
    eventPublisher: PipelineEventPublisher,
    pipelineRunService: PipelineRunService,
    stageExecutor?: any // StageExecutor
  ) {
    this.pipelineService = pipelineService;
    this.pipelineRunService = pipelineRunService;
    this.definition = createPipelineSagaDefinition(pipelineService, eventPublisher, pipelineRunService, stageExecutor);
  }

  /**
   * 获取 Saga 定义
   */
  getDefinition(): SagaDefinition<PipelineSagaInput, PipelineSagaOutput> {
    return this.definition;
  }

  /**
   * 获取 PipelineRun（委托给 PipelineRunService）
   */
  async getRun(runId: string): Promise<PipelineRun | null> {
    return this.pipelineRunService.getRun(runId);
  }

  /**
   * 获取 Stages（委托给 PipelineRunService）
   */
  async getStages(runId: string): Promise<Stage[]> {
    return this.pipelineRunService.getStages(runId);
  }

  /**
   * 获取 Tasks（委托给 PipelineRunService）
   */
  async getTasks(stageId: string): Promise<Task[]> {
    return this.pipelineRunService.getTasks(stageId);
  }

  /**
   * 清理数据（委托给 PipelineRunService）
   */
  async cleanup(runId: string): Promise<void> {
    await this.pipelineRunService.deleteRun(runId);
  }
}