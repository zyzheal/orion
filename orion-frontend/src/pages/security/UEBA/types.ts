/**
 * UEBA types
 * 抽取自 index.tsx (P2-9 Phase 135)
 */

export type AnomalyType = '异常登录' | '权限滥用' | '数据外泄' | '异常时间' | '高频操作';
export type DetectionMethod = 'IQR' | '3σ' | 'Z-Score';
export type EventStatus = '待调查' | '已确认' | '误报';
export type RiskLevel = 'all' | 'high' | 'medium' | 'low';

export interface AnomalyEvent {
  key: string;
  username: string;
  type: AnomalyType;
  score: number;
  method: DetectionMethod;
  time: string;
  status: EventStatus;
}

export interface UserRiskRank {
  key: string;
  username: string;
  score: number;
  count: number;
}

export interface DetectionConfig {
  method: DetectionMethod;
  sensitivity: number;
  baselineDays: number;
}
