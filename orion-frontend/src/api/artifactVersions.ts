/**
 * Artifact Version Browser API
 * Traceability chain, version comparison, and deployment history (GAP-CN-06)
 */
import { api } from './client';

// ---- Types ----

/** Artifact version record from the pipeline engine */
export interface ArtifactVersion {
  id: string;
  tenantId: string;
  pipelineId: string;
  runId: string;
  stageName: string;
  artifactName: string;
  version: string;
  commitSha?: string;
  branch?: string;
  metadata: Record<string, string>;
  storagePath: string;
  createdAt: string;
}

/** Full traceability chain: version -> run -> commit -> deployments */
export interface TraceabilityChain {
  version: ArtifactVersion;
  pipelineRun?: {
    id: string;
    pipelineId: string;
    triggerType: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    context?: Record<string, unknown>;
  };
  deployments?: Array<{
    id: string;
    environment: string;
    status: string;
    deployedAt: string;
    deployedBy?: string;
  }>;
}

/** Deployment history for a pipeline */
export interface DeploymentHistory {
  pipelineId: string;
  versions: Array<{
    version: string;
    commitSha?: string;
    branch?: string;
    createdAt: string;
    deployments: Array<{
      environment: string;
      status: string;
      deployedAt: string;
      deployedBy?: string;
    }>;
  }>;
}

/** Version comparison result */
export interface VersionDiff {
  pipelineId: string;
  versionA: string;
  versionB: string;
  changes: {
    commitDiff?: { from?: string; to?: string };
    branchDiff?: { from?: string; to?: string };
    metadataAdded: string[];
    metadataRemoved: string[];
    metadataChanged: Array<{ key: string; oldValue: string; newValue: string }>;
  };
}

/** Query parameters for version list */
export interface ArtifactVersionQuery {
  pipelineId?: string;
  branch?: string;
  commitSha?: string;
  version?: string;
  artifactName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/** Query result with pagination */
export interface ArtifactVersionListResult {
  versions: ArtifactVersion[];
  total: number;
}

// ---- API Functions ----

/** Get list of artifact versions with filters */
export function getArtifactVersions(params?: ArtifactVersionQuery) {
  return api.get<ArtifactVersionListResult>('/api/v1/artifact-versions', { params });
}

/** Get a single artifact version by ID */
export function getArtifactVersion(id: string) {
  return api.get<ArtifactVersion>(`/api/v1/artifact-versions/${id}`);
}

/** Get full traceability chain for a version */
export function getTraceabilityChain(versionId: string) {
  return api.get<TraceabilityChain>(`/api/v1/artifact-versions/${versionId}/traceability`);
}

/** Get version comparison between two versions */
export function getVersionDiff(pipelineId: string, versionA: string, versionB: string) {
  return api.get<VersionDiff>(`/api/v1/artifact-versions/diff`, {
    params: { pipelineId, versionA, versionB },
  });
}

/** Get deployment history for a pipeline */
export function getDeploymentHistory(pipelineId: string, limit?: number) {
  return api.get<DeploymentHistory>(`/api/v1/artifact-versions/history/${pipelineId}`, {
    params: { limit },
  });
}

/** Trigger deployment of a specific version */
export function deployVersion(versionId: string, data: { environment: string; deployedBy: string }) {
  return api.post(`/api/v1/artifact-versions/${versionId}/deploy`, data);
}

/** Find versions by commit SHA (code traceability) */
export function findVersionsByCommit(commitSha: string) {
  return api.get<ArtifactVersion[]>(`/api/v1/artifact-versions/commit/${commitSha}`);
}
