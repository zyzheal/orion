/**
 * ApprovalEscalation Types
 * 审批超时升级页面类型定义
 */

export type EscalationStatus = 'normal' | 'warning' | 'timeout' | 'escalated';

export interface ApprovalRecord {
  id: string;
  requestNo: string;
  applicant: string;
  approver: string;
  submitTime: string;
  waitMinutes: number;
  slaLimit: string;
  status: EscalationStatus;
  department: string;
  approvalType: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  threshold: string;
  thresholdMinutes: number;
  action: string;
  enabled: boolean;
  priority: number;
}

export interface TrendDay {
  date: string;
  avgDuration: number;
  maxDuration: number;
  slaRate: number;
}
