/**
 * ArtifactService - Business logic layer for Artifact operations
 */

import { ArtifactRepository, Artifact } from './ArtifactRepository';

export class ArtifactServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'ArtifactServiceError'; }
}

export class ArtifactService {
  private repository: ArtifactRepository;
  constructor(repository: ArtifactRepository) { this.repository = repository; }

  async getArtifact(id: string): Promise<Artifact> {
    const artifact = await this.repository.findById(id);
    if (!artifact) throw new ArtifactServiceError(`Artifact not found: ${id}`, 'NOT_FOUND');
    return artifact;
  }

  async listArtifacts(tenantId: string, limit?: number): Promise<Artifact[]> {
    return this.repository.findAll(tenantId, limit);
  }

  async searchByName(tenantId: string, name: string): Promise<Artifact[]> {
    return this.repository.findByName(tenantId, name);
  }

  async uploadArtifact(tenantId: string, name: string, version: string, type: string, sizeBytes: number, checksum: string, storageLocation: string, metadata?: Record<string, any>): Promise<Artifact> {
    if (!tenantId || !name || !version) throw new ArtifactServiceError('Tenant ID, name, version required', 'INVALID_INPUT');
    return this.repository.create(tenantId, name, version, type, sizeBytes, checksum, storageLocation, metadata);
  }

  async deleteArtifact(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }
}