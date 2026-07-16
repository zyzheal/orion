/**
 * ACL Service - Artifact access control list management
 */

import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactAclRepository, ArtifactAclEntity } from '../../repositories/ArtifactAclRepository';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('artifact-acl');

export interface CreateAclInput {
  artifactId: string;
  subjectType: 'user' | 'group' | 'service';
  subjectId: string;
  permissions: string[];      // ["read", "write", "admin", "delete"]
  effect?: 'allow' | 'deny';
  createdBy: string;
}

export class AclService {
  constructor(
    private aclRepository: ArtifactAclRepository,
    private artifactRepository: ArtifactRepository
  ) {}

  async createAcl(input: CreateAclInput): Promise<ArtifactAclEntity> {
    const artifact = await this.artifactRepository.findById(input.artifactId);
    if (!artifact) {
      throw new OrionError(`Artifact not found: ${input.artifactId}`, ErrorCode.NOT_FOUND);
    }

    const existing = await this.aclRepository.findByArtifactAndSubject(
      input.artifactId,
      input.subjectType,
      input.subjectId
    );
    if (existing) {
      throw new OrionError(`ACL already exists for subject ${input.subjectType}:${input.subjectId} on artifact ${input.artifactId}`, ErrorCode.OPERATION_FAILED);
    }

    const acl: ArtifactAclEntity = {
      id: uuidv4(),
      tenantId: artifact.tenantId || '00000000-0000-0000-0000-000000000000',
      artifactId: input.artifactId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      permissions: input.permissions,
      effect: input.effect || 'allow',
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.aclRepository.create(acl);
    logger.info({ aclId: created.id, artifactId: input.artifactId, subjectType: input.subjectType, subjectId: input.subjectId }, 'ACL created');
    return created;
  }

  async getAclsByArtifact(artifactId: string): Promise<ArtifactAclEntity[]> {
    return this.aclRepository.findByArtifactId(artifactId);
  }

  async updateAcl(id: string, updates: Partial<Pick<ArtifactAclEntity, 'permissions' | 'effect'>>): Promise<ArtifactAclEntity> {
    const acl = await this.aclRepository.findById(id);
    if (!acl) {
      throw new OrionError(`ACL not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const updated = await this.aclRepository.update(id, {
      ...updates,
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new OrionError(`ACL not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    logger.info({ aclId: id, updates }, 'ACL updated');
    return updated;
  }

  async deleteAcl(id: string): Promise<void> {
    const deleted = await this.aclRepository.delete(id);
    if (!deleted) {
      throw new OrionError(`ACL not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    logger.info({ aclId: id }, 'ACL deleted');
  }
}
