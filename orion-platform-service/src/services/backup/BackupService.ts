/**
 * TASK-704: Backup Service (Main Orchestrator)
 *
 * Orchestrates the entire backup lifecycle including scheduling,
 * storage, verification, and recovery. Subscribes to NATS events
 * for backup-related notifications.
 */

import { EventEmitter } from 'events';
import { BackupScheduler } from './BackupScheduler';
import { BackupStorage } from './BackupStorage';
import { BackupVerifier } from './BackupVerifier';
import { RecoveryService } from './RecoveryService';
import {
  BackupPlan,
  BackupRecord,
  BackupStatus,
  BackupType,
  BackupSourceType,
  RecoveryPlan,
  RecoveryExecution,
  BackupVerification,
  BackupHealthReport,
  BackupStatusSummary,
  StorageUsage,
  BackupServiceConfig,
} from './types';

/**
 * Default backup service configuration
 */
const DEFAULT_CONFIG: BackupServiceConfig = {
  storagePath: '/var/backups/orion',
  maxStorageBytes: 0, // Unlimited
  enableAutoScheduling: true,
  scheduleCheckIntervalMs: 60000, // 1 minute
  autoVerifyBackups: true,
  compressionLevel: 6,
  encryptBackups: false,
  natsSubjectPrefix: 'orion.backup',
};

/**
 * NATS event types for backup
 */
export type BackupEventType =
  | 'backup:triggered'
  | 'backup:started'
  | 'backup:completed'
  | 'backup:failed'
  | 'backup:deleted'
  | 'backup:verified'
  | 'recovery:initiated'
  | 'recovery:completed'
  | 'recovery:failed'
  | 'retention:enforced';

/**
 * Backup Service - Main orchestration layer
 *
 * Coordinates:
 * - Backup plan management
 * - Scheduled and manual backup execution
 * - Backup storage management
 * - Backup verification
 * - Disaster recovery
 * - Health monitoring
 * - NATS event subscription
 */
export class BackupService extends EventEmitter {
  /** Service configuration */
  private config: BackupServiceConfig;

  /** Backup scheduler */
  public scheduler: BackupScheduler;

  /** Backup storage manager */
  public storage: BackupStorage;

  /** Backup verifier */
  public verifier: BackupVerifier;

  /** Recovery service */
  public recovery: RecoveryService;

  /** All backup records */
  private backups: Map<string, BackupRecord> = new Map();

  /** NATS connection (optional) */
  private natsConnection: any = null;

  /** NATS event handler unsubscriber */
  private natsUnsubscribe?: () => Promise<void>;

  /** Whether the service is running */
  private isRunning: boolean = false;

  constructor(config?: Partial<BackupServiceConfig>) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.storage = new BackupStorage({
      storagePath: this.config.storagePath,
      compressionLevel: this.config.compressionLevel,
      encryptBackups: this.config.encryptBackups,
      encryptionKey: this.config.encryptionKey,
      maxStorageBytes: this.config.maxStorageBytes,
    });

    this.scheduler = new BackupScheduler(this.config.scheduleCheckIntervalMs);
    this.recovery = new RecoveryService();
    this.verifier = new BackupVerifier(this.storage);

    // Set up scheduler backup executor
    this.scheduler.onExecuteBackup = async (plan: BackupPlan) => {
      return this.executeBackup(plan);
    };

    // Forward scheduler events
    this.scheduler.on('backup:triggered', (planId: string) => {
      this.emit('backup:triggered', { planId });
    });
    this.scheduler.on('backup:completed', (record: BackupRecord) => {
      this.emit('backup:completed', record);
    });
    this.scheduler.on('backup:failed', (data: any) => {
      this.emit('backup:failed', data);
    });
    this.scheduler.on('retention:enforced', (data: any) => {
      this.emit('retention:enforced', data);
    });

