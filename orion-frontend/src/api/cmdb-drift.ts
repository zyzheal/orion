/**
 * CMDB Drift Detection API
 * Tracks configuration drift between actual infrastructure and CMDB records
 */
import { api } from './client';

export interface DriftItem {
  id: string;
  name: string;
  type: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  severity: 'critical' | 'warning' | 'info';
  resourceId?: string;
  resourceType?: string;
}

export interface DriftStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export interface DriftFilter {
  severity?: string;
  type?: string;
  changedBy?: string;
  since?: string;
}

export function getCMDBDrifts(filter?: DriftFilter) {
  const params: Record<string, unknown> = {};
  if (filter?.severity) params.severity = filter.severity;
  if (filter?.type) params.type = filter.type;
  if (filter?.changedBy) params.changedBy = filter.changedBy;
  if (filter?.since) params.since = filter.since;
  return api.get<{ data: DriftItem[] }>('/api/v1/cmdb-drift', { params });
}

export function getCMDBDriftStats() {
  return api.get<{ data: DriftStats }>('/api/v1/cmdb-drift/stats');
}

export function getCMDBDrift(id: string) {
  return api.get<{ data: DriftItem }>(`/api/v1/cmdb-drift/${id}`);
}

export function syncCMDBDrift(id: string) {
  return api.post<{ data: { synced: boolean } }>(`/api/v1/cmdb-drift/${id}/sync`);
}

export function dismissCMDBDrift(id: string, reason: string) {
  return api.post<{ data: void }>(`/api/v1/cmdb-drift/${id}/dismiss`, { reason });
}
