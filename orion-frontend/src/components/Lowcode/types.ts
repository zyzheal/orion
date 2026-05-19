/**
 * Lowcode Components - Types
 * 低代码平台组件类型定义
 */

/**
 * 审批模式
 */
export type ApprovalMode = 'all' | 'any' | 'sequential';

/**
 * 审批人类型
 */
export type ApproverType = 'user' | 'role' | 'department' | 'leader';

/**
 * 超时动作
 */
export type TimeoutAction = 'remind' | 'auto_approve' | 'auto_reject' | 'escalate';

/**
 * 审批人配置
 */
export interface ApproverConfig {
  id: string;
  type: ApproverType;
  name: string;
  value: string; // 用户ID/角色ID/部门ID
  isRequired: boolean;
}

/**
 * 超时配置
 */
export interface TimeoutConfig {
  enabled: boolean;
  duration: number; // 分钟
  action: TimeoutAction;
}

/**
 * 审批节点配置
 */
export interface ApprovalNodeConfig {
  id: string;
  name: string;
  description?: string;
  mode: ApprovalMode; // 会签/或签/顺序审批
  approvers: ApproverConfig[];
  timeout: TimeoutConfig;
  allowDelegate: boolean; // 允许转交
  allowReject: boolean; // 允许拒绝
  requireComment: boolean; // 必须填写审批意见
  multipleApprovalSameNode: boolean; // 多人审批同一节点
  approverSelectType: 'select' | 'invoke_rule'; // 审批人选择方式
  approvalRuleId?: string; // 审批规则ID（当 approverSelectType 为 invoke_rule 时）
  formFields?: string[]; // 审批时需要填写的表单字段
}

/**
 * 审批节点状态
 */
export interface ApprovalNodeStatus {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  currentApprovers: string[];
  completedApprovers: string[];
  startTime?: string;
  endTime?: string;
  comments?: Array<{
    approver: string;
    content: string;
    action: 'approve' | 'reject' | 'delegate';
    timestamp: string;
  }>;
}

/**
 * 默认审批节点配置
 */
export const defaultApprovalNodeConfig: Omit<ApprovalNodeConfig, 'id'> = {
  name: '审批节点',
  description: '',
  mode: 'any',
  approvers: [],
  timeout: {
    enabled: true,
    duration: 24 * 60, // 24小时
    action: 'remind',
  },
  allowDelegate: true,
  allowReject: true,
  requireComment: false,
  multipleApprovalSameNode: false,
  approverSelectType: 'select',
  formFields: [],
};

/**
 * 审批模式标签
 */
export const approvalModeLabels: Record<ApprovalMode, string> = {
  all: '会签（所有人通过）',
  any: '或签（任一人通过）',
  sequential: '顺序审批',
};

/**
 * 审批模式简短标签
 */
export const approvalModeShortLabels: Record<ApprovalMode, string> = {
  all: '会签',
  any: '或签',
  sequential: '顺序',
};

/**
 * 超时动作标签
 */
export const timeoutActionLabels: Record<TimeoutAction, string> = {
  remind: '发送提醒',
  auto_approve: '自动通过',
  auto_reject: '自动拒绝',
  escalate: '转交上级',
};

/**
 * 审批人类型标签
 */
export const approverTypeLabels: Record<ApproverType, string> = {
  user: '指定用户',
  role: '指定角色',
  department: '部门',
  leader: '部门负责人',
};