    // Forward recovery events
    this.recovery.on('recovery:initiated', (execution: RecoveryExecution) => {
      this.emit('recovery:initiated', execution);
    });
    this.recovery.on('recovery:completed', (execution: RecoveryExecution) => {
      this.emit('recovery:completed', execution);
    });
    this.recovery.on('recovery:failed', (execution: RecoveryExecution) => {
      this.emit('recovery:failed', execution);
    });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the backup service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[BackupService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[BackupService] Starting...');

    // Start scheduler
    if (this.config.enableAutoScheduling) {
      this.scheduler.start();
    }

    // Connect to NATS if available
    await this.connectNats();

    this.emit('started');
    console.log('[BackupService] Started');
  }

  /**
   * Stop the backup service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('[BackupService] Stopping...');

    // Stop scheduler
    this.scheduler.stop();

    // Disconnect NATS
    if (this.natsConnection) {
      try {
        await this.natsUnsubscribe?.();
        await this.natsConnection.close();
      } catch (error) {
        console.warn('[BackupService] Error disconnecting NATS:', error);
      }
      this.natsConnection = null;
    }

    this.emit('stopped');
    console.log('[BackupService] Stopped');
  }

  /**
   * Check if the service is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // ==================== Backup Plan Management ====================

  /**
   * Create a backup plan
   */
  createPlan(plan: Omit<BackupPlan, 'createdAt' | 'updatedAt'>): BackupPlan {
    const fullPlan = this.scheduler.createPlan(plan);

    this.publishNatsEvent('backup:plan:created', {
      planId: fullPlan.id,
      planName: fullPlan.name,
    });

    return fullPlan;
  }

  /**
   * Get a backup plan
   */
  getPlan(planId: string): BackupPlan | null {
    return this.scheduler.getPlan(planId);
  }

  /**
   * Get all backup plans
   */
  getAllPlans(): BackupPlan[] {
    return this.scheduler.getAllPlans();
  }

  /**
   * Update a backup plan
   */
  updatePlan(planId: string, updates: Partial<BackupPlan>): BackupPlan | null {
    return this.scheduler.updatePlan(planId, updates);
  }

  /**
   * Delete a backup plan
   */
  deletePlan(planId: string): boolean {
    return this.scheduler.deletePlan(planId);
  }

  /**
   * Toggle a backup plan
   */
  togglePlan(planId: string, enabled: boolean): BackupPlan | null {
    return this.scheduler.togglePlan(planId, enabled);
  }

  // ==================== Backup Execution ====================

  /**
   * Trigger a manual backup for a plan
   */
  async triggerBackup(planId: string): Promise<BackupRecord | null> {
    const plan = this.scheduler.getPlan(planId);
    if (!plan) {
      throw new Error(`Backup plan ${planId} not found`);
    }

    return this.executeBackup(plan);
  }

  /**
   * Execute a backup for a plan
   */
  private async executeBackup(plan: BackupPlan): Promise<BackupRecord> {
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const startedAt = new Date();

    const record: BackupRecord = {
      id: backupId,
      planId: plan.id,
      planName: plan.name,
      type: plan.type,
      status: 'running',
      size: 0,
      startedAt,
      storageLocation: '',
      sources: plan.sources,
    };

    this.backups.set(backupId, record);
    this.emit('backup:started', record);
    this.publishNatsEvent('backup:started', {
      backupId,
      planId: plan.id,
      type: plan.type,
    });

    try {
      // Simulate backup data generation
      const backupData = this.generateBackupData(plan);

      // Store the backup
      const storeResult = await this.storage.store(backupId, plan.id, backupData, {
        compress: plan.compress,
        encrypt: plan.encrypt,
      });

      // Update record
      record.status = 'completed';
      record.completedAt = new Date();
      record.size = storeResult.size;
      record.sizeHuman = this.storage.formatBytes(storeResult.size);
      record.storageLocation = storeResult.storageLocation;
      record.checksum = storeResult.checksum;
      record.compressionRatio = storeResult.compressionRatio;

      this.emit('backup:completed', record);
      this.publishNatsEvent('backup:completed', {
        backupId,
        size: storeResult.size,
        checksum: storeResult.checksum,
      });

      // Auto-verify if enabled
      if (this.config.autoVerifyBackups) {
        setImmediate(async () => {
          try {
            const verification = await this.verifier.verifyIntegrity(backupId);
            if (verification.status === 'passed') {
              record.status = 'verified';
              this.emit('backup:verified', record);
              this.publishNatsEvent('backup:verified', { backupId });
            }
          } catch (error) {
            console.warn(`[BackupService] Auto-verification failed for ${backupId}:`, error);
          }
        });
      }

      return record;
    } catch (error: any) {
      record.status = 'failed';
      record.completedAt = new Date();
      record.errorMessage = error.message;

      this.emit('backup:failed', record);
      this.publishNatsEvent('backup:failed', {
        backupId,
        error: error.message,
      });

      return record;
    }
  }

