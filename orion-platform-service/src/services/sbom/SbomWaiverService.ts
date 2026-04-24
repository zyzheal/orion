/**
 * SBOM Waiver Service - 漏洞豁免管理
 */

import { EventBusService } from '../event-bus-service';
import {
  SbomWaiver,
  SbomWaiverCreateInput,
  SbomWaiverUpdateInput,
  createSbomWaiver,
  WaiverScope,
} from '../../models/SbomDocument';
import { SbomWaiverRepository, SbomWaiverEntity } from '../../repositories/SbomWaiverRepository';

export interface SbomWaiverListFilter {
  scope?: WaiverScope;
  scopeTarget?: string;
  active?: boolean;
  cveId?: string;
}

export class SbomWaiverService {
  private waiverRepository?: SbomWaiverRepository;
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.eventBus = options?.eventBus;
    if (options?.db) {
      this.waiverRepository = new SbomWaiverRepository(options.db);
    }
  }

  async create(input: SbomWaiverCreateInput): Promise<SbomWaiver> {
    const waiver = createSbomWaiver(input);

    if (this.waiverRepository) {
      await this.waiverRepository.create({
        id: waiver.id,
        vulnerabilityId: waiver.vulnerabilityId ?? '',
        reason: waiver.reason,
        approvedBy: null,
        approvedAt: waiver.createdAt,
        expiresAt: waiver.expiresAt,
      });
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
      return await this.waiverRepository.findAll();
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
