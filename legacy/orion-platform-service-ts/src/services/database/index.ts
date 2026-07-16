/**
 * MySQL 数据库服务导出
 */

export {
  ReplicationLagMonitor,
  LagLevel,
  DegradationLevel,
  LagThresholds,
  ReplicaStatus,
  LagDataPoint,
  LagTrendAnalysis,
  ReplicationLagMonitorConfig,
} from './ReplicationLagMonitor';

export {
  ReadTrafficManager,
  NodeType,
  DatabaseNode,
  TrafficDistribution,
  RoutingStrategy,
  ReadRequestContext,
  RoutingDecision,
  ReadTrafficManagerConfig,
} from './ReadTrafficManager';

export {
  DatabaseFailoverHandler,
  FailoverState,
  DegradationEvent,
  RecoveryEvent,
  FailoverAlert,
  DatabaseFailoverHandlerConfig,
} from './DatabaseFailoverHandler';