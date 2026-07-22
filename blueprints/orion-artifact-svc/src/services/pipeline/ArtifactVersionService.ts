/**
 * ArtifactVersionService — manages artifact versions from pipeline runs.
 */
import { v4 as uuidv4 } from 'uuid';
import { ArtifactVersionRepository, ArtifactVersionEntity } from '../../repositories/ArtifactVersionRepository.js';

export interface CreateVersionInput {
  tenantId: string;
  pipelineId: string;
  runId?: string;
  stageName?: string;
  artifactName: string;
  version: string;
  commitSha?: string;
  branch?: string;
  storagePath?: string;
  metadata?: Record<string, any>;
}

export class ArtifactVersionService {
  constructor(private repository: ArtifactVersionRepository) {}

  async createVersion(input: CreateVersionInput): Promise<ArtifactVersionEntity> {
    // Check for duplicate
    const existing = await this.repository.findByPipelineIdAndVersion(input.pipelineId, input.version);
    if (existing) {
      throw new Error(`Version ${input.version} already exists for pipeline ${input.pipelineId}`);
    }

    return this.repository.create({
      id: `ver_${uuidv4()}`,
      tenant_id: input.tenantId,
      pipeline_id: input.pipelineId,
      run_id: input.runId || null,
      stage_name: input.stageName || null,
      artifact_name: input.artifactName,
      version: input.version,
      commit_sha: input.commitSha || null,
      branch: input.branch || null,
      storage_path: input.storagePath || null,
      metadata: input.metadata || {},
      environment: null,
      tags: [],
    });
  }

  async getVersionById(id: string): Promise<ArtifactVersionEntity | null> {
    return this.repository.findById(id);
  }

  async promoteVersion(id: string, targetEnvironment: string): Promise<ArtifactVersionEntity> {
    const version = await this.repository.findById(id);
    if (!version) {
      throw new Error('Artifact version not found');
    }
    if (version.environment === targetEnvironment) {
      throw new Error(`Already promoted to ${targetEnvironment}`);
    }
    const result = await this.repository.updateEnvironment(id, targetEnvironment);
    if (!result) throw new Error('Failed to promote version');
    return result;
  }

  async getVersionLineage(id: string): Promise<{ current: ArtifactVersionEntity; ancestors: ArtifactVersionEntity[]; descendants: ArtifactVersionEntity[] }> {
    const current = await this.repository.findById(id);
    if (!current) throw new Error('Artifact version not found');
    // Minimal lineage: return current only (full lineage requires parent_id tracking)
    return { current, ancestors: [], descendants: [] };
  }

  async addTag(id: string, tag: string): Promise<ArtifactVersionEntity> {
    const result = await this.repository.addTag(id, tag);
    if (!result) throw new Error('Artifact version not found');
    return result;
  }

  async removeTag(id: string, tag: string): Promise<void> {
    const result = await this.repository.removeTag(id, tag);
    if (!result) throw new Error('Failed to remove tag');
  }

  async findVersionsByTag(tag: string): Promise<ArtifactVersionEntity[]> {
    return this.repository.findByTag(tag);
  }

  async getDeploymentHistory(pipelineId: string, limit: number): Promise<ArtifactVersionEntity[]> {
    return this.repository.findByPipelineHistory(pipelineId, limit);
  }

  async compareVersions(pipelineId: string, versionA: string, versionB: string): Promise<{ versionA: ArtifactVersionEntity | null; versionB: ArtifactVersionEntity | null }> {
    const a = await this.repository.findByPipelineIdAndVersion(pipelineId, versionA);
    const b = await this.repository.findByPipelineIdAndVersion(pipelineId, versionB);
    return { versionA: a, versionB: b };
  }
}
