/**
 * TASK-704: Backup Verifier
 *
 * Handles backup integrity verification, restore testing,
 * and backup health reporting.
 */

import { EventEmitter } from 'events';
import {
  BackupRecord,
  BackupVerification,
  BackupHealthReport,
  BackupStatusSummary,
  BackupStatus,
  BackupType,
  StorageUsage,
  RecoveryPlan,
} from './types';
import { BackupStorage } from './BackupStorage';
import { OrionError, ErrorCode } from '../../errors';
import { BackupVerificationRepository } from '../../repositories/BackupVerificationRepository';

/**
 * Backup Verifier - Verifies backup integrity and tests restores
 */
export class BackupVerifier extends EventEmitter {
  /** Reference to storage for checksum and retrieval operations */
  private storage: BackupStorage;

  /** Verification records - migrated to repository */
  private verificationRepository?: BackupVerificationRepository;
  private verifications: Map<string, BackupVerification> = new Map(); // in-memory cache

  /** Backup records reference */
  private backups: Map<string, BackupRecord> = new Map();

  /** Recovery plans reference */
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();

  constructor(storage: BackupStorage, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super();
    this.storage = storage;
    if (db) {
      this.verificationRepository = new BackupVerificationRepository(db);
    }
  }

  /**
   * Register backup records for reference
   */
  registerBackups(backups: BackupRecord[]): void {
    for (const backup of backups) {
      this.backups.set(backup.id, backup);
    }
  }

  /**
   * Update a backup record
   */
  updateBackup(backup: BackupRecord): void {
    this.backups.set(backup.id, backup);
  }

  /**
   * Register recovery plans for reference
   */
  registerRecoveryPlans(plans: RecoveryPlan[]): void {
    for (const plan of plans) {
      this.recoveryPlans.set(plan.id, plan);
    }
  }

  // ==================== Integrity Verification ====================

  /**
   * Verify the integrity of a backup
   * Checks checksum, file existence, and basic structure
   */
  async verifyIntegrity(backupId: string): Promise<BackupVerification> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Backup ${backupId} not found`);
    }

    const verificationId = `verify-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const startedAt = new Date();

    const verification: BackupVerification = {
      id: verificationId,
      backupId,
      status: 'in_progress',
      integrityCheck: false,
      restoreTest: false,
      startedAt,
    };

    this.verifications.set(verificationId, verification);

    // Persist initial verification to repository
    if (this.verificationRepository) {
      try {
        await this.verificationRepository.create({
          id: verificationId,
          backupId,
          status: 'in_progress',
          integrityCheck: false,
          restoreTest: false,
        });
      } catch (err) {
        // Log but don't fail
      }
    }

