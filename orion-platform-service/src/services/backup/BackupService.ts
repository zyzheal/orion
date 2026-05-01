/**
 * BackupService - Business logic layer for Backup operations
 *
 * Orchestrates BackupRepository (backup jobs), BackupPlanRepository (backup plans),
 * RecoveryRepository (restore executions), BackupScheduler (scheduling),
 * BackupStorage (data storage), BackupVerifier (integrity checks),
 * and RecoveryService (disaster recovery planning).
 */

import { DatabasePool } from '../database';
import {
  BackupRepository,
  BackupJobRecord,
} from './BackupRepository';
import {
  BackupPlanRepository,
  BackupPlanRecord,
} from './BackupPlanRepository';
import {
  RecoveryRepository,
  RecoveryExecutionRecord,
} from './RecoveryRepository';
import {
  BackupScheduler,
} from './BackupScheduler';
import {
  BackupStorage,
} from './BackupStorage';
import {
  BackupVerifier,
} from './BackupVerifier';
import {
  RecoveryService,
} from './RecoveryService';
import {
  BackupPlan,
  BackupRecord,
  BackupStatus,
  BackupType,
  BackupSourceType,
  RecoveryPlan,
  RecoveryExecution,
  BackupVerification,
  BackupStatusSummary,
  StorageUsage,
  BackupHealthReport,
  BackupServiceConfig,
} from './types';

export class BackupServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BackupServiceError';
  }
}

export type BackupEventType =
  | 'backup:created'
  | 'backup:completed'
  | 'backup:failed'
  | 'backup:deleted'
  | 'backup:verified'
  | 'plan:created'
  | 'plan:updated'
  | 'plan:deleted'
  | 'recovery:initiated'
  | 'recovery:completed'
  | 'recovery:failed'
  | 'service:started'
  | 'service:stopped';

export interface BackupServiceOptions {
  database?: DatabasePool;
  config?: Partial<BackupServiceConfig>;
}

/**
 * Map a DB BackupPlanRecord to the domain BackupPlan type
 */
