// orion-platform-service/src/services/security/index.ts
export { SecurityScannerService } from './SecurityScannerService';
export type {
  ScanResult,
  SecurityFinding,
  ScanSummary,
  ScanOptions
} from './SecurityScannerService';

// Re-export related types
export { SecretSanitizer } from '../privacy/SecretSanitizer';
export type { DetectedSecret, SanitizationResult } from '../privacy/SecretSanitizer';

// Phase 3: Compliance & Audit
export { ComplianceFrameworkService } from './ComplianceFrameworkService';
export type {
  CompliancePolicyInput,
  ComplianceGap,
  ComplianceReport,
  ComplianceScoreSummary,
} from './ComplianceFrameworkService';

export { SecurityAuditService } from './SecurityAuditService';
export type {
  AuditPlanInput,
  AuditReport,
} from './SecurityAuditService';

// Supply Chain Security
export { SupplyChainService } from './SupplyChainService';
export type {
  SBOMInput,
  DependencyAnalysisInput,
  MaliciousPackageInfo,
  TyposquattingAlert,
  DependencyPoisoningReport,
} from './SupplyChainService';