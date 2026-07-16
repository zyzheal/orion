import { randomUUID } from 'crypto';
import { DatabasePool } from '../database';
import { TwinConfigRepository, RegisterTwinInput } from '../../repositories/DigitalTwinEnhancedRepository';

export interface TwinConfig {
  name: string;
  description?: string;
  environment: 'dev' | 'staging' | 'prod';
  services: string[];
  syncInterval?: number;
  dataRetentionDays?: number;
}

export interface TwinState {
  status: 'active' | 'inactive' | 'error' | 'syncing';
  lastSyncAt?: string;
  healthScore: number;
  serviceStates: Record<string, { status: string; latency: number }>;
}

export interface RegisteredTwin {
  id: string;
  tenantId: string;
  config: TwinConfig;
  state: TwinState;
  createdAt: string;
  updatedAt: string;
}

export class TwinConfigService {
  private repo?: TwinConfigRepository;
  private memory = new Map<string, RegisteredTwin>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.repo = new TwinConfigRepository(db);
    }
  }

  // ==================== Repository injection for testing ====================
  setRepository(repo: TwinConfigRepository): void {
    this.repo = repo;
  }

  async registerTwin(
    tenantId: string,
    input: RegisterTwinInput,
  ): Promise<RegisteredTwin> {
    const now = new Date().toISOString();

    // 如果有仓储则使用持久化
    if (this.repo) {
      const entity = await this.repo.insert({
        tenant_id: tenantId,
        twin_name: input.name,
        description: input.description,
        environment: input.environment,
        services: input.services,
        sync_interval: input.syncInterval ?? 60,
        data_retention_days: 30,
      });
      return this.entityToRegisteredTwin(entity);
    }

    // 内存回退（测试兼容）
    const twin: RegisteredTwin = {
      id: randomUUID(),
      tenantId,
      config: {
        name: input.name,
        description: input.description,
        environment: input.environment,
        services: input.services,
        syncInterval: input.syncInterval ?? 60,
        dataRetentionDays: 30,
      },
      state: {
        status: 'active',
        healthScore: 100,
        serviceStates: {},
      },
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(twin.id, twin);
    return twin;
  }

  async configureTwin(
    twinId: string,
    config: Partial<TwinConfig>,
  ): Promise<RegisteredTwin | null> {
    if (this.repo) {
      const twin = await this.repo.findById(twinId);
      if (!twin) return null;

      if (config.name) twin.twinName = config.name;
      if (config.description !== undefined) twin.description = config.description;
      if (config.environment) twin.environment = config.environment;
      if (config.services) twin.services = config.services;
      if (config.syncInterval) twin.syncInterval = config.syncInterval;
      if (config.dataRetentionDays) twin.dataRetentionDays = config.dataRetentionDays;

      const updatedAt = new Date().toISOString();
      const updated = await this.repo.updateStatus(twinId, twin.status, updatedAt);
      if (!updated) return null;
      return this.entityToRegisteredTwin(updated);
    }

    // 内存回退
    const twin = this.memory.get(twinId);
    if (!twin) return null;

    twin.config = { ...twin.config, ...config };
    twin.updatedAt = new Date().toISOString();
    return twin;
  }

  async getTwinState(twinId: string): Promise<TwinState | null> {
    if (this.repo) {
      const twin = await this.repo.findById(twinId);
      if (!twin) return null;
      return {
        status: twin.status,
        lastSyncAt: twin.lastSyncAt,
        healthScore: twin.healthScore,
        serviceStates: twin.serviceStates,
      };
    }

    // 内存回退
    const twin = this.memory.get(twinId);
    if (!twin) return null;
    return twin.state;
  }

  async getTwin(twinId: string): Promise<RegisteredTwin | null> {
    if (this.repo) {
      const entity = await this.repo.findById(twinId);
      if (!entity) return null;
      return this.entityToRegisteredTwin(entity);
    }

    // 内存回退
    return this.memory.get(twinId) ?? null;
  }

  async listTwins(tenantId: string): Promise<RegisteredTwin[]> {
    if (this.repo) {
      const entities = await this.repo.findByTenant(tenantId);
      return entities.map(e => this.entityToRegisteredTwin(e));
    }

    // 内存回退
    return Array.from(this.memory.values()).filter((t) => t.tenantId === tenantId);
  }

  async deleteTwin(twinId: string): Promise<boolean> {
    if (this.repo) {
      return this.repo.deleteById(twinId);
    }

    // 内存回退
    return this.memory.delete(twinId);
  }

  async updateTwinState(
    twinId: string,
    state: Partial<TwinState>,
  ): Promise<RegisteredTwin | null> {
    if (this.repo) {
      const twin = await this.repo.findById(twinId);
      if (!twin) return null;

      if (state.status) twin.status = state.status;
      if (state.healthScore !== undefined) twin.healthScore = state.healthScore;
      if (state.lastSyncAt) twin.lastSyncAt = state.lastSyncAt;

      const updatedAt = new Date().toISOString();
      const updated = await this.repo.updateServiceStates(
        twinId,
        twin.serviceStates,
        twin.healthScore,
        updatedAt,
      );
      if (!updated) return null;
      return this.entityToRegisteredTwin(updated);
    }

    // 内存回退
    const twin = this.memory.get(twinId);
    if (!twin) return null;

    twin.state = { ...twin.state, ...state };
    twin.updatedAt = new Date().toISOString();
    return twin;
  }

  private entityToRegisteredTwin(entity: any): RegisteredTwin {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      config: {
        name: entity.twinName ?? entity.name ?? '',
        description: entity.description,
        environment: entity.environment,
        services: entity.services ?? [],
        syncInterval: entity.syncInterval ?? 60,
        dataRetentionDays: entity.dataRetentionDays ?? 30,
      },
      state: {
        status: entity.status ?? 'active',
        lastSyncAt: entity.lastSyncAt,
        healthScore: entity.healthScore ?? 100,
        serviceStates: entity.serviceStates ?? {},
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
