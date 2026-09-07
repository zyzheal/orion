/**
 * DataQualityFix helpers
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import { colors } from '@/tokens/colors';
import { MOCK_DIMENSIONS } from './constants';

export function getOverallScore(): number {
  if (MOCK_DIMENSIONS.length === 0) return 0;
  const total = MOCK_DIMENSIONS.reduce((s, d) => s + d.score, 0);
  return Math.round(total / MOCK_DIMENSIONS.length);
}

export function getScoreColor(score: number): string {
  if (score >= 90) return colors.success[500];
  if (score >= 70) return colors.info[500];
  if (score >= 50) return colors.warning[500];
  return colors.error[500];
}
