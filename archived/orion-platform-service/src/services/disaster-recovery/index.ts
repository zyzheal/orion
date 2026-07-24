/**
 * Disaster Recovery Module
 * 
 * Exports all disaster recovery related components.
 */

// Repository
export {
  DisasterRecoveryRepository,
  // Types
  SyncMode,
  ConfigStatus,
  FailoverType,
  TriggeredBy,
  FailoverStatus,
  ReplicationStatus,
  HealthStatus,
  ClusterStatusValue,
  ClusterRole,
  // Interfaces
  DisasterRecoveryConfig,
  FailoverHistory,
  ReplicationLagMonitoring,
  HealthCheckHistory,
  ClusterStatus,
  FailoverLock,
  DisasterRecoveryStatus,
  CreateConfigInput,
  UpdateConfigInput,
  CreateFailoverInput,
  UpdateFailoverInput,
} from './DisasterRecoveryRepository';

// Service
export {
  DisasterRecoveryService,
  // Types
  FailoverOptions,
  FailbackOptions,
  FailoverResult,
  HealthCheckResult,
  ReplicationStatusResult,
  DRMetrics,
  DREventType,
  DREvent,
  // Errors
  DRError,
  FailoverInProgressError,
  ClusterUnhealthyError,
  LockAcquisitionError,
  ConfigurationError,
} from './DisasterRecoveryService';

// Default export
export { default as DisasterRecoveryRepositoryDefault } from './DisasterRecoveryRepository';
export { default as DisasterRecoveryServiceDefault } from './DisasterRecoveryService';