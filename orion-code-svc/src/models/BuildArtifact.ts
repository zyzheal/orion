/**
 * Build Artifact Models - 构建产物数据模型
 */

export enum ArtifactType {
  BINARY = 'binary',
  LIBRARY = 'library',
  DOCKER_IMAGE = 'docker_image',
  DOCUMENTATION = 'documentation',
  TEST_REPORT = 'test_report',
  COVERAGE_REPORT = 'coverage_report',
  OTHER = 'other',
}

export enum ArtifactStorageType {
  LOCAL = 'local',
  S3 = 's3',
  OSS = 'oss',
  NEXUS = 'nexus',
  HARBOR = 'harbor',
}

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  runId: string;
  stageId?: string;
  taskId?: string;
  size: number;
  checksum?: string;
  storagePath: string;
  storageType?: ArtifactStorageType;
  downloadCount: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactCreateInput {
  name: string;
  type: ArtifactType;
  runId: string;
  stageId?: string;
  taskId?: string;
  size?: number;
  checksum?: string;
  storagePath?: string;
  storageType?: ArtifactStorageType;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ArtifactQueryOptions {
  runId?: string;
  stageId?: string;
  taskId?: string;
  type?: ArtifactType;
  limit?: number;
  offset?: number;
}

export function createArtifact(input: ArtifactCreateInput): Artifact {
  const now = new Date();
  return {
    id: `artifact-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: input.name,
    type: input.type,
    runId: input.runId,
    stageId: input.stageId,
    taskId: input.taskId,
    size: input.size || 0,
    checksum: input.checksum,
    storagePath: input.storagePath || `/artifacts/${input.runId}/${input.name}`,
    storageType: input.storageType,
    downloadCount: 0,
    expiresAt: input.expiresAt,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };
}

export function recordArtifactDownload(artifact: Artifact): Artifact {
  return {
    ...artifact,
    downloadCount: artifact.downloadCount + 1,
    updatedAt: new Date(),
  };
}
