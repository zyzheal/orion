/**
 * Saga 分布式事务模块
 *
 * 提供 Saga 模式实现，确保分布式操作的数据一致性
 */

export {
  SagaStatus,
  SagaStepStatus,
  SagaStep,
  SagaStepExecution,
  SagaContext,
  SagaDefinition,
  SagaOptions,
  SagaError,
  SagaStepError,
  SagaCompensationError,
  createSagaContext,
  createStepExecution,
} from './types';

export { SagaCoordinator, SagaCoordinatorOptions, SagaExecutionResult } from './SagaCoordinator';

export { TransactionLog, TransactionLogEntry, TransactionLogFilter, TransactionLogStorage, InMemoryTransactionLogStorage } from './TransactionLog';

export { IdempotencyChecker, IdempotencyCheckResult, IdempotencyCheckerOptions } from './IdempotencyChecker';

export { PipelineSaga, PipelineSagaInput, PipelineSagaOutput, createPipelineSagaDefinition } from './PipelineSaga';