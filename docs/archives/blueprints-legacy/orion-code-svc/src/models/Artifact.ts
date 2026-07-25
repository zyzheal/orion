/**
 * Artifact Models - 通用制品模型 (用于 BuildxBuilderService)
 */

export enum ArtifactType {
  DOCKER_IMAGE = 'docker_image',
  BINARY = 'binary',
  LIBRARY = 'library',
  OTHER = 'other',
}

export interface Artifact {
  id: string;
  name: string;
  namespace?: string;
  version?: string;
  type: ArtifactType;
  sizeBytes?: number;
  metadata?: Record<string, any>;
  storagePath?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface ArtifactRegistryService {
  create(data: Partial<Artifact>): Promise<Artifact>;
  findById(id: string): Promise<Artifact | null>;
}

export interface ArtifactRegistryServiceImpl extends ArtifactRegistryService {
  // Extended implementation-specific methods
}
