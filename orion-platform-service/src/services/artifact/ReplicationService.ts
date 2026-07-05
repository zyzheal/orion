/**
 * Replication Service - Cross-registry artifact replication
 */

import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactReplicationRepository, ArtifactReplicationEntity } from '../../repositories/ArtifactLifecycleRepository';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('artifact-replication');

export interface CreateReplicationInput {
  artifactId: string;
  sourceRegistry: string;
  targetRegistry: string;
  initiatedBy: string;
}

export class ReplicationService {
  constructor(
    private replicationRepository: ArtifactReplicationRepository,
    private artifactRepository: ArtifactRepository
  ) {}

  async createReplication(input: CreateReplicationInput): Promise<ArtifactReplicationEntity> {
    const artifact = await this.artifactRepository.findById(input.artifactId);
    if (!artifact) {
      throw new OrionError(`Artifact not found: ${input.artifactId}`, ErrorCode.NOT_FOUND);
    }

    const replication: ArtifactReplicationEntity = {
      id: uuidv4(),
      tenantId: artifact.tenantId || '00000000-0000-0000-0000-000000000000',
      artifactId: input.artifactId,
      sourceRegistry: input.sourceRegistry,
      targetRegistry: input.targetRegistry,
      status: 'pending',
      progress: 0,
      errorMessage: null,
      initiatedBy: input.initiatedBy,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.replicationRepository.create(replication);
    logger.info({ replicationId: created.id, artifactId: input.artifactId, source: input.sourceRegistry, target: input.targetRegistry }, 'Replication created');
    return created;
  }

  async getReplicationStatus(id: string): Promise<ArtifactReplicationEntity | null> {
    return this.replicationRepository.findById(id);
  }

  async getReplicationsByArtifact(artifactId: string): Promise<ArtifactReplicationEntity[]> {
    return this.replicationRepository.findByArtifact(artifactId);
  }

  async updateReplicationStatus(
    id: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
    progress?: number,
    errorMessage?: string
  ): Promise<ArtifactReplicationEntity> {
    const updated = await this.replicationRepository.updateStatus(id, status, progress, errorMessage);
    if (!updated) {
      throw new OrionError(`Replication not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    logger.info({ replicationId: id, status, progress }, 'Replication status updated');
    return updated;
  }
}
