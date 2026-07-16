/**
 * Audit Services Index
 *
 * 审计服务模块导出
 */

export { AuditLogChain, IAuditLogChainRepository } from './AuditLogChain';
export { ImmutableAuditStorage } from './ImmutableAuditStorage';
export { AuditIntegrityVerifier } from './AuditIntegrityVerifier';

// Database-backed services (NEW)
export { AuditRepository } from './AuditRepository';
export { AuditService, AuditServiceError } from './AuditService';
export { AuditComplianceService, type ComplianceCheckResult, type AuditComplianceReport, type AuditCoverageStats } from './AuditComplianceService';
export { AuditRetentionService, type AuditRetentionPolicy, type AuditRetentionPolicyInput, type RetentionCleanupResult } from './AuditRetentionService';

export {
  ChainedAuditLogEntry,
  ChainVerificationResult,
  ChainBreak,
  HashAlgorithm,
  ChainConfig,
  DEFAULT_CHAIN_CONFIG,
  IntegrityReport,
  IntegrityIssue,
  AlertConfig,
  DEFAULT_ALERT_CONFIG,
  VerificationSchedule,
  DEFAULT_VERIFICATION_SCHEDULE,
} from './AuditTypes';

export { ImmutableStorageConfig, DEFAULT_STORAGE_CONFIG } from './ImmutableAuditStorage';