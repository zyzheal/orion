/**
 * ContainerScan types
 * 抽取自 index.tsx (P2-9 Phase 133)
 */

export type ScanStatus = 'passed' | 'vulnerable' | 'failed';

export interface ImageScanRecord {
  key: string;
  image: string;
  tag: string;
  scanTime: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  status: ScanStatus;
  engine: string;
}

export interface VulnDistribution {
  severity: string;
  count: number;
  color: string;
  percentage: number;
}

export interface ScanPolicy {
  engine: string;
  frequency: string;
  threshold: string;
  autoBlock: boolean;
}
