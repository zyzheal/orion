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