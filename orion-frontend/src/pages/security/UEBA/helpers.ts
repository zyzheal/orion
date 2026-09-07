/**
 * UEBA helpers
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import { colors } from '@/tokens';
import { commonStyle } from './constants';
import type { AnomalyEvent, UserRiskRank } from './types';

export const getScoreColor = (score: number): string => {
  if (score >= 80) return commonStyle.error;
  if (score >= 60) return commonStyle.warning;
  if (score >= 40) return colors.warning[400];
  return commonStyle.info;
};

export const mockEvents: AnomalyEvent[] = [];

export const mockRiskRanks: UserRiskRank[] = [];
