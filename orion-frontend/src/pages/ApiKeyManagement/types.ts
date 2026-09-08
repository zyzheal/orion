/**
 * ApiKeyManagement types
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import type { ApiKey } from '@/api/api-key';

export interface ApiKeyDashboardData {
  keys: ApiKey[];
  stats: { total: number; active: number; expired: number } | null;
}
