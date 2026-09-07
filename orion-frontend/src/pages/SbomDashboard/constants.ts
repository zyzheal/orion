/**
 * SBOM Dashboard constants
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import type { StatusType } from '@/components/StatusBadge';
import type { FilterDefinition } from '@/components/SearchFilterBar';

// Map SBOM status to StatusBadge StatusType
export const SBOM_STATUS_TO_BADGE: Record<string, StatusType> = {
  active: 'success',
  expired: 'warning',
  revoked: 'failed',
};

export const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'format',
    label: '格式',
    options: [
      { label: '全部', value: 'all' },
      { label: 'SPDX', value: 'spdx' },
      { label: 'CycloneDX', value: 'cyclonedx' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Active', value: 'active' },
      { label: 'Expired', value: 'expired' },
      { label: 'Revoked', value: 'revoked' },
    ],
  },
];

export const WAIVER_SCOPE_OPTIONS = [
  { label: '全局', value: 'global' },
  { label: '项目', value: 'project' },
  { label: '环境', value: 'environment' },
];
