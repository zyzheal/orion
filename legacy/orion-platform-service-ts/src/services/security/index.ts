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
// Note: ComplianceFrameworkService merged into src/services/compliance/ComplianceService.ts
// Import ComplianceService from '../compliance' for policy, evaluation, evidence, gap-analysis, framework features

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
  DependencyNode,
  CycloneDXComponent,
  CycloneDXSBOM,
} from './SupplyChainService';

// Degradation Management
export { DegradationManager, DEGRADATION_LEVELS } from './DegradationManager';
export type {
  DegradationLevel,
  DegradationEvent,
  DegradationStateChange,
} from './DegradationManager';

// In-Memory Fallback Store
export { InMemoryScanStore } from './InMemoryScanStore';
export type { ScanStats } from './InMemoryScanStore';