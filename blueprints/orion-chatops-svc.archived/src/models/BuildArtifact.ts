/**
 * BuildArtifact Model
 */

export enum ArtifactType {
  DOCKER_IMAGE = 'DOCKER_IMAGE',
  JAR = 'JAR',
  WAR = 'WAR',
  NPM_PACKAGE = 'NPM_PACKAGE',
  PYTHON_WHEEL = 'PYTHON_WHEEL',
  HELM_CHART = 'HELM_CHART',
  BINARY = 'BINARY',
  OTHER = 'OTHER',
}

export enum ArtifactStorageType {
  LOCAL = 'LOCAL',
  S3 = 'S3',
  GCS = 'GCS',
  ACR = 'ACR',
  HARBOR = 'HARBOR',
  NEXUS = 'NEXUS',
}

export interface Artifact {
  id: string;
  tenantId: string;
  name: string;
  type: ArtifactType;
  storageType: ArtifactStorageType;
  storagePath: string;
  size: number;
  checksum?: string;
  runId: string;
  stageId?: string;
  expiresAt?: Date;
  downloadedCount: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactCreateInput {
  name: string;
  type?: ArtifactType;
  storageType?: ArtifactStorageType;
  storagePath: string;
  size: number;
  checksum?: string;
  runId: string;
  stageId?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}
