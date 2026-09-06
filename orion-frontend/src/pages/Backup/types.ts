/**
 * types.ts - Backup 类型定义
 * 抽取自 Backup/index.tsx (P2-9 Phase 68)
 */
import type { BackupType, BackupStatus } from '@/api/backup';

export interface BackupRecord {
  id: string;
  planId: string;
  type: BackupType;
  size: number;
  status: BackupStatus;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BackupPlanItem {
  id: string;
  name: string;
  type: BackupType;
  retentionDays: number;
  schedule?: string;
  enabled: boolean;
  createdAt: string;
}

export interface BackupStats {
  total: number;
  successful: number;
  failed: number;
  lastBackupTime?: string;
  totalSize: number;
}
