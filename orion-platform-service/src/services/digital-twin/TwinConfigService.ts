import { randomUUID } from 'crypto';

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

export interface RegisterTwinInput {
  name: string;
  description?: string;
  environment: 'dev' | 'staging' | 'prod';
  services: string[];
  syncInterval?: number;
}

export class TwinConfigService {
  private twins = new Map<string, RegisteredTwin>();

  async registerTwin(
    tenantId: string,
    input: RegisterTwinInput,
  ): Promise<RegisteredTwin> {
    const now = new Date().toISOString();
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
    this.twins.set(twin.id, twin);
    return twin;
  }

  async configureTwin(
    twinId: string,
    config: Partial<TwinConfig>,
  ): Promise<RegisteredTwin | null> {
    const twin = this.twins.get(twinId);
    if (!twin) return null;

    twin.config = { ...twin.config, ...config };
    twin.updatedAt = new Date().toISOString();
    return twin;
  }

  async getTwinState(twinId: string): Promise<TwinState | null> {
    const twin = this.twins.get(twinId);
    if (!twin) return null;
    return twin.state;
  }

  async getTwin(twinId: string): Promise<RegisteredTwin | null> {
    return this.twins.get(twinId) ?? null;
  }

  async listTwins(tenantId: string): Promise<RegisteredTwin[]> {
    return Array.from(this.twins.values()).filter((t) => t.tenantId === tenantId);
  }

  async deleteTwin(twinId: string): Promise<boolean> {
    return this.twins.delete(twinId);
  }

  async updateTwinState(
    twinId: string,
    state: Partial<TwinState>,
  ): Promise<RegisteredTwin | null> {
    const twin = this.twins.get(twinId);
    if (!twin) return null;

    twin.state = { ...twin.state, ...state };
    twin.updatedAt = new Date().toISOString();
    return twin;
  }
}