    try {
      // Step 1: Check checksum
      const checksumResult = this.storage.verifyChecksum(backupId);
      verification.integrityCheck = checksumResult.valid;
      verification.integrityDetails = checksumResult.valid
        ? `Checksum verified: ${checksumResult.expected}`
        : `Checksum mismatch. Expected: ${checksumResult.expected}, Actual: ${checksumResult.actual}`;

      if (!checksumResult.valid) {
        verification.status = 'failed';
        verification.errorMessage = 'Integrity check failed: checksum mismatch';
        this.persistVerificationUpdate(verification);
        this.emit('verification:failed', verification);
        return verification;
      }

      // Step 2: Verify data can be retrieved and decompressed/decrypted
      const retrievedData = await this.storage.retrieve(backupId);
      if (!retrievedData) {
        verification.integrityCheck = false;
        verification.status = 'failed';
        verification.errorMessage = 'Failed to retrieve backup data';
        this.persistVerificationUpdate(verification);
        this.emit('verification:failed', verification);
        return verification;
      }

      // Step 3: Verify data is not empty
      if (retrievedData.length === 0) {
        verification.integrityCheck = false;
        verification.status = 'failed';
        verification.errorMessage = 'Backup data is empty';
        this.persistVerificationUpdate(verification);
        this.emit('verification:failed', verification);
        return verification;
      }

      // All integrity checks passed
      verification.status = 'passed';
      verification.verifiedAt = new Date();

      this.persistVerificationUpdate(verification);
      this.emit('verification:passed', verification);
      return verification;
    } catch (error: any) {
      verification.status = 'failed';
      verification.integrityCheck = false;
      verification.errorMessage = error.message;
      verification.verifiedAt = new Date();

      this.persistVerificationUpdate(verification);
      this.emit('verification:failed', verification);
      return verification;
    }
  }

  // ==================== Restore Testing ====================

  /**
   * Test restore a backup to verify it can be restored
   * Simulates the restore process without actually overwriting data
   */
  async testRestore(backupId: string): Promise<BackupVerification> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Backup ${backupId} not found`);
    }

    const verificationId = `verify-restore-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const startedAt = new Date();

    const verification: BackupVerification = {
      id: verificationId,
      backupId,
      status: 'in_progress',
      integrityCheck: true,
      restoreTest: false,
      startedAt,
      restoreDetails: '',
    };

    this.verifications.set(verificationId, verification);

    // Persist initial verification to repository
    if (this.verificationRepository) {
      try {
        await this.verificationRepository.create({
          id: verificationId,
          backupId,
          status: 'in_progress',
          integrityCheck: true,
          restoreTest: false,
        });
      } catch (err) {
        // Log but don't fail
      }
    }

    try {
      // Step 1: Verify integrity first
      const integrityResult = await this.verifyIntegrity(backupId);
      if (integrityResult.status === 'failed') {
        verification.status = 'failed';
        verification.restoreTest = false;
        verification.restoreDetails = `Integrity check failed: ${integrityResult.errorMessage}`;
        verification.verifiedAt = new Date();
        this.persistVerificationUpdate(verification);
        this.emit('verification:failed', verification);
        return verification;
      }

      // Step 2: Retrieve and process the backup data
      const data = await this.storage.retrieve(backupId);
      if (!data || data.length === 0) {
        verification.status = 'failed';
        verification.restoreTest = false;
        verification.restoreDetails = 'Failed to retrieve backup data';
        verification.verifiedAt = new Date();
        this.persistVerificationUpdate(verification);
        this.emit('verification:failed', verification);
        return verification;
      }

      // Step 3: Simulate restore validation
      // Check that data can be re-compressed/re-stored
      const storeResult = await this.storage.store(
        `test-restore-${backupId}`,
        backup.planId,
        data,
        { compress: false, encrypt: false }
      );

      // Step 4: Verify the re-stored data
      const reStoreVerification = this.storage.verifyChecksum(`test-restore-${backupId}`);
      if (!reStoreVerification.valid) {
        verification.status = 'failed';
        verification.restoreTest = false;
        verification.restoreDetails = 'Re-storage verification failed';
        verification.verifiedAt = new Date();
        this.persistVerificationUpdate(verification);
        this.emit('verification:failed', verification);
        return verification;
      }

      // Step 5: Clean up test data
      this.storage.delete(`test-restore-${backupId}`);

      // All tests passed
      verification.status = 'passed';
      verification.restoreTest = true;
      verification.restoreDetails = `Restore test passed. Data size: ${this.storage.formatBytes(data.length)}`;
      verification.verifiedAt = new Date();

      // Update backup status to verified
      if (backup) {
        backup.status = 'verified';
      }

      this.persistVerificationUpdate(verification);
      this.emit('verification:passed', verification);
      return verification;
    } catch (error: any) {
      verification.status = 'failed';
      verification.restoreTest = false;
      verification.errorMessage = error.message;
      verification.restoreDetails = `Restore test error: ${error.message}`;
      verification.verifiedAt = new Date();

      this.persistVerificationUpdate(verification);
      this.emit('verification:failed', verification);
      return verification;
    }
  }

  // ==================== Health Reporting ====================

  /**
   * Generate a comprehensive backup health report
   */
  generateHealthReport(
    allBackups: BackupRecord[],
    storageUsage: StorageUsage,
    recoveryPlans: RecoveryPlan[]
  ): BackupHealthReport {
    const now = new Date();
    const recommendations: string[] = [];

    // Calculate status summary
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
    const recentFailures: BackupRecord[] = [];
    let unverifiedCount = 0;
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Sort backups by completion time (newest first)
    const sortedBackups = [...allBackups].sort((a, b) => {
      const aTime = a.completedAt?.getTime() || 0;
      const bTime = b.completedAt?.getTime() || 0;
      return bTime - aTime;
    });

    for (const backup of sortedBackups) {
      if (backup.status !== 'deleted') {
        byStatus[backup.status]++;
      }
      byType[backup.type]++;

      if (backup.status === 'completed' || backup.status === 'verified') {
        if (!lastSuccessfulBackup) {
          lastSuccessfulBackup = backup.completedAt;
        }
      }

      if (backup.status === 'failed' && backup.completedAt && backup.completedAt > oneDayAgo) {
        recentFailures.push(backup);
      }

      if (
        backup.status === 'completed' || backup.status === 'failed'
      ) {
        unverifiedCount++;
      }
    }

    if (sortedBackups.length > 0) {
      lastBackupStatus = sortedBackups[0].status;
    }

    const activePlans = allBackups.length > 0
      ? new Set(allBackups.filter(b => b.status !== 'deleted').map(b => b.planId)).size
      : 0;

    // Calculate health score
    let healthScore = 100;

    // Deduct for recent failures
    healthScore -= recentFailures.length * 10;

    // Deduct for unverified backups
    if (unverifiedCount > 0) {
      healthScore -= Math.min(unverifiedCount * 2, 20);
    }

    // Deduct for storage usage
    if (storageUsage.usagePercent > 90) {
      healthScore -= 20;
      recommendations.push('Storage usage is above 90%. Consider expanding storage or adjusting retention policies.');
    } else if (storageUsage.usagePercent > 80) {
      healthScore -= 10;
      recommendations.push('Storage usage is above 80%. Monitor storage growth.');
    }

    // Deduct if no recent successful backup
    if (lastSuccessfulBackup) {
      const hoursSinceLastBackup = (now.getTime() - lastSuccessfulBackup.getTime()) / (60 * 60 * 1000);
      if (hoursSinceLastBackup > 48) {
        healthScore -= 30;
        recommendations.push('No successful backup in the last 48 hours. Investigate backup failures.');
      } else if (hoursSinceLastBackup > 24) {
        healthScore -= 15;
        recommendations.push('No successful backup in the last 24 hours. Check backup schedules.');
      }
    } else {
      healthScore -= 60;
      recommendations.push('No successful backups found. Configure and run backup plans immediately.');
    }

    // Check recovery plans
    const enabledRecoveryPlans = recoveryPlans.filter(p => p.enabled);
    const recentlyTestedPlans = enabledRecoveryPlans.filter(p => {
      if (!p.lastTested) return false;
      const daysSinceTest = (now.getTime() - p.lastTested.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceTest <= 30; // Tested within last 30 days
    });

    if (enabledRecoveryPlans.length > 0 && recentlyTestedPlans.length === 0) {
      healthScore -= 15;
      recommendations.push('No recovery plans have been tested recently. Schedule a recovery drill.');
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine overall health status
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthScore >= 80) {
      healthStatus = 'healthy';
    } else if (healthScore >= 50) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'unhealthy';
      if (recommendations.length === 0) {
        recommendations.push('Backup system health is critically low. Immediate attention required.');
      }
    }

    // Add general recommendations
    if (byStatus.failed > byStatus.completed + byStatus.verified) {
      recommendations.push('More failed backups than successful ones. Review backup configuration.');
    }

    if (unverifiedCount > 5) {
      recommendations.push(`${unverifiedCount} backups are unverified. Run verification tests.`);
    }

    const backupSummary: BackupStatusSummary = {
      totalBackups: allBackups.filter(b => b.status !== 'deleted').length,
      byStatus,
      byType,
      totalStorageUsed: storageUsage.usedSpace,
      totalStorageHuman: storageUsage.usedHuman,
      lastSuccessfulBackup,
      lastBackupStatus,
      activePlans,
      recentFailures: recentFailures.length,
    };

    const report: BackupHealthReport = {
      healthStatus,
      healthScore,
      storageUsage,
      backupSummary,
      recentFailures,
      unverifiedBackups: unverifiedCount,
      recoveryPlansStatus: {
        total: recoveryPlans.length,
        enabled: enabledRecoveryPlans.length,
        lastTestedWithinRpo: recentlyTestedPlans.length,
      },
      recommendations,
      generatedAt: now,
    };

    this.emit('health:report', report);
    return report;
  }

  // ==================== Verification History ====================

  /**
   * Get a verification record
   */
  getVerification(verificationId: string): BackupVerification | null {
    return this.verifications.get(verificationId) || null;
  }

  /**
   * Get all verification records
   */
  getAllVerifications(): BackupVerification[] {
    return Array.from(this.verifications.values());
  }

  /**
   * Get verifications for a specific backup
   */
  getVerificationsForBackup(backupId: string): BackupVerification[] {
    return this.getAllVerifications().filter(v => v.backupId === backupId);
  }

  /**
   * Persist verification update to repository
   */
  private async persistVerificationUpdate(verification: BackupVerification): Promise<void> {
    if (!this.verificationRepository) return;
    try {
      const entity = await this.verificationRepository.findById(verification.id);
      if (entity) {
        await this.verificationRepository.updateStatus(entity.id, verification.status);
        if (verification.integrityCheck !== undefined) {
          await this.verificationRepository.updateIntegrityCheck(entity.id, verification.integrityCheck, verification.integrityDetails);
        }
        if (verification.restoreTest) {
          await this.verificationRepository.updateRestoreTest(entity.id, true, verification.restoreDetails);
        }
      }
    } catch (err) {
      // Log but don't fail
    }
  }
}
