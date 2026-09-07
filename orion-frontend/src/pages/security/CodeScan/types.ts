/**
 * CodeScan types
 */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export type VulnCategory =
  | 'injection'
  | 'auth'
  | 'xss'
  | 'csrf'
  | 'security_misconfig'
  | 'sensitive_data'
  | 'aam'
  | 'vulnerable_components'
  | 'integrity'
  | 'logging';

export interface ScanRecord {
  id: string;
  target: string;
  branch: string;
  status: ScanStatus;
  totalVulns: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  duration: number;
  startedAt: string;
}

export interface VulnFinding {
  id: string;
  category: VulnCategory;
  severity: SeverityLevel;
  file: string;
  line: number;
  description: string;
  fix?: string;
  scanId: string;
}

export interface ScanCreateInput {
  target: string;
  branch?: string;
}