  /**
   * Generate simulated backup data for a plan
   */
  private generateBackupData(plan: BackupPlan): Buffer {
    // Simulate backup data based on plan type and sources
    const dataSize = this.getDataSizeForType(plan.type);

    const header = JSON.stringify({
      type: plan.type,
      sources: plan.sources,
      timestamp: new Date().toISOString(),
      planId: plan.id,
    });

    // Create a buffer with header + simulated data
    const data = Buffer.alloc(dataSize);
    Buffer.from(header).copy(data, 0);

    // Fill remaining with simulated data
    for (let i = header.length; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }

    return data;
  }

  /**
   * Get simulated data size based on backup type
   */
  private getDataSizeForType(type: BackupType): number {
    switch (type) {
      case 'full':
        return 1024 * 1024; // 1MB simulated
      case 'incremental':
        return 256 * 1024; // 256KB simulated
      case 'differential':
        return 512 * 1024; // 512KB simulated
      default:
        return 1024 * 512; // 512KB
    }
  }

  // ==================== Backup Querying ====================

  /**
   * Get all backup records
   */
  getBackups(filter?: {
    planId?: string;
    status?: BackupStatus;
    type?: BackupType;
  }): BackupRecord[] {
    let backups = Array.from(this.backups.values());

    if (filter?.planId) {
      backups = backups.filter(b => b.planId === filter.planId);
    }
    if (filter?.status) {
      backups = backups.filter(b => b.status === filter.status);
    }
    if (filter?.type) {
      backups = backups.filter(b => b.type === filter.type);
    }

    // Sort by startedAt descending
    backups.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return backups;
  }

  /**
   * Get backup detail by ID
   */
  getBackupDetail(backupId: string): BackupRecord | null {
    return this.backups.get(backupId) || null;
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    const backup = this.backups.get(backupId);
    if (!backup) return false;

    // Delete from storage
    this.storage.delete(backupId);

    // Update record
    backup.status = 'deleted';
    backup.completedAt = new Date();

    this.emit('backup:deleted', backupId);
    this.publishNatsEvent('backup:deleted', { backupId });

    return true;
  }

  // ==================== Verification ====================

  /**
   * Verify a backup's integrity
   */
  async verifyBackup(backupId: string): Promise<BackupVerification> {
    const backup = this.backups.get(backupId);
    if (backup) {
      this.verifier.updateBackup(backup);
    }
    return this.verifier.verifyIntegrity(backupId);
  }

  /**
   * Test restore a backup
   */
  async testRestore(backupId: string): Promise<BackupVerification> {
    const backup = this.backups.get(backupId);
    if (backup) {
      this.verifier.updateBackup(backup);
    }
    return this.verifier.testRestore(backupId);
  }

  /**
   * Get verification history for a backup
   */
  getVerificationsForBackup(backupId: string): BackupVerification[] {
    return this.verifier.getVerificationsForBackup(backupId);
  }

  // ==================== Recovery ====================

  /**
   * Create a recovery plan
   */
  createRecoveryPlan(plan: Omit<RecoveryPlan, 'createdAt' | 'updatedAt'>): RecoveryPlan {
    return this.recovery.createPlan(plan);
  }

  /**
   * Get a recovery plan
   */
  getRecoveryPlan(planId: string): RecoveryPlan | null {
    return this.recovery.getPlan(planId);
  }

  /**
   * Get all recovery plans
   */
  getAllRecoveryPlans(): RecoveryPlan[] {
    return this.recovery.getAllPlans();
  }

