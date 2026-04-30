/**
 * Backup API Client
 *
 * Backend routes: orion-platform-service/src/api/backup-routes.ts
 */

import { api } from './client';

export interface BackupStats {
  total: number;
  successful: number;
  failed: number;
}

export interface BackupRecord {
  id: string;
  name: string;
  type: 'database' | 'config' | 'full';
  status: 'completed' | 'failed' | 'in_progress' | 'scheduled';
  size: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BackupInput {
  name: string;
  type: 'database' | 'config' | 'full';
}

export async function getBackupStats() {
  return api.get<{ stats: BackupStats }>('/v1/backup/stats');
}

export async function getBackups() {
  return api.get<{ backups: BackupRecord[] }>('/v1/backup');
}

export async function createBackup(input: BackupInput) {
  return api.post<{ backup: BackupRecord }>('/v1/backup', input);
}

export async function restoreBackup(id: string) {
  return api.post<void>(`/v1/backup/${id}/restore`);
}

export async function getBackupDownloadUrl(id: string) {
  return api.post<{ url: string }>(`/v1/backups/${id}/download`);
}

export async function deleteBackup(id: string) {
  return api.delete<void>(`/v1/backup/${id}`);
}
