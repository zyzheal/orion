/**
 * ArtifactVersion Model - 制品版本追踪
 */

export interface ArtifactVersion {
  id: string;
  tenantId: string;
  pipelineId: string;
  runId: string;
  stageName: string;
  artifactName: string;
  version: string;
  commitSha: string | null;
  branch: string | null;
  metadata: Record<string, string>;
  storagePath: string;
  tags?: string[];
  promotedFrom?: string | null;
  createdAt: Date;
}

export interface ArtifactVersionCreateInput {
  tenantId: string;
  pipelineId: string;
  runId: string;
  stageName: string;
  artifactName: string;
  version: string;
  commitSha?: string;
  branch?: string;
  metadata?: Record<string, string>;
  storagePath: string;
}

export interface ArtifactVersionQueryOptions {
  tenantId?: string;
  pipelineId?: string;
  runId?: string;
  stageName?: string;
  artifactName?: string;
  version?: string;
  commitSha?: string;
  branch?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TraceabilityChain {
  artifactName: string;
  versions: ArtifactVersion[];
  totalPromotions: number;
}

export interface DeploymentHistory {
  versionId: string;
  version: string;
  stageName: string;
  deployedAt: Date;
  environment: string;
  deployedBy: string;
}

export interface VersionDiff {
  pipelineId: string;
  versionA: string;
  versionB: string;
  changes: {
    commitDiff: { from: string | null; to: string | null };
    branchDiff: { from: string | null; to: string | null };
    metadataAdded: string[];
    metadataRemoved: string[];
    metadataChanged: string[];
  };
}
