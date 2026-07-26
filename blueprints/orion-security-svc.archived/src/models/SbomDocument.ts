/**
 * SBOM Document models
 *
 * Type definitions and factory functions for SBOM documents, packages,
 * attestations, vulnerabilities, and waivers.
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== SBOM Document ====================

export type SbomFormat = 'cyclonedx' | 'spdx';
export type SbomStatus = 'draft' | 'active' | 'archived';

export interface SbomDocument {
  id: string;
  buildId: string;
  pipelineRunId: string;
  format: SbomFormat;
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount: number;
  status: SbomStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface SbomDocumentCreateInput {
  buildId: string;
  pipelineRunId: string;
  format?: SbomFormat;
  specVersion?: string;
  content?: Record<string, unknown>;
}

export interface SbomDocumentUpdateInput {
  status?: SbomStatus;
  expiresAt?: Date;
}

export function createSbomDocument(input: SbomDocumentCreateInput): SbomDocument {
  const now = new Date();
  return {
    id: `sbom-${uuidv4()}`,
    buildId: input.buildId,
    pipelineRunId: input.pipelineRunId,
    format: input.format || 'cyclonedx',
    specVersion: input.specVersion || '1.4',
    documentId: `doc-${uuidv4()}`,
    content: input.content || {},
    packageCount: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== SBOM Package ====================

export interface SbomPackage {
  id: string;
  sbomId: string;
  name: string;
  version: string;
  purl?: string;
  cpe?: string;
  license?: string;
  supplier?: string;
  sourceLocation?: string;
  checksum?: string;
}

export interface SbomPackageCreateInput {
  sbomId: string;
  name: string;
  version: string;
  purl?: string;
  cpe?: string;
  license?: string;
  supplier?: string;
  sourceLocation?: string;
  checksum?: string;
}

export function createSbomPackage(input: SbomPackageCreateInput): SbomPackage {
  return {
    id: `pkg-${uuidv4()}`,
    sbomId: input.sbomId,
    name: input.name,
    version: input.version,
    purl: input.purl,
    cpe: input.cpe,
    license: input.license,
    supplier: input.supplier,
    sourceLocation: input.sourceLocation,
    checksum: input.checksum,
  };
}

// ==================== SBOM Attestation ====================

export interface SbomAttestation {
  id: string;
  sbomId: string;
  attestationType: 'sigstore-cosign' | 'in-toto';
  signature: string;
  certificate?: string;
  transparencyLogUrl?: string;
  signedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
}

export interface SbomAttestationCreateInput {
  sbomId: string;
  attestationType: 'sigstore-cosign' | 'in-toto';
  signature: string;
  certificate?: string;
  transparencyLogUrl?: string;
}

export function createSbomAttestation(input: SbomAttestationCreateInput): SbomAttestation {
  return {
    id: `att-${uuidv4()}`,
    sbomId: input.sbomId,
    attestationType: input.attestationType,
    signature: input.signature,
    certificate: input.certificate,
    transparencyLogUrl: input.transparencyLogUrl,
    signedAt: new Date(),
    verified: false,
  };
}

// ==================== SBOM Vulnerability ====================

export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SbomVulnerabilityDetail {
  id: string;
  cveId: string;
  severity: VulnSeverity;
  cvssScore?: number;
  affectedPackage: string;
  fixedVersion?: string;
  description?: string;
}

export interface SbomVulnerabilityResult {
  id: string;
  sbomId: string;
  scannedAt: Date;
  totalVulns: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gatePassed: boolean;
  details: SbomVulnerabilityDetail[];
}

export interface SbomVulnerabilityScanInput {
  sbomId: string;
  gatePolicy?: string;
}

export function createSbomVulnerabilityDetail(
  sbomId: string,
  overrides?: Partial<SbomVulnerabilityDetail>
): SbomVulnerabilityDetail {
  return {
    id: `vuln-${uuidv4()}`,
    cveId: '',
    severity: 'medium',
    affectedPackage: '',
    ...overrides,
  };
}

export function createSbomVulnerabilityResult(
  input: SbomVulnerabilityScanInput,
  details: SbomVulnerabilityDetail[]
): SbomVulnerabilityResult {
  const criticalCount = details.filter(d => d.severity === 'critical').length;
  const highCount = details.filter(d => d.severity === 'high').length;
  const mediumCount = details.filter(d => d.severity === 'medium').length;
  const lowCount = details.filter(d => d.severity === 'low').length;

  return {
    id: `scan-${uuidv4()}`,
    sbomId: input.sbomId,
    scannedAt: new Date(),
    totalVulns: details.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    gatePassed: criticalCount === 0,
    details,
  };
}

// ==================== SBOM Waiver ====================

export type WaiverScope = 'sbom' | 'pipeline' | 'tenant';

export interface SbomWaiver {
  id: string;
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt?: Date;
  scope: WaiverScope;
  scopeTarget?: string;
  createdAt: Date;
}

export interface SbomWaiverCreateInput {
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  scope: WaiverScope;
  scopeTarget?: string;
  approvedBy?: string;
  expiresAt?: Date;
}

export interface SbomWaiverUpdateInput {
  reason?: string;
  approvedBy?: string;
  expiresAt?: Date;
}

export function createSbomWaiver(input: SbomWaiverCreateInput): SbomWaiver {
  return {
    id: `waiver-${uuidv4()}`,
    cveId: input.cveId,
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    reason: input.reason,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedBy ? new Date() : undefined,
    expiresAt: input.expiresAt,
    scope: input.scope,
    scopeTarget: input.scopeTarget,
    createdAt: new Date(),
  };
}
