/**
 * Backup API Client
 *
 * Backend routes: orion-platform-svc-go/internal/infrastructure/backup/handler/
 * ARCH-0.15: internal/backup + infrastructure/backup merged into single domain.
 */

import { api } from './client';

// ==================== Types ====================

export type BackupType = 'full' | 'incremental' | 'differential';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'verified' | 'expired' | 'deleted';
export type RecoveryStatus = 'initiated' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'in_progress';

export interface BackupStats {
  total_backups: number;
  completed_backups: number;
  failed_backups: number;
  verified_backups: number;
  running_backups: number;
  total_size_bytes: number;
  last_completed_at: string | null;
}

export interface BackupPlan {
  id: string;
  tenant_id: string;
  name: string;
  type: BackupType;
  schedule?: string;
  retention_days: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackupRecord {
  id: string;
  plan_id: string;
  type: BackupType;
  status: BackupStatus;
  size_bytes: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface RecoveryRecord {
  id: string;
  backup_id: string;
  status: RecoveryStatus;
  initiated_by: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface VerificationResult {
  backup_id: string;
  status: VerificationStatus;
  message: string;
  checked_at: string;
}

// ==================== Request Bodies ====================

export interface CreatePlanInput {
  name: string;
  type: BackupType;
  schedule?: string;
  retention_days: number;
  enabled: boolean;
}

export interface UpdatePlanInput {
  name?: string;
  type?: BackupType;
  schedule?: string;
  retention_days?: number;
  enabled?: boolean;
}

export interface TriggerBackupInput {
  type?: BackupType;
}

export interface CreateRecoveryInput {
  backup_id: string;
}

// ==================== Plan CRUD ====================

export async function listPlans(offset = 0, limit = 20) {
  return api.get<BackupPlan[]>('/backup/plans', { params: { offset, limit } });
}

export async function getPlan(id: string) {
  return api.get<BackupPlan>(`/backup/plans/${id}`);
}

export async function createPlan(input: CreatePlanInput) {
  return api.post<BackupPlan>('/backup/plans', input);
}

export async function updatePlan(id: string, input: UpdatePlanInput) {
  return api.put<BackupPlan>(`/backup/plans/${id}`, input);
}

export async function deletePlan(id: string) {
  return api.delete<void>(`/backup/plans/${id}`);
}

// ==================== Backup Execution ====================

export async function executeBackup(planId: string, input?: TriggerBackupInput) {
  return api.post<BackupRecord>(`/backup/plans/${planId}/execute`, input ?? {});
}

export async function listBackupRecords(planId: string, offset = 0, limit = 20) {
  return api.get<BackupRecord[]>(`/backup/plans/${planId}/records`, { params: { offset, limit } });
}

export async function getBackupRecord(planId: string, recordId: string) {
  return api.get<BackupRecord>(`/backup/plans/${planId}/records/${recordId}`);
}

export async function deleteBackupRecord(planId: string, recordId: string) {
  return api.delete<void>(`/backup/plans/${planId}/records/${recordId}`);
}

// ==================== Verify ====================

export async function verifyBackup(backupId: string) {
  return api.post<VerificationResult>(`/backup/verify/${backupId}`);
}

// ==================== Recovery ====================

export async function createRecovery(input: CreateRecoveryInput) {
  return api.post<RecoveryRecord>('/backup/recovery', input);
}

export async function listRecoveries(offset = 0, limit = 20) {
  return api.get<RecoveryRecord[]>('/backup/recovery', { params: { offset, limit } });
}

export async function getRecovery(id: string) {
  return api.get<RecoveryRecord>(`/backup/recovery/${id}`);
}

export async function executeRecovery(id: string) {
  return api.post<RecoveryRecord>(`/backup/recovery/${id}/execute`);
}

export async function rollbackRecovery(id: string) {
  return api.delete<RecoveryRecord>(`/backup/recovery/${id}`);
}

// ==================== Stats ====================

export async function getBackupStats() {
  return api.get<BackupStats>('/backup/status');
}
