/**
 * SBOM Attestation 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== SbomDocument ====================

export type SbomFormat = 'spdx' | 'cyclonedx';
export type SbomStatus = 'active' | 'expired' | 'revoked';

export interface SbomDocument {
  id: string;
  buildId: string;
  pipelineRunId: string;
  format: SbomFormat;
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  status: SbomStatus;
}

export interface SbomDocumentCreateInput {
  buildId: string;
  pipelineRunId: string;
  format: SbomFormat;
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount?: number;
  expiresAt?: Date;
}

export interface SbomDocumentUpdateInput {
  status?: SbomStatus;
  expiresAt?: Date;
}

export function createSbomDocument(input: SbomDocumentCreateInput): SbomDocument {
  const now = new Date();
  return {
    id: uuidv4(),
    buildId: input.buildId,
    pipelineRunId: input.pipelineRunId,
    format: input.format,
    specVersion: input.specVersion,
    documentId: input.documentId,
    content: input.content,
    packageCount: input.packageCount ?? 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
    status: 'active',
  };
}

// ==================== SbomPackage ====================

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
    id: uuidv4(),
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

// ==================== SbomAttestation ====================

export type AttestationType = 'sigstore-cosign' | 'in-toto';

export interface SbomAttestation {
  id: string;
  sbomId: string;
  attestationType: AttestationType;
  signature: string;
  certificate?: string;
  transparencyLogUrl?: string;
  signedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
}

export interface SbomAttestationCreateInput {
  sbomId: string;
  attestationType: AttestationType;
  signature: string;
  certificate?: string;
  transparencyLogUrl?: string;
}

export function createSbomAttestation(input: SbomAttestationCreateInput): SbomAttestation {
  const now = new Date();
  return {
    id: uuidv4(),
    sbomId: input.sbomId,
    attestationType: input.attestationType,
    signature: input.signature,
    certificate: input.certificate,
    transparencyLogUrl: input.transparencyLogUrl,
    signedAt: now,
    verified: false,
    verifiedAt: undefined,
  };
}

// ==================== SbomVulnerabilityResult ====================

export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SbomVulnerabilityResult {
  id: string;
  sbomId: string;
  scanner: string;
  scannedAt: Date;
  totalVulns: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gatePassed: boolean;
  gatePolicy?: string;
  details: SbomVulnerabilityDetail[];
}

export interface SbomVulnerabilityDetail {
  id: string;
  resultId: string;
  cveId: string;
  severity: VulnSeverity;
  cvssScore?: number;
  affectedPackage: string;
  fixedVersion?: string;
  description?: string;
  references?: Record<string, unknown>;
}

export interface SbomVulnerabilityScanInput {
  sbomId: string;
  scanner?: string;
  gatePolicy?: string;
}

export function createSbomVulnerabilityResult(
  input: SbomVulnerabilityScanInput,
  details: SbomVulnerabilityDetail[]
): SbomVulnerabilityResult {
  const now = new Date();
  const criticalCount = details.filter(d => d.severity === 'critical').length;
  const highCount = details.filter(d => d.severity === 'high').length;
  const mediumCount = details.filter(d => d.severity === 'medium').length;
  const lowCount = details.filter(d => d.severity === 'low').length;

  let gatePassed = true;
  if (input.gatePolicy === 'block-critical') {
    gatePassed = criticalCount === 0;
  } else if (input.gatePolicy === 'block-critical-high') {
    gatePassed = criticalCount === 0 && highCount === 0;
  }

  return {
    id: uuidv4(),
    sbomId: input.sbomId,
    scanner: input.scanner ?? 'grype',
    scannedAt: now,
    totalVulns: details.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    gatePassed,
    gatePolicy: input.gatePolicy,
    details,
  };
}

export function createSbomVulnerabilityDetail(
  resultId: string,
  input: {
    cveId: string;
    severity: VulnSeverity;
    cvssScore?: number;
    affectedPackage: string;
    fixedVersion?: string;
    description?: string;
    references?: Record<string, unknown>;
  }
): SbomVulnerabilityDetail {
  return {
    id: uuidv4(),
    resultId,
    cveId: input.cveId,
    severity: input.severity,
    cvssScore: input.cvssScore,
    affectedPackage: input.affectedPackage,
    fixedVersion: input.fixedVersion,
    description: input.description,
    references: input.references,
  };
}

// ==================== SbomWaiver ====================

export type WaiverScope = 'global' | 'project' | 'environment';

export interface SbomWaiver {
  id: string;
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  scope: WaiverScope;
  scopeTarget?: string;
}

export interface SbomWaiverCreateInput {
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy: string;
  expiresAt: Date;
  scope?: WaiverScope;
  scopeTarget?: string;
}

export interface SbomWaiverUpdateInput {
  reason?: string;
  expiresAt?: Date;
  scope?: WaiverScope;
  scopeTarget?: string;
}

export function createSbomWaiver(input: SbomWaiverCreateInput): SbomWaiver {
  const now = new Date();
  return {
    id: uuidv4(),
    cveId: input.cveId,
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    reason: input.reason,
    approvedBy: input.approvedBy,
    approvedAt: now,
    expiresAt: input.expiresAt,
    scope: input.scope ?? 'global',
    scopeTarget: input.scopeTarget,
  };
}
