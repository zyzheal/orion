/**
 * types.ts - EventRegistry 类型定义
 * 抽取自 EventRegistry/index.tsx (P2-9 Phase 63)
 */
import type { TriggerStatistics } from '@/api/event-registry';

export interface StatisticsData {
  totalTriggers: number;
  byType: Record<string, { total: number; enabled: number }>;
  triggers: TriggerStatistics[];
}