  /**
   * Update a recovery plan
   */
  updateRecoveryPlan(planId: string, updates: Partial<RecoveryPlan>): RecoveryPlan | null {
    return this.recovery.updatePlan(planId, updates);
  }

  /**
   * Delete a recovery plan
   */
  deleteRecoveryPlan(planId: string): boolean {
    return this.recovery.deletePlan(planId);
  }

  /**
   * Initiate recovery
   */
  async initiateRecovery(
    planId: string,
    options?: { backupId?: string; targetTime?: Date }
  ): Promise<RecoveryExecution> {
    // Register current backups with recovery service
    this.recovery.registerBackups(Array.from(this.backups.values()));
    return this.recovery.initiateRecovery(planId, options);
  }

  /**
   * Execute a recovery plan
   */
  async executeRecoveryPlan(executionId: string): Promise<RecoveryExecution> {
    return this.recovery.executeRecoveryPlan(executionId);
  }

  /**
   * Initiate point-in-time recovery
   */
  async initiatePointInTimeRecovery(
    planId: string,
    targetTime: Date
  ): Promise<RecoveryExecution> {
    this.recovery.registerBackups(Array.from(this.backups.values()));
    return this.recovery.initiatePointInTimeRecovery(
      planId,
      targetTime,
      Array.from(this.backups.values())
    );
  }

  /**
   * Get recovery executions
   */
  getRecoveryExecutions(): RecoveryExecution[] {
    return this.recovery.getAllExecutions();
  }

  /**
   * Get RTO/RPO statistics
   */
  getRtoRpoStats() {
    return this.recovery.getRtoRpoStats();
  }

  // ==================== Health & Monitoring ====================

  /**
   * Get backup status summary
   */
  getBackupStatusSummary(): BackupStatusSummary {
    const allBackups = Array.from(this.backups.values());
    const storageUsage = this.storage.getStorageUsage();

    const byStatus: Record<BackupStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      verified: 0,
      expired: 0,
      deleted: 0,
    };
    const byType: Record<BackupType, number> = {
      full: 0,
      incremental: 0,
      differential: 0,
    };

    let lastSuccessfulBackup: Date | undefined;
    let lastBackupStatus: BackupStatus | undefined;
    let recentFailures = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sortedBackups = [...allBackups].sort(
      (a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
    );

    for (const backup of allBackups) {
      if (backup.status !== 'deleted') {
        byStatus[backup.status] = (byStatus[backup.status] || 0) + 1;
      }
      byType[backup.type] = (byType[backup.type] || 0) + 1;

      if ((backup.status === 'completed' || backup.status === 'verified') && backup.completedAt) {
        if (!lastSuccessfulBackup || backup.completedAt > lastSuccessfulBackup) {
          lastSuccessfulBackup = backup.completedAt;
        }
      }

      if (backup.status === 'failed' && backup.completedAt && backup.completedAt > oneDayAgo) {
        recentFailures++;
      }
    }

    if (sortedBackups.length > 0) {
      lastBackupStatus = sortedBackups[0].status;
    }

    const activePlans = this.scheduler.getEnabledPlans().length;

    return {
      totalBackups: allBackups.filter(b => b.status !== 'deleted').length,
      byStatus,
      byType,
      totalStorageUsed: storageUsage.usedSpace,
      totalStorageHuman: storageUsage.usedHuman,
      lastSuccessfulBackup,
      lastBackupStatus,
      activePlans,
      recentFailures,
    };
  }

  /**
   * Get storage usage
   */
  getStorageUsage(): StorageUsage {
    return this.storage.getStorageUsage();
  }

  /**
   * Generate health report
   */
  generateHealthReport(): BackupHealthReport {
    const allBackups = Array.from(this.backups.values());
    const storageUsage = this.storage.getStorageUsage();
    const recoveryPlans = this.recovery.getAllPlans();

    // Update verifier with current state
    this.verifier.registerBackups(allBackups);
    this.verifier.registerRecoveryPlans(recoveryPlans);

    return this.verifier.generateHealthReport(allBackups, storageUsage, recoveryPlans);
  }

