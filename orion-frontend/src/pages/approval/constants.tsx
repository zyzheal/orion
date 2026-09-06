/**
 * constants.tsx - 状态/标签 映射 + 审批模板
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import type { ApprovalStatus } from '@/api/approvals';

export const statusColorMap: Record<ApprovalStatus, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
  cancelled: 'default',
};

export const statusLabelMap: Record<ApprovalStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
};

export interface ApprovalTemplate {
  id: string;
  name: string;
  description: string;
  approverRoles: string[];
  requiredApprovals: number;
  slaMinutes: number;
  icon: string;
}

export const APPROVAL_TEMPLATES: ApprovalTemplate[] = [
  {
    id: 'deployment',
    name: '生产部署审批',
    description: '生产环境部署需要技术负责人和运维负责人审批',
    approverRoles: ['tech-lead', 'ops-manager'],
    requiredApprovals: 2,
    slaMinutes: 60,
    icon: 'deployment',
  },
  {
    id: 'database',
    name: '数据库变更审批',
    description: '数据库结构变更需要 DBA 和技术负责人审批',
    approverRoles: ['dba', 'tech-lead'],
    requiredApprovals: 2,
    slaMinutes: 120,
    icon: 'database',
  },
  {
    id: 'security',
    name: '安全审批',
    description: '安全相关变更需要安全团队审批',
    approverRoles: ['security-lead'],
    requiredApprovals: 1,
    slaMinutes: 30,
    icon: 'security',
  },
  {
    id: 'infrastructure',
    name: '基础设施审批',
    description: '基础设施变更需要 SRE 团队审批',
    approverRoles: ['sre-lead', 'ops-manager'],
    requiredApprovals: 2,
    slaMinutes: 120,
    icon: 'infrastructure',
  },
];
