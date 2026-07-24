/**
 * TASK-704: BackupVerifier Unit Tests
 */

import { BackupVerifier } from '../BackupVerifier';
import { BackupStorage } from '../BackupStorage';
import { BackupRecord, RecoveryPlan } from '../../types';

describe('BackupVerifier', () => {
  let storage: BackupStorage;
  let verifier: BackupVerifier;

  beforeEach(() => {
    storage = new BackupStorage({
      storagePath: '/tmp/test-verify',
      compressionLevel: 6,
      encryptBackups: false,
    });
    verifier = new BackupVerifier(storage);
  });

  // Helper to create a test backup record
  function createBackupRecord(overrides?: Partial<BackupRecord>): BackupRecord {
    return {
      id: 'backup-test',
      planId: 'plan-1',
      type: 'full',
      status: 'completed',
      size: 1024,
      startedAt: new Date(),
      completedAt: new Date(),
      storageLocation: '/tmp/test-verify/backup-test.bak',
      checksum: 'test-checksum',
      sources: ['database'],
      ...overrides,
    };
  }

  // ==================== Integrity Verification ====================

  describe('verifyIntegrity', () => {
    it('should pass integrity check for a valid backup', async () => {
      // Store the backup data
      const data = Buffer.from('valid backup data content for testing');
      await storage.store('backup-test', 'plan-1', data);

      // Register the backup
      const record = createBackupRecord({ id: 'backup-test' });
      verifier.registerBackups([record]);

      const result = await verifier.verifyIntegrity('backup-test');

      expect(result.status).toBe('passed');
      expect(result.integrityCheck).toBe(true);
      expect(result.verifiedAt).toBeDefined();
    });

    it('should fail integrity check for non-existent backup', async () => {
      await expect(verifier.verifyIntegrity('non-existent'))
        .rejects.toThrow('Backup non-existent not found');
    });

    it('should emit verification:passed event', async () => {
      const data = Buffer.from('valid data');
      await storage.store('backup-pass', 'plan-1', data);
      verifier.registerBackups([createBackupRecord({ id: 'backup-pass' })]);

      let passed = false;
      verifier.on('verification:passed', () => { passed = true; });

      await verifier.verifyIntegrity('backup-pass');
      expect(passed).toBe(true);
    });

    it('should emit verification:failed event when data is empty', async () => {
      // Create a backup record pointing to non-stored data
      verifier.registerBackups([createBackupRecord({
        id: 'backup-empty',
        status: 'completed',
      })]);

      let failed = false;
      verifier.on('verification:failed', () => { failed = true; });

      await verifier.verifyIntegrity('backup-empty');
      expect(failed).toBe(true);
    });
  });

  // ==================== Restore Testing ====================

  describe('testRestore', () => {
    it('should pass restore test for a valid backup', async () => {
      const data = Buffer.from('restorable backup data');
      await storage.store('backup-restore', 'plan-1', data);
      verifier.registerBackups([createBackupRecord({ id: 'backup-restore' })]);

      const result = await verifier.testRestore('backup-restore');

      expect(result.restoreTest).toBe(true);
      expect(result.status).toBe('passed');
    });

    it('should fail restore test for non-existent backup', async () => {
      await expect(verifier.testRestore('non-existent'))
        .rejects.toThrow('Backup non-existent not found');
    });

    it('should fail restore test when integrity fails first', async () => {
      // Create backup record but don't store the actual data
      verifier.registerBackups([createBackupRecord({ id: 'backup-no-data' })]);

      const result = await verifier.testRestore('backup-no-data');
      expect(result.status).toBe('failed');
      expect(result.restoreTest).toBe(false);
    });
  });

  // ==================== Health Reporting ====================

  describe('generateHealthReport', () => {
    it('should generate healthy report with good backups', () => {
      const backups: BackupRecord[] = [
        createBackupRecord({
          id: 'backup-1',
          status: 'verified',
          completedAt: new Date(),
        }),
        createBackupRecord({
          id: 'backup-2',
          status: 'completed',
          completedAt: new Date(Date.now() - 3600000),
        }),
      ];

      const storageUsage = storage.getStorageUsage();
      const recoveryPlans: RecoveryPlan[] = [];

      const report = verifier.generateHealthReport(backups, storageUsage, recoveryPlans);

      expect(report.healthScore).toBeGreaterThan(50);
      expect(report.backupSummary.totalBackups).toBe(2);
      expect(report.generatedAt).toBeDefined();
    });

    it('should generate unhealthy report with no backups', () => {
      const storageUsage = storage.getStorageUsage();
      const recoveryPlans: RecoveryPlan[] = [];

      const report = verifier.generateHealthReport([], storageUsage, recoveryPlans);

      expect(report.healthStatus).toBe('unhealthy');
      expect(report.healthScore).toBeLessThan(50);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate degraded report with recent failures', () => {
      const now = new Date();
      const backups: BackupRecord[] = [
        createBackupRecord({
          id: 'backup-failed-1',
          status: 'failed',
          completedAt: new Date(now.getTime() - 3600000),
          errorMessage: 'Test failure',
        }),
        createBackupRecord({
          id: 'backup-failed-2',
          status: 'failed',
          completedAt: new Date(now.getTime() - 7200000),
          errorMessage: 'Test failure 2',
        }),
      ];

      const storageUsage = storage.getStorageUsage();
      const recoveryPlans: RecoveryPlan[] = [];

      const report = verifier.generateHealthReport(backups, storageUsage, recoveryPlans);

      expect(report.backupSummary.recentFailures).toBeGreaterThan(0);
      expect(report.recentFailures.length).toBeGreaterThan(0);
    });

    it('should track unverified backups', () => {
      const now = new Date();
      const backups: BackupRecord[] = [
        createBackupRecord({
          id: 'backup-unverified',
          status: 'completed',
          completedAt: now,
        }),
      ];

      const storageUsage = storage.getStorageUsage();
      const recoveryPlans: RecoveryPlan[] = [];

      const report = verifier.generateHealthReport(backups, storageUsage, recoveryPlans);

      expect(report.unverifiedBackups).toBeGreaterThan(0);
    });

    it('should report recovery plans status', () => {
      const now = new Date();
      const recoveryPlans: RecoveryPlan[] = [
        {
          id: 'rp-1',
          name: 'Test Recovery Plan',
          rto: 3600000,
          rpo: 86400000,
          steps: [],
          lastTested: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'rp-2',
          name: 'Untested Plan',
          rto: 7200000,
          rpo: 172800000,
          steps: [],
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const report = verifier.generateHealthReport([], storage.getStorageUsage(), recoveryPlans);

      expect(report.recoveryPlansStatus.total).toBe(2);
      expect(report.recoveryPlansStatus.enabled).toBe(2);
    });

    it('should emit health:report event', () => {
      let emitted = false;
      verifier.on('health:report', () => { emitted = true; });

      verifier.generateHealthReport([], storage.getStorageUsage(), []);

      expect(emitted).toBe(true);
    });
  });

  // ==================== Verification History ====================

  describe('getVerification', () => {
    it('should return a verification record', async () => {
      const data = Buffer.from('test data');
      await storage.store('backup-vh', 'plan-1', data);
      verifier.registerBackups([createBackupRecord({ id: 'backup-vh' })]);

      const verification = await verifier.verifyIntegrity('backup-vh');
      const retrieved = verifier.getVerification(verification.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(verification.id);
    });

    it('should return null for non-existent verification', () => {
      const result = verifier.getVerification('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getAllVerifications', () => {
    it('should return all verification records', async () => {
      const data = Buffer.from('test data');
      await storage.store('backup-v1', 'plan-1', data);
      await storage.store('backup-v2', 'plan-1', data);
      verifier.registerBackups([
        createBackupRecord({ id: 'backup-v1' }),
        createBackupRecord({ id: 'backup-v2' }),
      ]);

      await verifier.verifyIntegrity('backup-v1');
      await verifier.verifyIntegrity('backup-v2');

      const all = verifier.getAllVerifications();
      expect(all.length).toBe(2);
    });
  });

  describe('getVerificationsForBackup', () => {
    it('should return verifications for a specific backup', async () => {
      const data = Buffer.from('test data');
      await storage.store('backup-specific', 'plan-1', data);
      verifier.registerBackups([createBackupRecord({ id: 'backup-specific' })]);

      await verifier.verifyIntegrity('backup-specific');
      await verifier.verifyIntegrity('backup-specific');

      const verifications = verifier.getVerificationsForBackup('backup-specific');
      expect(verifications.length).toBe(2);
    });

    it('should return empty array for backup with no verifications', () => {
      const verifications = verifier.getVerificationsForBackup('no-verifications');
      expect(verifications).toEqual([]);
    });
  });
});
