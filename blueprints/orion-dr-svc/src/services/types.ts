/**
 * TASK-704: Backup & Recovery - Type Definitions
 *
 * Data models for backup planning, backup records, recovery plans,
 * backup verification, and disaster recovery tracking.
 */

// ==================== Backup Plan Types ====================

/**
 * Backup type
 */
export type BackupType = 'full' | 'incremental' | 'differential';

/**
 * Backup source type
 */
export type BackupSourceType = 'database' | 'filesystem' | 'config' | 'all';

/**
 * Cron-like schedule configuration
 */
export interface BackupSchedule {
  /** Cron expression (e.g., "0 2 * * *" for daily at 2am) */
  cronExpression: string;
  /** Human-readable description */
  description?: string;
  /** Timezone for the schedule */
  timezone?: string;
}

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  /** Maximum number of backups to keep */
  maxBackups?: number;
  /** Maximum age of backups in milliseconds */
  maxAgeMs?: number;
  /** Minimum number of backups to always keep */
  minBackups?: number;
}

/**
 * A configured backup plan
 */
export interface BackupPlan {
  /** Plan unique ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Type of backup */
  type: BackupType;
  /** Schedule configuration */
  schedule: BackupSchedule;
  /** Retention policy */
  retention: RetentionPolicy;
  /** Sources to back up */
  sources: BackupSourceType[];
  /** Whether the plan is active */
  enabled: boolean;
  /** Compression enabled */
  compress: boolean;
  /** Encryption enabled */
  encrypt: boolean;
  /** Description of the plan */
  description?: string;
  /** When the plan was created */
  createdAt: Date;
  /** When the plan was last modified */
  updatedAt: Date;
}

// ==================== Backup Record Types ====================

/**
 * Backup status
 */
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'verified' | 'expired' | 'deleted';

/**
 * A single backup record (instance of a backup plan execution)
 */
export interface BackupRecord {
  /** Backup unique ID */
  id: string;
  /** ID of the plan that created this backup */
  planId: string;
  /** Plan name */
  planName?: string;
  /** Type of backup */
  type: BackupType;
  /** Current status */
  status: BackupStatus;
  /** Size in bytes */
  size: number;
  /** Human-readable size */
  sizeHuman?: string;
  /** When the backup started */
  startedAt: Date;
  /** When the backup completed (null if still running) */
  completedAt?: Date;
  /** Storage location path */
  storageLocation: string;
  /** SHA-256 checksum of the backup file */
  checksum?: string;
  /** Compression ratio (1.0 = no compression) */
  compressionRatio?: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Sources included */
  sources: BackupSourceType[];
  /** Metadata */
  metadata?: Record<string, any>;
}

// ==================== Recovery Plan Types ====================

/**
 * Recovery step
 */
export interface RecoveryStep {
  /** Step order (0-based) */
  order: number;
  /** Human-readable description */
  description: string;
  /** Action type */
  action: 'restore_database' | 'restore_filesystem' | 'restore_config' | 'verify' | 'start_services';
  /** Estimated duration in milliseconds */
  estimatedDurationMs?: number;
  /** Dependencies (step orders that must complete first) */
  dependsOn?: number[];
}

/**
 * A disaster recovery plan
 */
export interface RecoveryPlan {
  /** Plan unique ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Recovery Time Objective in milliseconds */
  rto: number;
  /** Recovery Point Objective in milliseconds */
  rpo: number;
  /** Ordered recovery steps */
  steps: RecoveryStep[];
  /** When the plan was last tested */
  lastTested?: Date;
  /** Whether the plan is active */
  enabled: boolean;
  /** Description */
  description?: string;
  /** When the plan was created */
  createdAt: Date;
  /** When the plan was last modified */
  updatedAt: Date;
}

// ==================== Backup Verification Types ====================

/**
 * Verification status
 */
export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'in_progress';

/**
 * Backup verification record
 */
export interface BackupVerification {
  /** Verification unique ID */
  id: string;
  /** ID of the backup being verified */
  backupId: string;
  /** Verification status */
  status: VerificationStatus;
  /** Whether the integrity check passed */
  integrityCheck: boolean;
  /** Whether the restore test passed */
  restoreTest: boolean;
  /** When the verification was completed */
  verifiedAt?: Date;
  /** Details of integrity check */
  integrityDetails?: string;
  /** Details of restore test */
  restoreDetails?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** When verification started */
  startedAt: Date;
}

