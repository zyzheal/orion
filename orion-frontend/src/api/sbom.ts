/**
 * SBOM Attestation API Service
 * SBOM documents, vulnerability scanning, waivers, and compliance reports
 */
import { api } from './client';

// ---- Types ----

export interface SbomDocument {
  id: string;
  buildId: string;
  pipelineRunId: string;
  format: 'spdx' | 'cyclonedx';
  specVersion: string;
  documentId: string;
  packageCount: number;
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt?: string;
}

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

export interface SbomVulnerabilityResult {
  id: string;
  sbomId: string;
  scanner: string;
  scannedAt: string;
  totalVulns: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gatePassed: boolean;
  gatePolicy?: string;
}

export interface SbomVulnerabilityDetail {
  id: string;
  resultId: string;
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore?: number;
  affectedPackage: string;
  fixedVersion?: string;
  description?: string;
  references?: Record<string, string>;
}

export interface SbomWaiver {
  id: string;
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  scope: 'global' | 'project' | 'environment';
  scopeTarget?: string;
}

export interface SbomAttestation {
  id: string;
  sbomId: string;
  attestationType: string;
  signature: string;
  certificate?: string;
  transparencyLogUrl?: string;
  signedAt: string;
  verified: boolean;
  verifiedAt?: string;
}

export interface SbomComplianceReport {
  scope: string;
  startDate: string;
  endDate: string;
  totalSboms: number;
  compliantSboms: number;
  complianceRate: number;
  criticalVulns: number;
  waivers: number;
}

// ---- Params ----

export interface SbomDocumentListParams {
  buildId?: string;
  format?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface SbomDocumentInput {
  buildId: string;
  pipelineRunId: string;
  format: 'spdx' | 'cyclonedx';
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
}

export interface SbomWaiverInput {
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  expiresAt: string;
  scope: 'global' | 'project' | 'environment';
  scopeTarget?: string;
}

export interface UpdateSbomWaiverInput {
  reason?: string;
  expiresAt?: string;
  scope?: string;
  scopeTarget?: string;
}

export interface SbomComplianceParams {
  startDate?: string;
  endDate?: string;
  scope?: string;
}

// ---- SBOM Documents ----

export function getSbomDocuments(params?: SbomDocumentListParams) {
  return api.get('/api/v1/sbom/documents', { params });
}

export function getSbomDocument(id: string) {
  return api.get(`/api/v1/sbom/documents/${id}`);
}

export function createSbomDocument(data: SbomDocumentInput) {
  return api.post('/api/v1/sbom/documents', data);
}

export function deleteSbomDocument(id: string) {
  return api.delete(`/api/v1/sbom/documents/${id}`);
}

export function getSbomPackages(sbomId: string) {
  return api.get(`/api/v1/sbom/documents/${sbomId}/packages`);
}

export function downloadSbomDocument(id: string, format?: 'spdx' | 'cyclonedx') {
  return api.get(`/api/v1/sbom/documents/${id}/download`, { params: { format } });
}

// ---- Attestation ----

export function signSbomAttestation(sbomId: string) {
  return api.post(`/api/v1/sbom/attestations/${sbomId}/sign`);
}

export function getSbomAttestation(sbomId: string) {
  return api.get(`/api/v1/sbom/attestations/${sbomId}`);
}

export function verifySbomAttestation(sbomId: string) {
  return api.post(`/api/v1/sbom/attestations/${sbomId}/verify`);
}

// ---- Vulnerability Scanning ----

export function triggerSbomVulnerabilityScan(data: { sbomId: string }) {
  return api.post('/api/v1/sbom/vulnerability/scan', data);
}

export function getSbomVulnerabilityResults(params?: { sbomId?: string }) {
  return api.get('/api/v1/sbom/vulnerability/results', { params });
}

export function getSbomVulnerabilityDetails(resultId: string) {
  return api.get(`/api/v1/sbom/vulnerability/results/${resultId}/details`);
}

export function checkSbomGate(data: { sbomId: string; policy?: string }) {
  return api.post('/api/v1/sbom/vulnerability/gate/check', data);
}

// ---- Waivers ----

export function getSbomWaivers(params?: { scope?: string; target?: string }) {
  return api.get('/api/v1/sbom/waivers', { params });
}

export function createSbomWaiver(data: SbomWaiverInput) {
  return api.post('/api/v1/sbom/waivers', data);
}

export function getSbomWaiver(id: string) {
  return api.get(`/api/v1/sbom/waivers/${id}`);
}

export function updateSbomWaiver(id: string, data: UpdateSbomWaiverInput) {
  return api.put(`/api/v1/sbom/waivers/${id}`, data);
}

export function deleteSbomWaiver(id: string) {
  return api.delete(`/api/v1/sbom/waivers/${id}`);
}

export function getActiveSbomWaivers(params?: { scope?: string; target?: string }) {
  return api.get('/api/v1/sbom/waivers/active', { params });
}

// ---- Compliance Reports ----

export function getSbomComplianceReport(params?: SbomComplianceParams) {
  return api.get('/api/v1/sbom/compliance/report', { params });
}

export function getSbomEo14028Compliance() {
  return api.get('/api/v1/sbom/compliance/eo14028');
}

export function getSbomEuCraCompliance() {
  return api.get('/api/v1/sbom/compliance/eu-cra');
}

// ---- Provenance ----

export function createSbomProvenance(data: {
  buildId: string;
  provenanceType: string;
  content: Record<string, unknown>;
  signature: string;
  builderId: string;
  buildTrigger: string;
  sourceUri: string;
}) {
  return api.post('/api/v1/sbom/provenance', data);
}

export function getSbomProvenance(params?: { buildId?: string }) {
  return api.get('/api/v1/sbom/provenance', { params });
}

export function verifySbomProvenance(id: string) {
  return api.get(`/api/v1/sbom/provenance/${id}/verify`);
}

// ---- Gate ----

export function evaluateSbomGate(buildId: string) {
  return api.post('/api/v1/sbom/gate/evaluate', null, { params: { buildId } });
}

export function getSbomGateHistory(params?: { buildId?: string }) {
  return api.get('/api/v1/sbom/gate/history', { params });
}
