/**
 * ApprovalEscalation Constants
 * 状态配置、Mock 数据、辅助函数
 */
import { Tag } from 'antd';
import { colors } from '@/tokens/colors';
import type { EscalationStatus, ApprovalRecord, EscalationRule, TrendDay } from './types';

export const MOCK_APPROVALS: ApprovalRecord[] = [];

export const MOCK_RULES: EscalationRule[] = [];

export const MOCK_TREND: TrendDay[] = [];

export const formatWaitTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
};

export const statusConfig: Record<
  EscalationStatus,
  { label: string; color: string; bgColor: string }
> = {
  normal: { label: '正常', color: colors.success[500], bgColor: colors.success[50] },
  warning: { label: '即将超时', color: colors.warning[500], bgColor: colors.warning[50] },
  timeout: { label: '已超时', color: colors.error[500], bgColor: colors.error[50] },
  escalated: { label: '已升级', color: colors.purple[500], bgColor: colors.purple[50] },
};

export const statusTag = (status: EscalationStatus) => {
  const cfg = statusConfig[status];
  return (
    <Tag
      color={cfg.bgColor}
      style={{
        color: cfg.color,
        borderColor: cfg.color,
        fontWeight: 600,
      }}
    >
      {cfg.label}
    </Tag>
  );
};
