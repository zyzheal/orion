/**
 * Artifact Registry Models
 * 制品仓库数据模型
 */

export enum ArtifactType {
  DOCKER_IMAGE = 'DOCKER_IMAGE',
  HELM_CHART = 'HELM_CHART',
  FUNCTION_PACKAGE = 'FUNCTION_PACKAGE',
  MODEL_FILE = 'MODEL_FILE',
  PLUGIN_PACKAGE = 'PLUGIN_PACKAGE',
  CONFIG_FILE = 'CONFIG_FILE',
  BUILD_OUTPUT = 'BUILD_OUTPUT',
  TEST_REPORT = 'TEST_REPORT'
}

export enum ArtifactStatus {
  UPLOADING = 'UPLOADING',
  AVAILABLE = 'AVAILABLE',
  DEPRECATED = 'DEPRECATED',
  DELETED = 'DELETED',
  QUARANTINED = 'QUARANTINED'
}

export interface Artifact {
  id: string;
  name: string;
  namespace: string;
  version: string;
  type: ArtifactType;
  status: ArtifactStatus;
  sizeBytes: number;
  checksumSha256?: string;
  checksumSha512?: string;
  metadata: Record<string, any>;
  storagePath: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ArtifactTag {
  id: string;
  artifactId: string;
  tag: string;
  createdAt: Date;
}

export interface ArtifactDownload {
  id: string;
  artifactId: string;
  downloadedBy: string;
  downloadedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ArtifactMetadata {
  id: string;
  artifactId: string;
  key: string;
  value: string;
  createdAt: Date;
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
  tags?: string[];
}

export interface ArtifactQueryOptions {
  namespace?: string;
  name?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'sizeBytes';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ArtifactDownloadOptions {
  artifactId: string;
  downloadedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ArtifactStorage {
  upload(file: Buffer, metadata: CreateArtifactInput): Promise<Artifact>;
  download(id: string): Promise<Buffer>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  getMetadata(id: string): Promise<Record<string, any>>;
}

export interface ArtifactRegistryService {
  create(input: CreateArtifactInput): Promise<Artifact>;
  get(id: string): Promise<Artifact>;
  list(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }>;
  update(input: UpdateArtifactInput): Promise<Artifact>;
  delete(id: string): Promise<void>;
  addTags(id: string, tags: string[]): Promise<void>;
  removeTags(id: string, tags: string[]): Promise<void>;
  getTags(id: string): Promise<ArtifactTag[]>;
  download(options: ArtifactDownloadOptions): Promise<Artifact>;
  getDownloadHistory(id: string): Promise<ArtifactDownload[]>;
  search(query: string): Promise<Artifact[]>;
  promote(id: string, targetNamespace: string): Promise<Artifact>;
  deprecate(id: string): Promise<Artifact>;
  quarantine(id: string, reason: string): Promise<Artifact>;
}