/**
 * Version Archive API
 * Phase 2 - Archive, list, view, and restore versioned resources
 */
import apiClient from './client';

export interface VersionArchive {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  version: string;
  snapshot: Record<string, unknown>;
  archivedBy: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ArchiveVersionInput {
  resourceType: string;
  resourceId: string;
  snapshot: Record<string, unknown>;
  archivedBy?: string;
  reason?: string;
}

export const archiveVersion = (data: ArchiveVersionInput) =>
  apiClient.post<VersionArchive>('/version-archives', data);

export const listArchives = (params?: { resourceType?: string }) =>
  apiClient.get<VersionArchive[]>('/version-archives', { params });

export const getArchive = (id: string) =>
  apiClient.get<VersionArchive>(`/version-archives/${id}`);

export const getArchiveHistory = (resourceType: string, resourceId: string, params?: { limit?: number }) =>
  apiClient.get<VersionArchive[]>(`/version-archives/history/${resourceType}/${resourceId}`, { params });

export const restoreArchive = (id: string, data?: { restoredBy?: string }) =>
  apiClient.post<{ snapshot: Record<string, unknown> }>(`/version-archives/${id}/restore`, data);

export const deleteArchive = (id: string) =>
  apiClient.delete(`/version-archives/${id}`);
