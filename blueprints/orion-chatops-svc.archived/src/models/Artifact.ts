/**
 * Artifact Model
 */
export type ArtifactType = 'docker' | 'npm' | 'maven' | 'pypi' | 'helm' | 'binary' | 'generic';
export type ArtifactStatus = 'AVAILABLE' | 'DEPRECATED' | 'QUARANTINED' | 'DELETED';

export interface Artifact {
  id: string;
  name: string;
  namespace: string;
  version: string;
  type: ArtifactType;
  status: ArtifactStatus;
  sizeBytes: number;
  checksumSha256: string;
  checksumSha512: string;
  metadata: Record<string, any>;
  storagePath: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  tags?: string[];
}

export interface ArtifactQueryOptions {
  namespace?: string;
  name?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}
