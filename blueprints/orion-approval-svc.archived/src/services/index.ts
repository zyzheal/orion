/**
 * Approval Services
 */
export { ApprovalService, ApprovalStatus, ApprovalRequest } from './approval/ApprovalService';

// Phase 2: Multi-level approval, emergency approval, templates
export { MultiLevelApprovalService, ApprovalAction, ApprovalMode } from './approval/MultiLevelApprovalService';
export { EmergencyApprovalService, EmergencyReason } from './approval/EmergencyApprovalService';
export { ApprovalTemplateService } from './ApprovalTemplateService';
