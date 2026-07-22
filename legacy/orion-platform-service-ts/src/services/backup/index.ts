/**
 * Backup Module Exports
 *
 * TASK-704: Backup & Recovery
 */

// Types
export * from './types';

// Database-backed repositories
export { BackupRepository, BackupJobRecord, BackupRestoreRecord } from './BackupRepository';
export { BackupPlanRepository, BackupPlanRecord } from './BackupPlanRepository';
export { RecoveryRepository, RecoveryExecutionRecord } from './RecoveryRepository';

// Services
export { BackupService, BackupServiceError } from './BackupService';
export { BackupScheduler } from './BackupScheduler';
export { BackupStorage } from './BackupStorage';
export { BackupVerifier } from './BackupVerifier';
export { RecoveryService } from './RecoveryService';

// Auxiliary exports
export type { BackupEventType } from './BackupService';
export { getNextCronTime } from './BackupScheduler';