// ==================== Disaster Recovery Types ====================

/**
 * Recovery status
 */
export type RecoveryStatus = 'initiated' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

/**
 * Recovery step execution record
 */
export interface RecoveryStepExecution {
  /** Step order */
  stepOrder: number;
  /** Step description */
  description: string;
  /** Execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  /** When the step started */
  startedAt?: Date;
  /** When the step completed */
  completedAt?: Date;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * A disaster recovery execution instance
 */
export interface RecoveryExecution {
  /** Execution unique ID */
  id: string;
  /** ID of the recovery plan used */
  planId: string;
  /** Plan name */
  planName?: string;
  /** Recovery status */
  status: RecoveryStatus;
  /** Point-in-time target for recovery */
  targetTime?: Date;
  /** Backup ID used as the restore source */
  backupId?: string;
  /** Step executions */
  stepExecutions: RecoveryStepExecution[];
  /** When recovery was initiated */
  initiatedAt: Date;
  /** When recovery completed */
  completedAt?: Date;
  /** Actual recovery time in milliseconds */
  actualRtoMs?: number;
  /** Data loss window in milliseconds */
  actualRpoMs?: number;
  /** RTO target in milliseconds */
  rtoTargetMs: number;
  /** RPO target in milliseconds */
  rpoTargetMs: number;
  /** Whether RTO was met */
  rtoMet?: boolean;
  /** Whether RPO was met */
  rpoMet?: boolean;
  /** Error message if failed */
  errorMessage?: string;
}

// ==================== Backup Status & Monitoring Types ====================

/**
 * Backup status summary
 */
export interface BackupStatusSummary {
  /** Total number of backups */
  totalBackups: number;
  /** Backups by status */
  byStatus: Record<BackupStatus, number>;
  /** Backups by type */
  byType: Record<BackupType, number>;
  /** Total storage used in bytes */
  totalStorageUsed: number;
  /** Human-readable storage used */
  totalStorageHuman?: string;
  /** Last successful backup time */
  lastSuccessfulBackup?: Date;
  /** Last backup status */
  lastBackupStatus?: BackupStatus;
  /** Number of active plans */
  activePlans: number;
  /** Number of failed backups in last 24h */
  recentFailures: number;
}

/**
 * Storage usage information
 */
export interface StorageUsage {
  /** Total capacity in bytes */
  totalCapacity: number;
  /** Used space in bytes */
  usedSpace: number;
  /** Available space in bytes */
  availableSpace: number;
  /** Usage percentage */
  usagePercent: number;
  /** Human-readable used space */
  usedHuman?: string;
  /** Human-readable total capacity */
  totalHuman?: string;
  /** Number of backup files */
  fileCount: number;
  /** Oldest backup date */
  oldestBackup?: Date;
  /** Newest backup date */
  newestBackup?: Date;
}

/**
 * Backup health report
 */
export interface BackupHealthReport {
  /** Overall health status */
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  /** Health score (0-100) */
  healthScore: number;
  /** Storage usage info */
  storageUsage: StorageUsage;
  /** Backup status summary */
  backupSummary: BackupStatusSummary;
  /** Recent failures */
  recentFailures: BackupRecord[];
  /** Unverified backups count */
  unverifiedBackups: number;
  /** Recovery plans status */
  recoveryPlansStatus: {
    total: number;
    enabled: number;
    lastTestedWithinRpo: number;
  };
  /** Recommendations */
  recommendations: string[];
  /** Generated at */
  generatedAt: Date;
}

// ==================== Backup Config ====================

/**
 * Backup service configuration
 */
export interface BackupServiceConfig {
  /** Default storage path for backups */
  storagePath: string;
  /** Maximum storage size in bytes (0 = unlimited) */
  maxStorageBytes: number;
  /** Whether to enable automatic backup scheduling */
  enableAutoScheduling: boolean;
  /** Schedule evaluation interval in milliseconds */
  scheduleCheckIntervalMs: number;
  /** Whether to auto-verify new backups */
  autoVerifyBackups: boolean;
  /** Compression level (0-9) */
  compressionLevel: number;
  /** Whether to encrypt backups */
  encryptBackups: boolean;
  /** Encryption key (for demonstration, use env var in production) */
  encryptionKey?: string;
  /** NATS subject prefix for backup events */
  natsSubjectPrefix: string;
}