  /**
   * Enforce retention policies for all plans
   */
  enforceAllRetentions(): string[] {
    const allDeleted: string[] = [];
    const allBackups = Array.from(this.backups.values());
    const plans = this.scheduler.getAllPlans();

    for (const plan of plans) {
      const toDelete = this.scheduler.enforceRetention(plan, allBackups);
      for (const backupId of toDelete) {
        this.deleteBackup(backupId);
        allDeleted.push(backupId);
      }
    }

    return allDeleted;
  }

  /**
   * Get next backup time for a plan
   */
  getNextBackupTime(planId: string): Date | null {
    return this.scheduler.getNextBackupTime(planId);
  }

  /**
   * Get all schedule info
   */
  getAllScheduleInfo() {
    return this.scheduler.getAllScheduleInfo();
  }

  // ==================== NATS Integration ====================

  /**
   * Connect to NATS for backup events
   */
  private async connectNats(): Promise<void> {
    try {
      const { connect } = await import('nats').catch(() => ({ connect: null }));

      if (!connect) {
        console.log('[BackupService] NATS not available, running without event subscription');
        return;
      }

      this.natsConnection = await connect({
        servers: ['nats://localhost:4222'],
        timeout: 5000,
        reconnect: false,
      });

      console.log('[BackupService] Connected to NATS');

      // Subscribe to relevant events
      await this.subscribeToEvents();
    } catch (error) {
      console.log('[BackupService] NATS connection failed, running without event bus:', error);
    }
  }

  /**
   * Subscribe to NATS backup events
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.natsConnection) return;

    try {
      const subject = `${this.config.natsSubjectPrefix}.>`;
      const subscription = this.natsConnection.subscribe(subject, {
        queue: 'orion-backup',
      });

      (async () => {
        for await (const msg of subscription) {
          try {
            const data = JSON.parse(new TextDecoder().decode(msg.data));
            this.handleNatsMessage(msg.subject, data);
            msg.ack();
          } catch (error) {
            console.error('[BackupService] Error processing NATS message:', error);
          }
        }
      })().catch(console.error);

      this.natsUnsubscribe = async () => {
        await subscription.drain();
      };

      console.log(`[BackupService] Subscribed to ${subject}`);
    } catch (error) {
      console.warn('[BackupService] Failed to subscribe to NATS events:', error);
    }
  }

  /**
   * Handle incoming NATS message
   */
  private handleNatsMessage(subject: string, data: any): void {
    this.emit('nats:message', { subject, data });

    // Handle external backup triggers
    if (subject.includes('trigger') && data.planId) {
      this.triggerBackup(data.planId).catch(console.error);
    }
  }

  /**
   * Publish event to NATS
   */
  private async publishNatsEvent(eventType: string, data: any): Promise<void> {
    if (!this.natsConnection) return;

    try {
      const subject = `${this.config.natsSubjectPrefix}.${eventType}`;
      const message = JSON.stringify({
        type: eventType,
        source: 'orion-backup-service',
        data,
        timestamp: new Date().toISOString(),
      });

      await this.natsConnection.publish(
        subject,
        new TextEncoder().encode(message)
      );
    } catch (error) {
      // Silently fail - NATS is optional
    }
  }

  // ==================== Health Status ====================

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    plansCount: number;
    backupsCount: number;
    storageUsage: number;
    lastBackupStatus?: BackupStatus;
  } {
    const summary = this.getBackupStatusSummary();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (summary.recentFailures > 5) {
      status = 'unhealthy';
    } else if (summary.recentFailures > 2) {
      status = 'degraded';
    }

    if (summary.lastSuccessfulBackup) {
      const hoursSinceLast = (Date.now() - summary.lastSuccessfulBackup.getTime()) / (60 * 60 * 1000);
      if (hoursSinceLast > 48) {
        status = 'unhealthy';
      } else if (hoursSinceLast > 24 && status === 'healthy') {
        status = 'degraded';
      }
    }

    return {
      status,
      isRunning: this.isRunning,
      plansCount: this.scheduler.getAllPlans().length,
      backupsCount: summary.totalBackups,
      storageUsage: summary.totalStorageUsed,
      lastBackupStatus: summary.lastBackupStatus,
    };
  }
}
