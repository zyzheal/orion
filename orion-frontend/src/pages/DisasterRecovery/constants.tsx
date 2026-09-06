/**
 * constants.ts - DisasterRecovery 类型/常量/默认值/数据加载
 * 抽取自 DisasterRecovery/index.tsx (P2-9 Phase 100)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { disasterRecoveryApi } from '@/api/disaster-recovery';

// ==================== Types ====================

export type RtoRpoStatus = 'pass' | 'fail' | 'untested';
export type DrillResult = 'success' | 'partial' | 'failed';
export type DrLevel = 'active-active' | 'active-passive' | 'backup-restore';

export interface RtoRpoRecord {
  id: string;
  serviceName: string;
  rtoTarget: number; // minutes
  rtoActual: number | null; // minutes
  rpoTarget: number; // minutes
  rpoActual: number | null; // minutes
  status: RtoRpoStatus;
  drLevel: DrLevel;
  lastTestedAt: string;
}

export interface DrillRecord {
  id: string;
  time: string;
  drillType: string;
  result: DrillResult;
  duration: number; // minutes
  service: string;
  description: string;
}

// ==================== Config maps ====================

export const drillResultConfig: Record<
  DrillResult,
  { label: string; color: string; icon: React.ReactNode }
> = {
  success: { label: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  partial: { label: '部分成功', color: 'warning', icon: <ExclamationCircleOutlined /> },
  failed: { label: '失败', color: 'error', icon: <CloseCircleOutlined /> },
};

export const drLevelConfig: Record<DrLevel, { label: string; color: string }> = {
  'active-active': { label: '多活', color: 'blue' },
  'active-passive': { label: '主备', color: 'orange' },
  'backup-restore': { label: '备份恢复', color: 'default' },
};

export const statusConfig: Record<RtoRpoStatus, { label: string; color: string }> = {
  pass: { label: '达标', color: 'success' },
  fail: { label: '超标', color: 'error' },
  untested: { label: '未测试', color: 'default' },
};

// ==================== Defaults ====================

export const DEFAULT_RTO_TARGET = '5 min';
export const DEFAULT_RPO_TARGET = '1 min';
export const DEFAULT_LAST_DRILL = '-';
export const DEFAULT_COVERAGE = 0;

// ==================== Data loaders ====================

export async function loadDRStatus() {
  try {
    const status = await disasterRecoveryApi.getDRStatus();
    return status;
  } catch {
    return null;
  }
}

export async function loadDRPlans() {
  try {
    const plans = await disasterRecoveryApi.listDRPlans();
    return plans;
  } catch {
    return [];
  }
}
