/**
 * SBOM Waiver Service - 漏洞豁免管理
 */

import { EventBusService } from './event-bus-service';
import { DatabasePool } from '../utils/database';
import {
  SbomWaiver,
  SbomWaiverCreateInput,
  SbomWaiverUpdateInput,
  createSbomWaiver,
  WaiverScope,
} from '../models/SbomDocument';
import { SbomWaiverRepository, SbomWaiverEntity } from '../repositories/SbomWaiverRepository';

export interface SbomWaiverListFilter {
  scope?: WaiverScope;
  scopeTarget?: string;
  active?: boolean;
  cveId?: string;
}

export class SbomWaiverService {
  private waiverRepository?: SbomWaiverRepository;
  private eventBus?: EventBusService;
  private pool?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(options?: { eventBus?: EventBusService; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.eventBus = options?.eventBus;
    this.pool = options?.db;
    if (options?.db) {
      this.waiverRepository = new SbomWaiverRepository(options.db);
    }
  }

  async create(input: SbomWaiverCreateInput): Promise<SbomWaiver> {
    const waiver = createSbomWaiver(input);

    if (this.waiverRepository) {
      const db = (this.waiverRepository as any).db;
      await this.pool?.query(
        `INSERT INTO sbom_waivers (id, cve_id, package_name, package_version, reason, approved_by, approved_at, expires_at, scope, scope_target)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [waiver.id, waiver.cveId, waiver.packageName, waiver.packageVersion, waiver.reason, waiver.approvedBy, waiver.approvedAt, waiver.expiresAt, waiver.scope, waiver.scopeTarget ?? null],
      );
    }

    await this.eventBus?.publish('sbom.waiver.created', {
      waiverId: waiver.id,
      cveId: waiver.cveId,
      scope: waiver.scope,
    });
    return waiver;
  }

  async getById(id: string): Promise<SbomWaiverEntity | undefined> {
    if (this.waiverRepository) {
      return await this.waiverRepository.findById(id);
    }
    return undefined;
  }

  async list(filter: SbomWaiverListFilter = {}): Promise<SbomWaiverEntity[]> {
    if (this.waiverRepository) {
      if (filter.active) {
        return await this.waiverRepository.findActive();
      }
      const result = await this.waiverRepository.findAll();
      return result.entities;
    }
    return [];
  }

  async getActiveWaivers(scope?: WaiverScope, target?: string): Promise<SbomWaiverEntity[]> {
    return await this.waiverRepository?.findActive() ?? [];
  }

  async update(id: string, input: SbomWaiverUpdateInput): Promise<SbomWaiverEntity | undefined> {
    if (!this.waiverRepository) return undefined;

    const entity = await this.waiverRepository.findById(id);
    if (!entity) return undefined;

    // Note: repository update not implemented, return entity for now
    await this.eventBus?.publish('sbom.waiver.updated', { waiverId: id });
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    if (this.waiverRepository) {
      return await this.waiverRepository.delete(id);
    }
    return false;
  }
}
