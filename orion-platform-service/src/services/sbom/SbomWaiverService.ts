/**
 * SbomWaiverService - SBOM Vulnerability Waiver Management
 *
 * Provides operations for managing waivers for known vulnerabilities
 * in SBOM documents.
 */

import pino from 'pino';
import { SbomWaiverRepository, SbomWaiverEntity } from '../../repositories/SbomWaiverRepository';
import { DatabasePool } from '../database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Input Interfaces ====================

export interface CreateWaiverInput {
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy: string;
  expiresAt: Date;
  scope?: string;
  scopeTarget?: string;
}

export interface UpdateWaiverInput {
  reason?: string;
  expiresAt?: Date;
  approvedBy?: string;
}

export interface ListWaiversFilter {
  scope?: string;
  scopeTarget?: string;
  active?: boolean;
  cveId?: string;
}

// ==================== SbomWaiverService ====================

export class SbomWaiverService {
  private waiverRepo: SbomWaiverRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.waiverRepo = new SbomWaiverRepository(db);
    }
  }

  /**
   * Set repository after construction (for lazy initialization)
   */
  setRepository(waiverRepo: SbomWaiverRepository): void {
    this.waiverRepo = waiverRepo;
  }

  // ==================== Waiver CRUD ====================

  /**
   * Create a new waiver
   */
  async create(input: CreateWaiverInput): Promise<SbomWaiverEntity> {
    if (!this.waiverRepo) {
      const mockId = this.generateId();
      return {
        id: mockId,
        cveId: input.cveId,
        packageName: input.packageName,
        packageVersion: input.packageVersion,
        reason: input.reason,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
        expiresAt: input.expiresAt,
        scope: input.scope ?? null,
        scopeTarget: input.scopeTarget ?? null,
      };
    }

    const now = new Date();
    const entity = await this.waiverRepo.create({
      id: this.generateId(),
      cve_id: input.cveId,
      package_name: input.packageName,
      package_version: input.packageVersion,
      reason: input.reason,
      approved_by: input.approvedBy,
      expires_at: input.expiresAt,
      scope: input.scope,
      scope_target: input.scopeTarget,
    });

    logger.info({ waiverId: entity.id, cveId: input.cveId, package: input.packageName }, '[SbomWaiver] Waiver created');
    return entity;
  }

  /**
   * Get waiver by ID
   */
  async getById(id: string): Promise<SbomWaiverEntity | null> {
    if (!this.waiverRepo) {
      return null;
    }
    const result = await this.waiverRepo.findById(id);
    return result ?? null;
  }

  /**
   * List waivers with filtering
   */
  async list(filter: ListWaiversFilter = {}): Promise<SbomWaiverEntity[]> {
    if (!this.waiverRepo) {
      return [];
    }

    let waivers: SbomWaiverEntity[];

    if (filter.active) {
      waivers = await this.waiverRepo.findActive();
    } else if (filter.cveId) {
      waivers = await this.waiverRepo.findByCveId(filter.cveId);
    } else {
      const result = await this.waiverRepo.findAll({});
      waivers = result.entities;
    }

    // Apply additional filters
    return waivers.filter(w => {
      if (filter.scope && w.scope !== filter.scope) return false;
      if (filter.scopeTarget && w.scopeTarget !== filter.scopeTarget) return false;
      if (filter.active && new Date(w.expiresAt) <= new Date()) return false;
      return true;
    });
  }

  /**
   * Get active waivers
   */
  async getActiveWaivers(scope?: string, target?: string): Promise<SbomWaiverEntity[]> {
    if (!this.waiverRepo) {
      return [];
    }

    const now = new Date();
    let waivers = await this.waiverRepo.findActive();

    // Filter by scope/target
    if (scope || target) {
      waivers = waivers.filter(w => {
        if (scope && w.scope !== scope) return false;
        if (target && w.scopeTarget !== target) return false;
        return true;
      });
    }

    return waivers;
  }

  /**
   * Update a waiver
   */
  async update(id: string, updates: UpdateWaiverInput): Promise<SbomWaiverEntity | null> {
    if (!this.waiverRepo) {
      return null;
    }

    const existing = await this.waiverRepo.findById(id);
    if (!existing) {
      return null;
    }

    const fields: Record<string, any> = {};
    if (updates.reason !== undefined) fields.reason = updates.reason;
    if (updates.expiresAt !== undefined) fields.expires_at = updates.expiresAt;

    if (Object.keys(fields).length > 0) {
      await this.waiverRepo.update(id, fields as any);
    }

    logger.info({ waiverId: id }, '[SbomWaiver] Waiver updated');
    const result = await this.waiverRepo.findById(id);
    return result ?? null;
  }

  /**
   * Delete a waiver
   */
  async delete(id: string): Promise<boolean> {
    if (!this.waiverRepo) {
      return false;
    }

    const deleted = await this.waiverRepo.delete(id);
    if (deleted) {
      logger.info({ waiverId: id }, '[SbomWaiver] Waiver deleted');
    }
    return deleted;
  }

  // ==================== Check Waiver ====================

  /**
   * Check if a vulnerability has an active waiver
   */
  async checkWaiver(cveId: string, packageName: string, packageVersion: string): Promise<{
    waived: boolean;
    waiver: SbomWaiverEntity | null;
  }> {
    const activeWaivers = await this.getActiveWaivers();

    const waiver = activeWaivers.find(w =>
      w.cveId === cveId &&
      w.packageName === packageName &&
      (w.packageVersion === packageVersion || w.packageVersion === '*')
    );

    return {
      waived: !!waiver,
      waiver: waiver ?? null,
    };
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `waiver-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default SbomWaiverService;