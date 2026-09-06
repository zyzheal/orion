/**
 * constants.ts - ChatOps 管理后台常量
 * 抽取自 AdminSettings.tsx (P2-9 Phase 41)
 */
import { colors } from '@/tokens/colors';

export const riskLevelConfig: Record<number, { label: string; color: string }> = {
  1: { label: '低', color: colors.success[500] },
  2: { label: '中', color: colors.warning[500] },
  3: { label: '高', color: colors.error[400] },
  4: { label: '严重', color: colors.purple[600] },
};

export const environmentOptions = [
  { label: '全部', value: '' },
  { label: '开发 (dev)', value: 'dev' },
  { label: '测试 (staging)', value: 'staging' },
  { label: '生产 (prod)', value: 'prod' },
];
