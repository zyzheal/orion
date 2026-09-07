/**
 * ComplianceScan types
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
export type ComplianceLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type FrameworkType = 'owasp' | 'cis' | 'pci' | 'hipaa' | 'soc2' | 'internal';

export interface ComplianceFinding {
  id: string;
  rule: string;
  target: string;
  level: ComplianceLevel;
  status: ScanStatus;
  description: string;
  detectedAt: string;
}

export interface ComplianceBaseline {
  id: string;
  name: string;
  framework: string;
  rules: number;
  lastScan: string;
  passRate: number;
}
