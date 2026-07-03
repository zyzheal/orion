/**
 * Lifecycle Service - Artifact lifecycle management (expire, retention, promotion)
 */

import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactLifecyclePolicyRepository, ArtifactLifecyclePolicyEntity } from '../../repositories/ArtifactLifecycleRepository';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('artifact-lifecycle');

export interface CreateLifecyclePolicyInput {
  artifactId: string;
  policyType: 'expire' | 'retention' | 'promotion';
  config: Record<string, any>;
  enabled?: boolean;
  createdBy: string;
}

export class LifecycleService {
  constructor(
    private lifecyclePolicyRepository: ArtifactLifecyclePolicyRepository,
    private artifactRepository: ArtifactRepository
  ) {}

  async createPolicy(input: CreateLifecyclePolicyInput): Promise<ArtifactLifecyclePolicyEntity> {
    const artifact = await this.artifactRepository.findById(input.artifactId);
    if (!artifact) {
      throw new OrionError(`Artifact not found: ${input.artifactId}`, ErrorCode.NOT_FOUND);
    }

    const policy: ArtifactLifecyclePolicyEntity = {
      id: uuidv4(),
      tenantId: artifact.tenant_id || '00000000-0000-0000-0000-000000000000',
      artifactId: input.artifactId,
      policyType: input.policyType,
      config: input.config,
      enabled: input.enabled ?? true,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.lifecyclePolicyRepository.create(policy);
    logger.info({ policyId: created.id, artifactId: input.artifactId, policyType: input.policyType }, 'Lifecycle policy created');
    return created;
  }

  async getPoliciesByArtifact(artifactId: string): Promise<ArtifactLifecyclePolicyEntity[]> {
    return this.lifecyclePolicyRepository.findByArtifact(artifactId);
  }

  async updatePolicy(id: string, updates: Partial<Pick<ArtifactLifecyclePolicyEntity, 'config' | 'enabled'>>): Promise<ArtifactLifecyclePolicyEntity> {
    const policy = await this.lifecyclePolicyRepository.findById(id);
    if (!policy) {
      throw new OrionError(`Lifecycle policy not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const updated = await this.lifecyclePolicyRepository.update(id, {
      ...updates,
      updatedAt: new Date(),
    });

    logger.info({ policyId: id, updates }, 'Lifecycle policy updated');
    return updated;
  }

  async deletePolicy(id: string): Promise<void> {
    const deleted = await this.lifecyclePolicyRepository.delete(id);
    if (!deleted) {
      throw new OrionError(`Lifecycle policy not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    logger.info({ policyId: id }, 'Lifecycle policy deleted');
  }
}
