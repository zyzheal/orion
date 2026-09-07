/**
 * AICMDBRecommendation shared types
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
export interface ModelStatus {
  version: string;
  trainingDataCount: number;
  accuracy: number;
  lastTrainedAt: string;
  accuracyTrend: number[];
}
