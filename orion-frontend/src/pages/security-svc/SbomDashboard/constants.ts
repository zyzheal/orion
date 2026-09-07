/**
 * SbomDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 170)
 */
import type { StatusType } from '@/components/StatusBadge';

export const sbomStatusToBadge: Record<string, StatusType> = {
  active: 'success',
  expired: 'warning',
  revoked: 'failed',
};
