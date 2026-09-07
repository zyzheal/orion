/**
 * NotificationRules constants
 * 抽取自 index.tsx (P2-9 Phase 175)
 */
import { colors } from '@/tokens';

/** IM platform options */
export const PLATFORM_OPTIONS = [
  { label: '钉钉 (DingTalk)', value: 'dingtalk' as const },
  { label: '企业微信 (WeCom)', value: 'wecom' as const },
  { label: '飞书 (Feishu)', value: 'feishu' as const },
];

/** Platform display config */
export const PLATFORM_CONFIG: Record<string, { color: string; label: string }> = {
  dingtalk: { color: colors.primary[500], label: '钉钉' },
  wecom: { color: colors.brand.wecom, label: '企业微信' },
  feishu: { color: colors.primary[500], label: '飞书' },
};

/** Pipeline events available for IM notification subscription */
export const IM_EVENT_OPTIONS = [
  'pipeline.complete',
  'pipeline.failed',
  'pipeline.cancelled',
  'deployment.success',
  'deployment.failed',
  'alert.triggered',
  'alert.resolved',
  'selfhealing.triggered',
  'cost.anomaly',
];
