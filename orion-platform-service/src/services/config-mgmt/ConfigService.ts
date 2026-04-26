/**
 * ConfigService - Business logic layer for Configuration operations
 */

import { ConfigRepository, ConfigEntry, ConfigHistory } from './ConfigRepository';

export class ConfigServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'ConfigServiceError'; }
}

export interface CreateConfigInput {
  key: string;
  value: Record<string, any>;
  environment?: string;
  description?: string;
  encrypted?: boolean;
  tags?: string[];
  createdBy?: string;
}

export class ConfigService {
  private repository: ConfigRepository;
  constructor(repository?: ConfigRepository) { 
    this.repository = repository || new ConfigRepository();
  }

  async get(tenantId: string, key: string): Promise<ConfigEntry | null> {
    return this.repository.findByKey(tenantId, key);
  }

  async getAll(tenantId: string): Promise<ConfigEntry[]> {
    return this.repository.findAll(tenantId);
  }

  async set(tenantId: string, key: string, value: Record<string, any>, changedBy?: string): Promise<ConfigEntry> {
    if (!tenantId || !key) throw new ConfigServiceError('Tenant ID and key required', 'INVALID_INPUT');
    return this.repository.set(tenantId, key, value, changedBy);
  }

  async delete(tenantId: string, key: string): Promise<boolean> {
    return this.repository.delete(tenantId, key);
  }

  async deleteConfig(tenantId: string, key: string): Promise<boolean> {
    return this.delete(tenantId, key);
  }

  async getHistory(tenantId: string, key: string, limit?: number): Promise<ConfigHistory[]> {
    return this.repository.getHistory(tenantId, key, limit);
  }

  async getConfigVersions(tenantId: string, key: string, limit?: number): Promise<ConfigHistory[]> {
    return this.getHistory(tenantId, key, limit);
  }

  async importConfig(tenantId: string, configs: Record<string, any>, changedBy?: string): Promise<number> {
    let count = 0;
    for (const [key, value] of Object.entries(configs)) {
      await this.repository.set(tenantId, key, value as Record<string, any>, changedBy);
      count++;
    }
    return count;
  }

  async createConfig(tenantId: string, key: string, value?: Record<string, any>): Promise<ConfigEntry>;
  async createConfig(tenantId: string, input: Record<string, any>): Promise<ConfigEntry>;
  async createConfig(tenantId: string, keyOrInput: string | Record<string, any>, value?: Record<string, any>): Promise<ConfigEntry> {
    if (typeof keyOrInput === 'object') {
      const { key, value: v, environment, description, encrypted, tags, createdBy } = keyOrInput;
      return this.repository.set(tenantId, key || '', {
        value: v,
        environment,
        description,
        encrypted: encrypted || false,
        tags: tags || [],
        createdBy
      }, createdBy);
    }
    return this.repository.set(tenantId, keyOrInput, { value: value || {} }, undefined);
  }

  async updateConfig(tenantId: string, key: string, value: Record<string, any>, changedBy?: string): Promise<ConfigEntry> {
    return this.set(tenantId, key, value, changedBy);
  }

  async updateConfigByKey(key: string, value: Record<string, any>): Promise<ConfigEntry | null> {
    return this.repository.updateByKey(key, value);
  }

  async listConfigs(tenantId: string): Promise<ConfigEntry[]> {
    return this.getAll(tenantId);
  }

  async list(tenantId: string, optionsOrEnv?: { environment?: string; status?: string; keyPrefix?: string; tags?: string[]; limit?: number; offset?: number } | string, status?: string, keyPrefix?: string, tags?: string[], limit?: number, offset?: number): Promise<ConfigEntry[]> {
    const options = typeof optionsOrEnv === 'object' && optionsOrEnv !== null ? optionsOrEnv : { environment: optionsOrEnv, status, keyPrefix, tags, limit, offset };
    const { environment: env, status: s, keyPrefix: kp, tags: t, limit: l, offset: o } = options;
    const all = await this.getAll(tenantId);
    let filtered = all;
    if (env) filtered = filtered.filter(c => c.environment === env);
    if (s) filtered = filtered.filter(c => c.status === s);
    if (kp) filtered = filtered.filter(c => c.key.startsWith(kp));
    if (t && t.length > 0) filtered = filtered.filter(c => c.tags?.some(tag => t.includes(tag)));
    if (o) filtered = filtered.slice(o);
    if (l) filtered = filtered.slice(0, l);
    return filtered;
  }

  async getConfig(tenantId: string, key: string): Promise<ConfigEntry | null> {
    return this.get(tenantId, key);
  }

  async getConfigById(id: string): Promise<ConfigEntry | null> {
    return this.repository.findById(id);
  }

  async rollbackConfig(tenantId: string, key: string, version: number): Promise<ConfigEntry | null> {
    const history = await this.getHistory(tenantId, key, version);
    if (history && history.length > 0) {
      const targetVersion = history[Math.max(0, history.length - version)];
      if (targetVersion) {
        return this.set(tenantId, key, targetVersion.old_value || targetVersion.oldValue || {});
      }
    }
    return null;
  }

  async cloneConfig(tenantId: string, sourceKey: string, targetKey: string): Promise<ConfigEntry | null> {
    const source = await this.get(tenantId, sourceKey);
    if (source) {
      return this.set(tenantId, targetKey, source.value);
    }
    return null;
  }

  async getEnvironmentConfigs(environment: string): Promise<ConfigEntry[]> {
    // TODO: implement environment-based filtering
    const all = await this.getAll('default');
    return all.filter(c => c.environment === environment);
  }

  async getConfigById2(id: string): Promise<ConfigEntry | null> {
    return this.repository.findById(id);
  }

  async getConfigVersionsById(configId: string, limit?: number): Promise<ConfigHistory[]> {
    return this.repository.getHistoryByConfigId(configId, limit);
  }
}