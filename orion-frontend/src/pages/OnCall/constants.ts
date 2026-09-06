/**
 * constants.ts - OnCall 常量
 * 抽取自 OnCall/index.tsx (P2-9 Phase 78)
 */
import type { RotationType } from '@/api/oncall';

export const rotationTypeLabel: Record<RotationType, string> = {
  daily: '每日轮换',
  weekly: '每周轮换',
  monthly: '每月轮换',
};

export const rotationTypeColor: Record<RotationType, string> = {
  daily: 'blue',
  weekly: 'green',
  monthly: 'purple',
};

// Fallback users in case the API fails, matching the historical MOCK_USERS shape
export const FALLBACK_USERS: Record<string, string> = {
  'dev-001': '张三',
  'dev-002': '李四',
  'dev-003': '王五',
  'dev-004': '赵六',
  'dev-005': '孙七',
  'dev-006': '周八',
  'ops-001': '运维-甲',
  'ops-002': '运维-乙',
};
