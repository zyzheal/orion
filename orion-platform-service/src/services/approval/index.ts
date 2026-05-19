/**
 * Approval Services
 */
export { ApprovalService, ApprovalStatus, ApprovalRequest } from './ApprovalService';

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
