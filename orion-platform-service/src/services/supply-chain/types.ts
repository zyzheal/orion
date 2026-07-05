/**
 * Supply Chain Security Types
 *
 * Shared type definitions for the supply-chain module.
 */

// ==================== SBOM Types ====================

export interface SBOMComponent {
  name: string;
  version: string;
  purl?: string; // Package URL
  license: LicenseInfo;
  supplier?: string;
  dependencies: string[];
  origin?: string;
  checksum?: Record<string, string>;
}

export interface LicenseInfo {
  id: string;
  name?: string;
  isApproved: boolean;
  category: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
}

export interface SBOM {
  id: string;
  artifactId: string;
  format: 'spdx' | 'cyclonedx';
  specVersion: string;
  components: SBOMComponent[];
  dependencies: DependencyNode[];
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
}

// ==================== Dependency Types ====================

export interface DependencyNode {
  name: string;
  version: string;
  scope: 'prod' | 'dev' | 'peer' | 'optional';
  children: DependencyNode[];
  depth: number;
  /** Resolved semver version (set after npm registry resolution) */
  resolvedVersion?: string;
  /** Alias for children, used by npm resolution code */
  dependencies?: DependencyNode[];
  /** Dependency type: 'dependency' | 'devDependency' | 'peer' | 'optional' */
  type?: string;
}

export interface DependencyTree {
  root: DependencyNode;
  totalNodes: number;
  maxDepth: number;
  circularDependencies: string[][];
  vulnerablePaths: Array<{
    path: string[];
    component: string;
    cveId: string;
  }>;
}

// ==================== Vulnerability Types ====================

export interface VulnerabilityReport {
  component: {
    name: string;
    version: string;
    ecosystem?: string;
  };
  source: 'nvd' | 'osv' | 'static';
  cached: boolean;
  vulnerabilities: Array<{
    cveId: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    cvssScore: number | null;
    description: string;
    affectedVersions?: string[];
    remediation?: string;
    publishedAt: string;
  }>;
  queryTime: number;
  scannedAt: Date;
}

// ==================== Compliance Types ====================

export interface CompliancePolicy {
  id: string;
  name: string;
  blockedLicenseCategories: Array<'permissive' | 'copyleft' | 'proprietary' | 'unknown'>;
  maxVulnerabilitySeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  allowUnknownLicenses: boolean;
  requireSignature: boolean;
}

export interface ComplianceResult {
  compliant: boolean;
  policyId: string;
  violations: ComplianceViolation[];
  summary: {
    totalComponents: number;
    compliantComponents: number;
    nonCompliantComponents: number;
    licenseViolations: number;
    vulnerabilityViolations: number;
    signatureMissing: number;
  };
  checkedAt: Date;
}

export interface ComplianceViolation {
  type: 'license' | 'vulnerability' | 'signature' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  component: string;
  version: string;
  reason: string;
  recommendation?: string;
}

// ==================== Supply Chain Report Types ====================

export interface SupplyChainReport {
  tenantId?: string;
  artifactId: string;
  sbomCount: number;
  componentCount: number;
  vulnerabilitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  complianceStatus: 'compliant' | 'non-compliant' | 'unknown';
  riskScore: number;
  generatedAt: Date;
}

// ==================== Package Analysis Input ====================

export interface PackageJsonInput {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
