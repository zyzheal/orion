/**
 * Artifact Models — domain types for the artifact registry.
 */

export enum ArtifactType {
  JAR = 'jar',
  WAR = 'war',
  DOCKER = 'docker',
  NPM = 'npm',
  HELM = 'helm',
  ZIP = 'zip',
  TAR = 'tar',
  OTHER = 'other',
}

export enum ArtifactStatus {
  AVAILABLE = 'available',
  BUILDING = 'building',
  DEPLOYED = 'deployed',
  DEPRECATED = 'deprecated',
  QUARANTINED = 'quarantined',
  DELETED = 'deleted',
}

export interface Artifact {
  id: string;
  name: string;
  namespace: string;
  version: string;
  type: ArtifactType;
  status: ArtifactStatus;
  sizeBytes: number;
  checksumSha256: string | null;
  checksumSha512: string | null;
  metadata: Record<string, any>;
  storagePath: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArtifactInput {
  name: string;
  namespace: string;
  version: string;
  type: ArtifactType;
  sizeBytes: number;
  checksumSha256?: string;
  checksumSha512?: string;
  metadata?: Record<string, any>;
  storagePath: string;
  createdBy: string;
}

export interface UpdateArtifactInput {
  id: string;
  status?: ArtifactStatus;
  metadata?: Record<string, any>;
}

export interface ArtifactQueryOptions {
  namespace?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  limit?: number;
  offset?: number;
}

export interface ArtifactDownloadOptions {
  artifactId: string;
  downloadedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ArtifactRegistryService {
  create(input: CreateArtifactInput): Promise<Artifact>;
  get(id: string): Promise<Artifact>;
  list(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }>;
  update(input: UpdateArtifactInput): Promise<Artifact>;
  delete(id: string): Promise<void>;
  addTags(id: string, tags: string[]): Promise<void>;
  removeTags(id: string, tags: string[]): Promise<void>;
  getTags(id: string): Promise<any[]>;
  download(options: ArtifactDownloadOptions): Promise<Artifact>;
  getDownloadHistory(id: string): Promise<any[]>;
  search(query: string): Promise<Artifact[]>;
  promote(id: string, targetNamespace: string): Promise<Artifact>;
  deprecate(id: string): Promise<Artifact>;
  quarantine(id: string, reason: string): Promise<Artifact>;
}
