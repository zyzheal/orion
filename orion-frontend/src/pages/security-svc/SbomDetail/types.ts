/**
 * SBOM Detail types
 * 抽取自 index.tsx (P2-9 Phase 154)
 */
export interface SbomPackage {
  id: string;
  name: string;
  version: string;
  license?: string;
  purl?: string;
  supplier?: string;
}

export interface SbomVulnResult {
  id: string;
  scanner: string;
  totalVulns: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gatePassed: boolean;
  scannedAt: string;
}

export interface SbomVulnDetail {
  id: string;
  cveId: string;
  severity: string;
  cvssScore?: number;
  affectedPackage: string;
  fixedVersion?: string;
  description?: string;
}
