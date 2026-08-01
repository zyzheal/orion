/**
 * Artifact Management API Service
 * Artifact registry, promotion, tags, and lifecycle management (M29)
 */
import { api } from './client';

// ---- Types ----

export type ExtendedArtifactType =
  | 'container_image'
  | 'base_image'
  | 'builder_image'
  | 'jar_artifact'
  | 'war_artifact'
  | 'npm_package'
  | 'python_wheel'
  | 'go_module'
  | 'rust_crate'
  | 'helm_chart'
  | 'terraform_module'
  | 'k8s_manifest'
  | 'docker_compose'
  | 'test_report'
  | 'coverage_report'
  | 'performance_report'
  | 'test_artifact'
  | 'sbom'
  | 'signature'
  | 'security_scan_report'
  | 'compliance_report'
  | 'api_doc'
  | 'changelog'
  | 'release_notes';

export type ArtifactStage = 'snapshot' | 'release_candidate' | 'stable' | 'production' | 'archived';
export type ArtifactStatus = 'uploading' | 'available' | 'deprecated' | 'quarantined' | 'deleted';

export interface BuildMetadata {
  pipelineRunId: string;
  gitCommit: string;
  gitBranch: string;
  gitTag?: string;
  builderImage?: string;
  buildTime: string;
  buildDuration?: number;
  buildArgs?: Record<string, string>;
}

export interface SecurityMetadata {
  sbomPath?: string;
  scanResults?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  signed: boolean;
  signer?: string;
  signatureAlgorithm?: string;
}

export interface TestMetadata {
  unitTests?: { passed: number; failed: number; coverage?: number };
  integrationTests?: { passed: number; failed: number };
  performanceTests?: { p99?: number; passed: boolean };
}

export interface DeploymentMetadata {
  environment: string;
  deployedAt: string;
  deployedBy: string;
  status: 'success' | 'failed' | 'pending';
}

export interface ArtifactDependencies {
  baseImage?: string;
  libraries?: Array<{ name: string; version: string; type: 'internal' | 'external' }>;
}

export interface Artifact {
  id: string;
  name: string;
  namespace: string;
  version: string;
  type: ExtendedArtifactType;
  stage: ArtifactStage;
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  sizeBytes: number;
  digest?: string;
  storagePath: string;
  storageBackend?: string;
  build?: BuildMetadata;
  security?: SecurityMetadata;
  tests?: TestMetadata;
  deployments?: DeploymentMetadata[];
  dependencies?: ArtifactDependencies;
  status: ArtifactStatus;
  retentionDays?: number;
  cleanupPolicy?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  tenantId?: string;
  productLineId?: string;
}

export interface CreateArtifactInput {
  name: string;
  namespace: string;
  version: string;
  type: ExtendedArtifactType;
  stage?: ArtifactStage;
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  sizeBytes: number;
  digest?: string;
  storagePath: string;
  storageBackend?: string;
  build?: BuildMetadata;
  security?: SecurityMetadata;
  tests?: TestMetadata;
  dependencies?: ArtifactDependencies;
  retentionDays?: number;
  cleanupPolicy?: string;
  tenantId?: string;
  productLineId?: string;
}

export interface UpdateArtifactInput {
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  retentionDays?: number;
  cleanupPolicy?: string;
}

export interface Tag {
  id: string;
  artifactId: string;
  name: string;
  createdAt: string;
}

export interface DownloadRecord {
  id: string;
  artifactId: string;
  downloadedBy: string;
  downloadedAt: string;
  size: number;
}

export interface PromotionRecord {
  id: string;
  artifactId: string;
  fromStage: ArtifactStage;
  toStage: ArtifactStage;
  promotedBy: string;
  approvedBy?: string;
  reason?: string;
  promotedAt: string;
}

export interface ArtifactStats {
  total: number;
  byStage: Record<ArtifactStage, number>;
  byStatus: Record<ArtifactStatus, number>;
  byType: Record<string, number>;
  totalSizeBytes: number;
  avgSecurityScore?: number;
}

export interface ArtifactTypeStats {
  [key: string]: number;
}

export interface ArtifactListParams {
  namespace?: string;
  type?: string;
  stage?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

// ---- CRUD ----

export function getArtifacts(params?: ArtifactListParams) {
  return api.get<Artifact[]>('/api/artifacts', { params });
}

export function getArtifact(id: string) {
  return api.get<Artifact>(`/api/artifacts/${id}`);
}

export function createArtifact(data: CreateArtifactInput) {
  return api.post<Artifact>('/api/artifacts', data);
}

export function updateArtifact(id: string, data: UpdateArtifactInput) {
  return api.put<Artifact>(`/api/artifacts/${id}`, data);
}

export function deleteArtifact(id: string) {
  return api.delete(`/api/artifacts/${id}`);
}

// ---- Search ----

export function searchArtifacts(query: string, params?: { type?: string; namespace?: string }) {
  return api.get<Artifact[]>('/api/artifacts/search', { params: { q: query, ...params } });
}

// ---- Tags ----

export function getArtifactTags(id: string) {
  return api.get<Tag[]>(`/api/artifacts/${id}/tags`);
}

export function addArtifactTags(id: string, tags: string[]) {
  return api.post<Tag[]>(`/api/artifacts/${id}/tags`, { tags });
}

export function removeArtifactTags(id: string, tags: string[]) {
  return api.delete(`/api/artifacts/${id}/tags`, { data: { tags } });
}

// ---- Download ----

export function downloadArtifact(id: string) {
  return api.get<{ url: string }>(`/api/artifacts/${id}/download`);
}

export function getDownloadHistory(id: string) {
  return api.get<DownloadRecord[]>(`/api/artifacts/${id}/downloads`);
}

// ---- Promotion ----

export function promoteArtifact(
  id: string,
  data: { promotedBy: string; approvedBy?: string; reason?: string }
) {
  return api.post<PromotionRecord>(`/api/artifacts/${id}/promote`, data);
}

export function getCurrentStage(id: string) {
  return api.get<{ stage: ArtifactStage }>(`/api/artifacts/${id}/stage`);
}

export function getPromotionHistory(id: string) {
  return api.get<PromotionRecord[]>(`/api/artifacts/${id}/history`);
}

// ---- Lifecycle ----

export function deprecateArtifact(id: string) {
  return api.post(`/api/artifacts/${id}/deprecate`);
}

export function quarantineArtifact(id: string) {
  return api.post(`/api/artifacts/${id}/quarantine`);
}

// ---- Stats ----

export function getArtifactStats() {
  return api.get<ArtifactStats>('/api/artifacts/stats');
}

export function getArtifactTypeStats() {
  return api.get<ArtifactTypeStats>('/api/artifacts/types');
}

export function getNamespaces() {
  return api.get<string[]>('/api/artifacts/namespaces');
}
