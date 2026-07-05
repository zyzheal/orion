/**
 * ConfigRepository - Database layer for Configuration operations
 */

import { DatabasePool } from '../database';
import { ConfigEntryRepository as DbConfigEntryRepository } from '../../repositories/ConfigEntryRepository';

export interface ConfigEntry {
  id: string;
  tenant_id: string;
  key: string;
  value: Record<string, any>;
  version: number;
  environment?: string;
  status?: string;
  description?: string;
  encrypted?: boolean;
  tags?: string[];
  created_by?: string;
  updated_by?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ConfigHistory {
  id: string;
  config_id: string;
  configId?: string;
  changed_by: string | null;
  changedBy?: string;
  old_value: Record<string, any> | null;
  oldValue?: Record<string, any> | null;
  new_value: Record<string, any>;
  newValue?: Record<string, any>;
  key?: string;
  value?: Record<string, any>;
  version?: number;
  changeLog?: string;
  createdBy?: string;
  createdAt?: Date;
  created_at: Date;
}

export class ConfigRepository {
  private pool: DatabasePool | null;
  private repo?: DbConfigEntryRepository;
  private inMemory: Map<string, ConfigEntry> = new Map();
  private memoryHistory: Map<string, ConfigHistory[]> = new Map();
  private memoryKeyToId: Map<string, string> = new Map();
  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
    if (pool) {
      this.repo = new DbConfigEntryRepository(pool);
    }
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async findById(id: string): Promise<ConfigEntry | null> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values()).find(c => c.id === id) || null;
    }
    if (this.repo) {
      const entity = await this.repo.findById(id);
      if (!entity) return null;
      return this.entityToEntry(entity);
    }
    return (await this.pool!.query('SELECT * FROM config_entries WHERE id = $1', [id])).rows[0] || null;
  }

  async findByKey(tenantId: string, key: string): Promise<ConfigEntry | null> {
    if (!this.isDbAvailable()) {
      // Find first entry with matching tenantId and key (regardless of environment)
      for (const entry of this.inMemory.values()) {
        if (entry.tenant_id === tenantId && entry.key === key) {
          return entry;
        }
      }
      return null;
    }
    if (this.repo) {
      const entity = await this.repo.findByKey(tenantId, key);
      if (!entity) return null;
      return this.entityToEntry(entity);
    }
    return (await this.pool!.query(
      'SELECT * FROM config_entries WHERE tenant_id = $1 AND key = $2',
      [tenantId, key]
    )).rows[0] || null;
  }

  async findAll(tenantId: string): Promise<ConfigEntry[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values()).filter(c => c.tenant_id === tenantId);
    }
    if (this.repo) {
      const entities = await this.repo.findByTenantId(tenantId);
      return entities.map(e => this.entityToEntry(e));
    }
    return (await this.pool!.query(
      'SELECT * FROM config_entries WHERE tenant_id = $1 ORDER BY key',
      [tenantId]
    )).rows;
  }

  async set(tenantId: string, key: string, value: Record<string, any>, changedBy?: string): Promise<ConfigEntry> {
    const now = new Date();
    const env = value.environment || 'default';
    const key_ = `${tenantId}:${key}:${env}`;

    if (!this.isDbAvailable()) {
      const existing = this.inMemory.get(key_);
      const oldValue = existing ? existing.value : null;
      const entry: ConfigEntry = {
        id: existing?.id || `config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenant_id: tenantId,
        key,
        value,
        version: (existing?.version || 0) + 1,
        environment: value.environment,
        description: value.description,
        encrypted: value.encrypted,
        tags: value.tags,
        status: 'active',
        created_at: existing?.created_at || now,
        updated_at: now,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      this.inMemory.set(key_, entry);
      this.memoryKeyToId.set(`${tenantId}:${key}:${env}`, entry.id);

      // Record history
      const version = entry.version;
      const historyEntry: ConfigHistory = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        config_id: entry.id,
        changed_by: changedBy || null,
        old_value: oldValue,
        new_value: value,
        key,
        version,
        created_at: now,
        createdBy: changedBy,
        createdAt: now,
      };
      const existingHistory = this.memoryHistory.get(entry.id) || [];
      existingHistory.push(historyEntry);
      this.memoryHistory.set(entry.id, existingHistory);

      return entry;
    }

    if (this.repo) {
      const entity = await this.repo.upsert(tenantId, key, value, changedBy);
      return this.entityToEntry(entity);
    }

    const result = await this.pool!.query(
      `INSERT INTO config_entries (tenant_id, key, value, version, created_at, updated_at)
       VALUES ($1, $2, $3, 1, NOW(), NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, version = config_entries.version + 1, updated_at = NOW()
       RETURNING *`,
      [tenantId, key, value]
    );
    return result.rows[0];
  }

  async updateByKey(key: string, value: Record<string, any>): Promise<ConfigEntry | null> {
    if (!this.isDbAvailable()) {
      for (const [k, entry] of this.inMemory) {
        if (entry.key === key) {
          const oldValue = entry.value;
          entry.value = value;
          entry.version += 1;
          entry.updated_at = new Date();
          entry.updatedAt = new Date();

          // Record history
          const historyEntry: ConfigHistory = {
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            config_id: entry.id,
            changed_by: null,
            old_value: oldValue,
            new_value: value,
            key: entry.key,
            version: entry.version,
            created_at: new Date(),
            createdBy: undefined,
            createdAt: new Date(),
          };
          const existingHistory = this.memoryHistory.get(entry.id) || [];
          existingHistory.push(historyEntry);
          this.memoryHistory.set(entry.id, existingHistory);

          return entry;
        }
      }
      return null;
    }
    if (this.repo) {
      const entity = await this.repo.updateByKey(key, value);
      if (!entity) return null;
      return this.entityToEntry(entity);
    }
    const result = await this.pool!.query(
      `UPDATE config_entries SET value = $1, version = version + 1, updated_at = NOW() WHERE key = $2 RETURNING *`,
      [value, key]
    );
    return result.rows[0] || null;
  }

  async delete(tenantId: string, key: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      // Delete all entries with matching tenantId and key
      const keysToDelete = [];
      for (const [k, entry] of this.inMemory) {
        if (entry.tenant_id === tenantId && entry.key === key) {
          keysToDelete.push(k);
        }
      }
      for (const k of keysToDelete) {
        this.inMemory.delete(k);
      }
      return keysToDelete.length > 0;
    }
    if (this.repo) {
      return this.repo.deleteByKey(tenantId, key);
    }
    const result = await this.pool!.query(
      'DELETE FROM config_entries WHERE tenant_id = $1 AND key = $2',
      [tenantId, key]
    );
    return result.rowCount > 0;
  }

  async getHistory(tenantId: string, key: string, limit: number = 10): Promise<ConfigHistory[]> {
    if (!this.isDbAvailable()) {
      const configId = this.memoryKeyToId.get(`${tenantId}:${key}:default`) || this.memoryKeyToId.get(`${tenantId}:${key}:`);
      if (!configId) return [];
      const history = this.memoryHistory.get(configId) || [];
      return history.slice(-limit).map(e => ({
        id: e.id,
        config_id: e.config_id,
        configId: e.config_id,
        changed_by: e.changed_by ?? null,
        changedBy: e.changed_by ?? undefined,
        old_value: e.old_value,
        oldValue: e.old_value,
        new_value: e.new_value,
        newValue: e.new_value,
        key: e.key,
        version: e.version,
        changeLog: e.changeLog,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
        created_at: e.created_at,
      }));
    }
    if (this.repo) {
      const entities = await this.repo.findHistoryByKey(tenantId, key, limit);
      return entities.map(e => ({
        id: e.id,
        config_id: e.config_id,
        configId: e.config_id,
        changed_by: e.changed_by ?? null,
        changedBy: e.changed_by ?? undefined,
        old_value: e.old_value,
        oldValue: e.old_value,
        new_value: e.new_value,
        newValue: e.new_value,
        key,
        version: e.version,
        changeLog: e.change_log,
        createdBy: e.changed_by,
        createdAt: e.created_at,
        created_at: e.created_at,
      }));
    }
    return (await this.pool!.query(
      `SELECT ch.* FROM config_history ch
       JOIN config_entries c ON ch.config_id = c.id
       WHERE c.tenant_id = $1 AND c.key = $2
       ORDER BY ch.created_at DESC LIMIT $3`,
      [tenantId, key, limit]
    )).rows;
  }

  async getHistoryByConfigId(configId: string, limit: number = 10): Promise<ConfigHistory[]> {
    if (!this.isDbAvailable()) {
      const history = this.memoryHistory.get(configId) || [];
      return history.slice(-limit).map(e => ({
        id: e.id,
        config_id: e.config_id,
        configId: e.config_id,
        changed_by: e.changed_by ?? null,
        changedBy: e.changed_by ?? undefined,
        old_value: e.old_value,
        oldValue: e.old_value,
        new_value: e.new_value,
        newValue: e.new_value,
        key: e.key,
        version: e.version,
        changeLog: e.changeLog,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
        created_at: e.created_at,
      }));
    }
    if (this.repo) {
      const entities = await this.repo.findHistory(configId, limit);
      return entities.map(e => ({
        id: e.id,
        config_id: e.config_id,
        configId: e.config_id,
        changed_by: e.changed_by ?? null,
        changedBy: e.changed_by ?? undefined,
        old_value: e.old_value,
        oldValue: e.old_value,
        new_value: e.new_value,
        newValue: e.new_value,
        version: e.version,
        changeLog: e.change_log,
        createdBy: e.changed_by,
        createdAt: e.created_at,
        created_at: e.created_at,
      }));
    }
    return (await this.pool!.query(
      `SELECT * FROM config_history WHERE config_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [configId, limit]
    )).rows;
  }

  /**
   * 将 Repository Entity 转换为 ConfigEntry
   */
  private entityToEntry(entity: any): ConfigEntry {
    return {
      id: entity.id,
      tenant_id: entity.tenant_id,
      key: entity.key,
      value: entity.value,
      version: entity.version,
      environment: entity.environment,
      status: entity.status,
      description: entity.description,
      encrypted: entity.encrypted,
      tags: entity.tags,
      created_by: entity.created_by,
      updated_by: entity.updated_by,
      createdBy: entity.created_by,
      updatedBy: entity.updated_by,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}