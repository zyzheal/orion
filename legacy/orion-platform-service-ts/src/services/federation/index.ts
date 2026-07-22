/**
 * Federation Scheduler Services
 *
 * Phase 3 - Multi-Cluster Orchestration
 */

export {
  FederationAdvancedService,
  SchedulingPolicy,
  CrossClusterJob,
  ResourcePool,
  SchedulingPolicyInput,
  JobSpec,
  ResourcePoolInput,
} from './FederationAdvancedService';

export {
  FederationSchedulerService,
  FederationCluster,
  FederationSchedule,
} from './FederationSchedulerService';

export {
  FederationService,
  CreateExecutorInput,
  RegisterExecutorInput,
  ExecutorHeartbeatInput,
  DispatchJobInput,
  FederationConfig,
} from './FederationService';

export {
  ClusterHealthMonitor,
  ClusterRecord,
  HealthCheckResult,
  ClusterMetrics as ClusterHealthMetrics,
  AnomalyDetectionResult,
} from './ClusterHealthMonitor';
