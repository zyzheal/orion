import type { EnvironmentType } from "../types/deploy";
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents an environment record
 */
export interface EnvironmentRecord {
  id: string;
  name: string;
  type: EnvironmentType;
  tenantId: string;
  clusterUrl: string;
  namespace: string;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service responsible for managing deployment environments.
 */
export class EnvironmentService {
  private environments = new Map<string, EnvironmentRecord>();
  private byTenantName = new Map<string, string>(); // `${tenantId}:${name}` -> id

  async listEnvironments(
    tenantId?: string,
  ): Promise<{ data: EnvironmentRecord[]; total: number }> {
    let data = Array.from(this.environments.values());
    if (tenantId) {
      data = data.filter(e => e.tenantId === tenantId);
    }
    return { data: data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), total: data.length };
  }

  async getEnvironment(id: string): Promise<EnvironmentRecord | null> {
    return this.environments.get(id) || null;
  }

  async getEnvironmentByName(
    tenantId: string,
    name: string,
  ): Promise<EnvironmentRecord | null> {
    const key = `${tenantId}:${name}`;
    const id = this.byTenantName.get(key);
    if (!id) return null;
    return this.environments.get(id) || null;
  }

  async createEnvironment(
    data: Omit<EnvironmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<EnvironmentRecord> {
    const key = `${data.tenantId}:${data.name}`;
    if (this.byTenantName.has(key)) {
      throw new Error(`Environment "${data.name}" already exists for tenant ${data.tenantId}`);
    }

    const now = new Date().toISOString();
    const record: EnvironmentRecord = {
      id: uuidv4(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    this.environments.set(record.id, record);
    this.byTenantName.set(key, record.id);
    return record;
  }

  async updateConfig(
    id: string,
    updates: {
      config?: Record<string, unknown>;
      clusterUrl?: string;
      namespace?: string;
    },
  ): Promise<EnvironmentRecord> {
    const existing = this.environments.get(id);
    if (!existing) {
      throw new Error(`Environment ${id} not found`);
    }

    const updated: EnvironmentRecord = {
      ...existing,
      config: updates.config ? { ...existing.config, ...updates.config } : existing.config,
      clusterUrl: updates.clusterUrl ?? existing.clusterUrl,
      namespace: updates.namespace ?? existing.namespace,
      updatedAt: new Date().toISOString(),
    };

    this.environments.set(id, updated);
    return updated;
  }

  async deactivateEnvironment(id: string): Promise<void> {
    const existing = this.environments.get(id);
    if (!existing) {
      throw new Error(`Environment ${id} not found`);
    }
    const updated = { ...existing, isActive: false, updatedAt: new Date().toISOString() };
    this.environments.set(id, updated);
  }
}
