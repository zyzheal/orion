/**
 * constants.tsx - Backup 常量与工具函数
 * 抽取自 Backup/index.tsx (P2-9 Phase 68)
 */
import type { BackupType, BackupStatus } from '@/api/backup';
import type { BackupRecord as APIBackupRecord, BackupPlan as APIBackupPlan } from '@/api/backup';
import type { BackupRecord, BackupPlanItem } from './types';
import {
  FileProtectOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const typeLabelMap: Record<BackupType, string> = {
  full: '全量',
  incremental: '增量',
  differential: '差异',
};

export const typeIconMap: Record<BackupType, React.ReactNode> = {
  full: <FileProtectOutlined />,
  incremental: <DatabaseOutlined />,
  differential: <DatabaseOutlined />,
};

export const statusColorMap: Record<BackupStatus, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  verified: 'blue',
  expired: 'warning',
  deleted: 'default',
};

export const statusLabelMap: Record<BackupStatus, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '完成',
  failed: '失败',
  verified: '已验证',
  expired: '已过期',
  deleted: '已删除',
};

export function mapApiRecord(b: APIBackupRecord): BackupRecord {
  return {
    id: b.id,
    planId: b.plan_id,
    type: b.type,
    size: b.size_bytes,
    status: b.status,
    createdAt: b.created_at,
    completedAt: b.completed_at,
    errorMessage: b.error_message,
  };
}

export function mapApiPlan(p: APIBackupPlan): BackupPlanItem {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    retentionDays: p.retention_days,
    schedule: p.schedule,
    enabled: p.enabled,
    createdAt: p.created_at,
  };
}

export const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export const filterDefs: FilterDefinition[] = [
  {
    key: 'type',
    label: '备份类型',
    options: [
      { label: '全部', value: 'all' },
      { label: '全量', value: 'full' },
      { label: '增量', value: 'incremental' },
      { label: '差异', value: 'differential' },
    ],
  },
];
