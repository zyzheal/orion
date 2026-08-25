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
  return api.get<BackupStats>('/backup/stats');
}

export async function getBackups() {
  return api.get<BackupRecord[]>('/backup');
}

export async function createBackup(input: BackupInput) {
  return api.post<BackupRecord>('/backup', input);
}

export async function restoreBackup(id: string) {
  return api.post<void>(`/backup/${id}/restore`);
}

export async function getBackupDownloadUrl(id: string) {
  return api.post<{ url: string }>(`/backups/${id}/download`);
}

export async function deleteBackup(id: string) {
  return api.delete<void>(`/backup/${id}`);
}

export async function updateBackup(id: string, input: Partial<BackupInput>) {
  return api.put<BackupRecord>(`/backup/${id}`, input);
}
