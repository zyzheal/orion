/**
 * Pipeline Services - Pipeline 服务模块
 *
 * 导出所有 Pipeline 相关服务：
 * - PipelineRepository - Pipeline 数据库访问层 (PostgreSQL)
 * - PipelineRunRepository - PipelineRun 数据库访问层 (PostgreSQL)
 * - PipelineService - Pipeline 业务逻辑层
 * - PipelineRunService - PipelineRun 业务逻辑层
 */

// Pipeline CRUD - Repository & Service
export {
  PipelineRepository,
  Pipeline,
  PipelineStage,
  PipelineRun,
  StageExecution,
  CreatePipelineInput,
  UpdatePipelineInput,
  CreatePipelineRunInput,
} from './PipelineRepository';

export {
  PipelineService,
  PipelineVersion,
  PipelineValidationResult,
  PipelineRunOptions,
  PipelineRetryOptions,
  PipelineRunResult,
} from './PipelineService';

// PipelineRun - Repository & Service
export {
  PipelineRunRepository,
  PipelineRunRecord,
  StageExecutionRecord,
  TaskExecutionRecord,
  CreateRunInput,
} from './PipelineRunRepository';

export {
  PipelineRunService,
} from './PipelineRunService';

// Pipeline Engine - re-exported via barrel to reduce direct engine imports
export { PipelineEngine } from '../../engine/PipelineEngine';
export { StageExecutor } from '../../engine/StageExecutor';
export { TaskRunner } from '../../engine/TaskRunner';
export { PipelineServiceRegistry } from '../../engine/PipelineServiceRegistry';

// Pipeline Debug Controller (engine module, re-exported via pipeline barrel)
export { DebugController } from '../../engine/DebugController';

// PipelineStep type from engine (used by SharedActionService)
export type { PipelineStep } from '../../engine/YamlPreprocessor';

// Pipeline Trigger Service
export {
  PipelineTriggerService,
  PipelineTriggerServiceError,
  type PipelineTriggerServiceOptions,
  type TriggerType,
  type TriggerStatus,
  type TriggerExecutionStatus,
  type TriggerConfig,
  type Trigger,
  type TriggerEvent,
  type TriggerExecutionRecord,
  type CreateTriggerInput,
  type UpdateTriggerInput,
} from './PipelineTriggerService';
