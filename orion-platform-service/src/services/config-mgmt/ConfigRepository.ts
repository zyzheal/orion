/**
 * ConfigRepository - Database layer for Configuration operations
 */

import { DatabasePool } from '../database';

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
  private inMemory: Map<string, ConfigEntry> = new Map();
  constructor(pool?: DatabasePool) { 
    this.pool = pool || null; 
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async findById(id: string): Promise<ConfigEntry | null> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values()).find(c => c.id === id) || null;
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
    return (await this.pool!.query(
      'SELECT * FROM config_entries WHERE tenant_id = $1 AND key = $2',
      [tenantId, key]
    )).rows[0] || null;
  }

  async findAll(tenantId: string): Promise<ConfigEntry[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values()).filter(c => c.tenant_id === tenantId);
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
      return entry;
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
          entry.value = value;
          entry.version += 1;
          entry.updated_at = new Date();
          entry.updatedAt = new Date();
          return entry;
        }
      }
      return null;
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
    const result = await this.pool!.query(
      'DELETE FROM config_entries WHERE tenant_id = $1 AND key = $2',
      [tenantId, key]
    );
    return result.rowCount > 0;
  }

  async getHistory(tenantId: string, key: string, limit: number = 10): Promise<ConfigHistory[]> {
    if (!this.isDbAvailable()) {
      return [];
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
      return [];
    }
    return (await this.pool!.query(
      `SELECT * FROM config_history WHERE config_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [configId, limit]
    )).rows;
  }
}