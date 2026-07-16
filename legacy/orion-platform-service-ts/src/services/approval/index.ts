/**
 * Approval Services
 */
export { ApprovalService, ApprovalStatus, ApprovalRequest, ApprovalStatistics, ApprovalTrendDataPoint, ApprovalTrendReport } from './ApprovalService';

// Phase 2: Multi-level approval, emergency approval, templates
export { MultiLevelApprovalService, ApprovalAction, ApprovalMode } from './MultiLevelApprovalService';
export { EmergencyApprovalService, EmergencyReason } from './EmergencyApprovalService';
export { ApprovalTemplateService } from './ApprovalTemplateService';

// Phase 3: Approval Flow Engine
export {
  ApprovalFlowEngine,
  ApprovalFlowConfig,
  ApprovalFlowNode,
  FlowNodeType,
  FallbackStep,
  AgentThreshold,
  ParallelGroupConfig,
  FallbackChainConfig,
  ApproverRule,
  FlowMatchCondition,
  FlowStartContext,
  ApprovalInput,
  ApprovalResult,
  ExternalApprovalResponse,
  createDefaultFlowConfig,
  getRiskLevelLabel,
  getRiskLevelColor,
} from './ApprovalFlowEngine';

// Phase 4: Approval Timeout Scheduler
export {
  ApprovalTimeoutScheduler,
  ApprovalTimeoutConfig,
  TimeoutHandlingResult,
  ApprovalTimeoutInfo,
  DEFAULT_TIMEOUT_CONFIG,
} from './ApprovalTimeoutScheduler';
