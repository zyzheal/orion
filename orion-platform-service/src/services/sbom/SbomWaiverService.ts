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

export interface SbomWaiverListFilter {
  scope?: WaiverScope;
  scopeTarget?: string;
  active?: boolean;
  cveId?: string;
}

export class SbomWaiverService {
  private waivers: Map<string, SbomWaiver> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
  }

  async create(input: SbomWaiverCreateInput): Promise<SbomWaiver> {
    const waiver = createSbomWaiver(input);
    this.waivers.set(waiver.id, waiver);

    await this.eventBus?.publish('sbom.waiver.created', {
      waiverId: waiver.id,
      cveId: waiver.cveId,
      scope: waiver.scope,
    });
    return waiver;
  }

  async getById(id: string): Promise<SbomWaiver | undefined> {
    return this.waivers.get(id);
  }

  async list(filter: SbomWaiverListFilter = {}): Promise<SbomWaiver[]> {
    let items = Array.from(this.waivers.values());
    const now = new Date();

    if (filter.cveId) {
      items = items.filter(w => w.cveId === filter.cveId);
    }
    if (filter.scope) {
      items = items.filter(w => w.scope === filter.scope);
    }
    if (filter.scopeTarget) {
      items = items.filter(w => w.scopeTarget === filter.scopeTarget);
    }
    if (filter.active !== undefined && filter.active) {
      items = items.filter(w => w.expiresAt > now);
    }

    return items;
  }

  async getActiveWaivers(scope?: WaiverScope, target?: string): Promise<SbomWaiver[]> {
    return this.list({ active: true, scope, scopeTarget: target });
  }

  async update(id: string, input: SbomWaiverUpdateInput): Promise<SbomWaiver | undefined> {
    const waiver = this.waivers.get(id);
    if (!waiver) return undefined;

    if (input.reason !== undefined) waiver.reason = input.reason;
    if (input.expiresAt !== undefined) waiver.expiresAt = input.expiresAt;
    if (input.scope !== undefined) waiver.scope = input.scope;
    if (input.scopeTarget !== undefined) waiver.scopeTarget = input.scopeTarget;

    this.waivers.set(id, waiver);
    await this.eventBus?.publish('sbom.waiver.updated', { waiverId: id });
    return waiver;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.waivers.delete(id);
    if (deleted) {
      await this.eventBus?.publish('sbom.waiver.deleted', { waiverId: id });
    }
    return deleted;
  }
}