function recordToPlan(record: BackupPlanRecord): BackupPlan {
  return {
    id: record.id,
    name: record.name,
    type: record.type as BackupType,
    schedule: {
      cronExpression: record.schedule || '0 2 * * *',
      description: '',
      timezone: 'UTC',
    },
    retention: {
      maxBackups: record.retention_days,
      maxAgeMs: record.retention_days * 24 * 60 * 60 * 1000,
      minBackups: 1,
    },
    sources: Array.isArray(record.target?.sources) ? record.target.sources : ['database'],
    enabled: record.enabled,
    compress: record.storage_config?.compress !== false,
    encrypt: !!record.encryption_key,
    description: record.target?.description,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/**
 * Map a domain BackupPlan to a DB BackupPlanRecord
 */
function planToRecord(plan: Omit<BackupPlan, 'createdAt' | 'updatedAt'>): Omit<BackupPlanRecord, 'created_at' | 'updated_at'> {
  return {
    id: plan.id,
    tenant_id: plan.sources.join(','),
    name: plan.name,
    type: plan.type,
    target: {
      sources: plan.sources,
      description: plan.description,
    },
    schedule: plan.schedule.cronExpression,
    retention_days: plan.retention.maxBackups || 30,
    encryption_key: plan.encrypt ? 'default-key' : null,
    storage_config: { compress: plan.compress, path: '/var/backups/orion' },
    enabled: plan.enabled,
  };
}

/**
 * Map a DB BackupJobRecord to the domain BackupRecord type
 */
function jobToRecord(job: BackupJobRecord, plan?: BackupPlan | null): BackupRecord {
  return {
    id: job.id,
    planId: job.config_id || '',
    planName: plan?.name,
    type: (plan?.type || 'full') as BackupType,
    status: job.status as BackupStatus,
    size: job.size_bytes,
    sizeHuman: formatBytes(job.size_bytes),
    startedAt: job.started_at,
    completedAt: job.completed_at || undefined,
    storageLocation: job.storage_path || '',
    checksum: '',
    compressionRatio: 1.0,
    errorMessage: job.error_message || undefined,
    sources: ['database'] as BackupSourceType[],
    metadata: { config_id: job.config_id },
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export class BackupService {
  private repository: BackupRepository;
  private planRepository: BackupPlanRepository;
  private recoveryRepository: RecoveryRepository;
  private scheduler: BackupScheduler;
  private storage: BackupStorage;
  private verifier: BackupVerifier;
  private recoveryService: RecoveryService;

  private isRunning: boolean = false;

  constructor(options: BackupServiceOptions) {
    const pool = options.database;
    if (!pool) {
      throw new BackupServiceError('Database pool is required for BackupService', 'MISSING_DATABASE');
    }

    // Initialize repositories with database pool
    this.repository = new BackupRepository(pool);
    this.planRepository = new BackupPlanRepository(pool);
    this.recoveryRepository = new RecoveryRepository(pool);

    // Initialize sub-services
    this.scheduler = new BackupScheduler();
    this.storage = new BackupStorage({
      storagePath: options?.config?.storagePath,
      compressionLevel: options?.config?.compressionLevel ?? 6,
      encryptBackups: options?.config?.encryptBackups ?? false,
      encryptionKey: options?.config?.encryptionKey,
      maxStorageBytes: options?.config?.maxStorageBytes ?? 0,
    });
    this.verifier = new BackupVerifier(this.storage);
    this.recoveryService = new RecoveryService();

    // Wire scheduler to execute backups
    this.scheduler.onExecuteBackup = async (plan) => {
      return this.executeBackupFromPlan(plan);
    };
  }

  // ==================== Service Control ====================

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduler.start();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.scheduler.stop();
  }

  getHealthStatus(): { running: boolean; schedulerRunning: boolean; storagePath: string } {
    return {
      running: this.isRunning,
      schedulerRunning: this.scheduler.getIsRunning(),
      storagePath: this.storage.getStoragePath(),
    };
  }

  // ==================== Backup Plan Management ====================

  async createPlan(planData: Omit<BackupPlan, 'createdAt' | 'updatedAt'>): Promise<BackupPlan> {
    const record = await this.planRepository.create(planToRecord(planData));
    const plan = recordToPlan(record);
    this.scheduler.createPlan(plan);
    return plan;
  }

  async getPlan(planId: string): Promise<BackupPlan | null> {
    const record = await this.planRepository.findById(planId);
    if (!record) return null;
    return recordToPlan(record);
  }

  async getAllPlans(): Promise<BackupPlan[]> {
    const records = await this.planRepository.findAll();
    return records.map(recordToPlan);
  }

  async updatePlan(planId: string, updates: Partial<BackupPlan>): Promise<BackupPlan | null> {
    const existing = await this.planRepository.findById(planId);
    if (!existing) return null;

    const merged = recordToPlan(existing);
    const updated = { ...merged, ...updates };

    const record = await this.planRepository.update(planId, planToRecord(updated));
    if (!record) return null;

    this.scheduler.updatePlan(planId, updated);
    return recordToPlan(record);
  }

  async deletePlan(planId: string): Promise<boolean> {
    this.scheduler.deletePlan(planId);
    return this.planRepository.delete(planId);
  }

  async togglePlan(planId: string, enabled: boolean): Promise<BackupPlan | null> {
    const record = await this.planRepository.update(planId, { enabled });
    if (!record) return null;
    this.scheduler.togglePlan(planId, enabled);
    return recordToPlan(record);
  }

  // ==================== Backup Execution ====================

  async triggerBackup(planId: string): Promise<BackupRecord> {
    const record = await this.scheduler.triggerBackup(planId);
    if (!record) {
      throw new BackupServiceError(`Backup plan ${planId} not found`, 'PLAN_NOT_FOUND');
    }
    return record;
  }

  private async executeBackupFromPlan(plan: BackupPlan): Promise<BackupRecord> {
    const job = await this.repository.createJob(
      plan.sources.join(',') || 'default',
      plan.id
    );

    try {
      // Simulate backup data generation
      const data = Buffer.from(`backup-data-${job.id}-${Date.now()}`);
      const stored = await this.storage.store(job.id, plan.id, data, {
        compress: plan.compress,
        encrypt: plan.encrypt,
      });

      const completed = await this.repository.completeJob(job.id, stored.size);
      const record = jobToRecord(completed!, plan);
      record.checksum = stored.checksum;
      record.compressionRatio = stored.compressionRatio;

      this.verifier.registerBackups([record]);
      return record;
    } catch (e: any) {
      await this.repository.failJob(job.id, e.message);
      throw e;
    }
  }

  // ==================== Backup Records ====================

  async getBackups(filter?: { planId?: string; status?: string; type?: string }): Promise<BackupRecord[]> {
    const allJobs = await this.repository.findAllJobs();
    const plans = await this.getAllPlans();
    const planMap = new Map(plans.map(p => [p.id, p]));

    return allJobs
      .map(job => {
        const plan = planMap.get(job.config_id || '');
        return jobToRecord(job, plan);
      })
      .filter(record => {
        if (filter?.planId && record.planId !== filter.planId) return false;
        if (filter?.status && record.status !== filter.status) return false;
        if (filter?.type && record.type !== filter.type) return false;
        return true;
      });
  }

  async getBackupDetail(id: string): Promise<BackupRecord | null> {
    const job = await this.repository.findJobById(id);
    if (!job) return null;
    const plans = await this.getAllPlans();
    const plan = plans.find(p => p.id === job.config_id);
    return jobToRecord(job, plan || null);
  }

  async deleteBackup(id: string): Promise<boolean> {
    this.storage.delete(id);
    return this.repository.deleteJob(id);
  }

  // ==================== Verification ====================

  async verifyBackup(backupId: string): Promise<BackupVerification> {
    return this.verifier.verifyIntegrity(backupId);
  }

  async testRestore(backupId: string): Promise<BackupVerification> {
    return this.verifier.testRestore(backupId);
  }

  getVerificationsForBackup(backupId: string): BackupVerification[] {
    return this.verifier.getVerificationsForBackup(backupId);
  }

  // ==================== Recovery Plan Management ====================

  createRecoveryPlan(planData: Omit<RecoveryPlan, 'createdAt' | 'updatedAt'>): RecoveryPlan {
    const plan = this.recoveryService.createPlan(planData);
    this.verifier.registerRecoveryPlans([plan]);
    return plan;
  }

  getAllRecoveryPlans(): RecoveryPlan[] {
    return this.recoveryService.getAllPlans();
  }

  getRecoveryPlan(planId: string): RecoveryPlan | null {
    return this.recoveryService.getPlan(planId);
  }

  updateRecoveryPlan(planId: string, updates: Partial<RecoveryPlan>): RecoveryPlan | null {
    return this.recoveryService.updatePlan(planId, updates);
  }

  deleteRecoveryPlan(planId: string): boolean {
    return this.recoveryService.deletePlan(planId);
  }

  // ==================== Recovery Execution ====================

  async initiateRecovery(
    planId: string,
    options?: { backupId?: string; targetTime?: Date }
  ): Promise<RecoveryExecution> {
    return this.recoveryService.initiateRecovery(planId, options);
  }

  async executeRecoveryPlan(executionId: string): Promise<RecoveryExecution> {
    return this.recoveryService.executeRecoveryPlan(executionId);
  }

  async initiatePointInTimeRecovery(
    planId: string,
    targetTime: Date
  ): Promise<RecoveryExecution> {
    const backups = await this.getBackups();
    return this.recoveryService.initiatePointInTimeRecovery(planId, targetTime, backups);
  }

  getRecoveryExecutions(): RecoveryExecution[] {
    return this.recoveryService.getAllExecutions();
  }

  getRtoRpoStats(): {
    totalExecutions: number;
    completedExecutions: number;
    rtoMetCount: number;
    rtoMissedCount: number;
    rpoMetCount: number;
    rpoMissedCount: number;
    averageRtoMs: number;
    averageRpoMs: number;
    worstRtoMs: number;
    worstRpoMs: number;
  } {
    return this.recoveryService.getRtoRpoStats();
  }

  // ==================== Health & Monitoring ====================

  async getBackupStatusSummary(): Promise<BackupStatusSummary> {
    const backups = await this.getBackups();
    const plans = await this.getAllPlans();

    const byStatus: Record<BackupStatus, number> = {
      pending: 0, running: 0, completed: 0, failed: 0, verified: 0, expired: 0, deleted: 0,
    };
    const byType: Record<BackupType, number> = { full: 0, incremental: 0, differential: 0 };
    let totalStorageUsed = 0;
    let lastSuccessfulBackup: Date | undefined;
    let lastBackupStatus: BackupStatus | undefined;
    let recentFailures = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const backup of backups) {
      if (backup.status !== 'deleted') byStatus[backup.status]++;
      byType[backup.type]++;
      totalStorageUsed += backup.size;

      if ((backup.status === 'completed' || backup.status === 'verified') && backup.completedAt) {
        if (!lastSuccessfulBackup || backup.completedAt > lastSuccessfulBackup) {
          lastSuccessfulBackup = backup.completedAt;
        }
      }

      if (backup.status === 'failed' && backup.completedAt && backup.completedAt > oneDayAgo) {
        recentFailures++;
      }
    }

    if (backups.length > 0) {
      lastBackupStatus = backups.sort((a, b) =>
        (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      )[0].status;
    }

    return {
      totalBackups: backups.filter(b => b.status !== 'deleted').length,
      byStatus,
      byType,
      totalStorageUsed,
      totalStorageHuman: formatBytes(totalStorageUsed),
      lastSuccessfulBackup,
      lastBackupStatus,
      activePlans: plans.filter(p => p.enabled).length,
      recentFailures,
    };
  }

  getStorageUsage(): StorageUsage {
    return this.storage.getStorageUsage();
  }

  async generateHealthReport(): Promise<BackupHealthReport> {
    const backups = await this.getBackups();
    const storageUsage = this.getStorageUsage();
    const recoveryPlans = this.getAllRecoveryPlans();
    return this.verifier.generateHealthReport(backups, storageUsage, recoveryPlans);
  }

  async enforceAllRetentions(): Promise<string[]> {
    const plans = await this.getAllPlans();
    const backups = await this.getBackups();
    const deleted: string[] = [];

    for (const plan of plans) {
      const toDelete = this.scheduler.enforceRetention(plan, backups);
      for (const id of toDelete) {
        await this.repository.deleteJob(id);
        this.storage.delete(id);
      }
      deleted.push(...toDelete);
    }

    return deleted;
  }

  // ==================== Schedule Info ====================

  getAllScheduleInfo(): Array<{
    planId: string;
    planName: string;
    schedule: any;
    nextRun: Date | null;
    enabled: boolean;
  }> {
    return this.scheduler.getAllScheduleInfo();
  }

  getNextBackupTime(planId: string): Date | null {
    return this.scheduler.getNextBackupTime(planId);
  }
}
