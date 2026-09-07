/**
 * SBOM types
 * 抽取自 index.tsx (P2-9 Phase 134)
 */

export type ComponentType = 'npm' | 'Go' | 'Python' | 'Maven' | 'Docker';
export type ComponentStatus = 'safe' | 'vulnerable' | 'expired';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface SBOMComponent {
  key: string;
  name: string;
  version: string;
  type: ComponentType;
  vulnCount: number;
  license: string;
  lastScan: string;
  status: ComponentStatus;
}

export interface CVEVuln {
  cveId: string;
  severity: Severity;
  cvss: number;
  fixedIn: string;
  description: string;
}

export interface LicenseItem {
  name: string;
  count: number;
  compliant: boolean;
  percentage: number;
}

export interface SbomStats {
  totalComponents: number;
  totalVulns: number;
  licenseViolations: number;
  complianceRate: number;
}
