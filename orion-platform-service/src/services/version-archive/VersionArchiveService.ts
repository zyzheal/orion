import { createLogger } from '../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import { VersionArchiveRepository, VersionArchiveEntity } from './VersionArchiveRepository';

const logger = pino({ name: 'VersionArchiveService' });

export interface ArchiveVersionInput {
  resourceType: string;
  resourceId: string;
  snapshot: Record<string, unknown>;
  archivedBy?: string;
  reason?: string;
}

export interface RestoreOptions {
  archiveId: string;
  restoredBy: string;
}

/**
 * VersionArchiveService - Archives and restores versioned resource snapshots
 */
export class VersionArchiveService {
  constructor(
    private readonly archiveRepo: VersionArchiveRepository,
  ) {}

  /**
   * Archive a version (snapshot current resource state)
   */
  async archive(input: ArchiveVersionInput): Promise<VersionArchiveEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, resourceType: input.resourceType, resourceId: input.resourceId }, 'Archiving version');

    // Determine next version number
    const latest = await this.archiveRepo.getLatestVersion(input.resourceType, input.resourceId);
    const nextVersion = latest ? this.incrementVersion(latest.version) : '1.0.0';

    const archive = await this.archiveRepo.create({
      tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      version: nextVersion,
      snapshot: JSON.stringify(input.snapshot),
      archivedBy: input.archivedBy ?? null,
      reason: input.reason ?? null,
    });

    logger.info({ archiveId: archive.id, version: nextVersion }, 'Version archived');
    return archive;
  }

  /**
   * Get archive history for a resource
   */
  async getHistory(resourceType: string, resourceId: string, limit: number = 20): Promise<VersionArchiveEntity[]> {
    return this.archiveRepo.findByResource(resourceType, resourceId, limit);
  }

  /**
   * Get a specific archived version
   */
  async getArchive(archiveId: string): Promise<VersionArchiveEntity> {
    const archive = await this.archiveRepo.findById(archiveId);
    if (!archive) {
      throw new OrionError(`Archive not found: ${archiveId}`, 'NOT_FOUND');
    }
    return archive;
  }

  /**
   * Get a specific version by version string
   */
  async getVersion(resourceType: string, resourceId: string, version: string): Promise<VersionArchiveEntity> {
    const archive = await this.archiveRepo.findByVersion(resourceType, resourceId, version);
    if (!archive) {
      throw new OrionError(`Archive version not found: ${version}`, 'NOT_FOUND');
    }
    return archive;
  }

  /**
   * Restore from archive - returns the snapshot data for the caller to apply
   */
  async restore(options: RestoreOptions): Promise<Record<string, unknown>> {
    const archive = await this.archiveRepo.findById(options.archiveId);
    if (!archive) {
      throw new OrionError(`Archive not found: ${options.archiveId}`, 'NOT_FOUND');
    }

    logger.info(
      { archiveId: options.archiveId, resourceType: archive.resourceType, resourceId: archive.resourceId, restoredBy: options.restoredBy },
      'Restoring from archive',
    );

    return archive.snapshot;
  }

  /**
   * List all archives for a tenant
   */
  async list(options?: { resourceType?: string }): Promise<VersionArchiveEntity[]> {
    const tenantId = getCurrentTenantId();
    const where: Record<string, any> = {};
    if (options?.resourceType) {
      where.resourceType = options.resourceType;
    }
    const result = await this.archiveRepo.findByTenant(tenantId, { where });
    return result.entities;
  }

  /**
   * Delete an archive record
   */
  async delete(archiveId: string): Promise<void> {
    const existing = await this.archiveRepo.findById(archiveId);
    if (!existing) {
      throw new OrionError(`Archive not found: ${archiveId}`, 'NOT_FOUND');
    }
    await this.archiveRepo.delete(archiveId);
    logger.info({ archiveId }, 'Archive deleted');
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return '1.0.0';
    }
    parts[2] += 1;
    return parts.join('.');
  }
}
