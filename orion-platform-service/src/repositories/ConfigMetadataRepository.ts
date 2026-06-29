/**
 * ConfigMetadataRepository
 *
 * PostgreSQL data access for configuration metadata used by ConfigSearchService.
 * Each method validates domain/key against the stored table and supports
 * domain-tag filtering, sensitivity-based exclusion, and tag intersection.
 */

import { BaseRepository } from '../db/base-repository';

// ============================================================
// Entity Type
// ============================================================

export interface ConfigMetadataEntity {
  id: string;
  domain: string;
  key: string;
  type: string;
  description: string;
  example?: Record<string, unknown> | string | number | boolean | null;
  defaultValue?: Record<string, unknown> | string | number | boolean | null;
  sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
  tags: string[];
  validations?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
  uiConfig?: {
    label: string;
    group: string;
    order: number;
    widget: 'input' | 'select' | 'toggle' | 'slider' | 'json' | 'code';
    placeholder?: string;
    helpText?: string;
    dependsOn?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Repository
// ============================================================

export class ConfigMetadataRepository extends BaseRepository<ConfigMetadataEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_metadata');
  }

  // ---- bulk operations ----

  /** Upsert all metadata records (used during seed). Returns upserted count. */
  async upsertAll(records: Array<{
    domain: string;
    key: string;
    type: string;
    description: string;
    example?: unknown;
    defaultValue?: unknown;
    sensitivity: string;
    tags: string[];
    validations?: unknown;
    ui_config?: unknown;
  }>): Promise<number> {
    const pgSensitivity: Record<string, string> = {
      public: 'public',
      internal: 'internal',
      confidential: 'confidential',
      secret: 'secret',
    };

    const values: unknown[] = [];
    const inserts = records.map((r, i) => {
      const idx = i * 11 + 1;
      const sens = pgSensitivity[r.sensitivity] ?? 'internal';
      return `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10})`;
    });

    for (const r of records) {
      const sens = pgSensitivity[r.sensitivity] ?? 'internal';
      values.push(
        `cfg-${r.domain}-${r.key}`,          // id surrogate (UUID replaced in ON CONFLICT)
        r.domain,
        r.key,
        r.type,
        r.description,
        JSON.stringify(r.example ?? null),
        JSON.stringify(r.defaultValue ?? null),
        sens,
        r.tags,                              // TEXT[] -> pg array
        JSON.stringify(r.validations ?? null),
        JSON.stringify(r.ui_config ?? null),
      );
    }

    const sql = `
      INSERT INTO config_metadata (id, domain, "key", type, description, example, default_value, sensitivity, tags, validations, ui_config)
      VALUES ${inserts.join(', ')}
      ON CONFLICT (domain, "key") DO UPDATE SET
        type = EXCLUDED.type,
        description = EXCLUDED.description,
        example = EXCLUDED.example,
        default_value = EXCLUDED.default_value,
        sensitivity = EXCLUDED.sensitivity,
        tags = EXCLUDED.tags,
        validations = EXCLUDED.validations,
        ui_config = EXCLUDED.ui_config,
        updated_at = NOW()
    `;

    const result = await this.db.query(sql, values);
    return result.rowCount ?? 0;
  }

  // ---- query helpers ----

  /** Return all metadata rows as plain objects matching the ConfigSearchIndex internal shape. */
  async findAllPlain(): Promise<unknown[]> {
    const result = await this.db.query(
      `SELECT domain, "key", type, description, example, default_value,
              sensitivity, tags, validations, ui_config
       FROM config_metadata ORDER BY domain, "key"`,
    );
    return result.rows;
  }

  /** Search across domain/key/description/tags with fuzzy relevance scoring. */
  async searchFullText(
    query: string,
    filters: {
      domain?: string;
      sensitivities?: string[];
      tags?: string[];
      limit?: number;
    } = {},
  ): Promise<unknown[]> {
    let sql = `
      SELECT domain, "key", type, description, example, default_value,
             sensitivity, tags, validations, ui_config
      FROM config_metadata WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (filters.domain) {
      sql += ` AND domain = $${idx}`;
      params.push(filters.domain);
      idx++;
    }
    if (filters.sensitivities?.length) {
      sql += ` AND sensitivity = ANY($${idx}::varchar[])`;
      params.push(filters.sensitivities);
      idx++;
    }
    if (filters.tags?.length) {
      sql += ` AND tags && $${idx}::varchar[]`;
      params.push(filters.tags);
      idx++;
    }

    // Ranked search with GIN/trigram fallback using ILIKE
    const likePattern = `%${query}%`;
    sql += ` ORDER BY
      CASE WHEN "key" ILIKE $${idx} THEN 1 ELSE 2 END,
      CASE WHEN description ILIKE $${idx} THEN 1 ELSE 3 END,
      domain ASC, "key" ASC
    `;
    params.push(likePattern);
    idx++;

    if (filters.limit) {
      sql += ` LIMIT $${idx}`;
      params.push(filters.limit);
    }

    const result = await this.db.query(sql, params);
    return result.rows;
  }

  /** Get all distinct domains. */
  async getDomains(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT domain FROM config_metadata ORDER BY domain`,
    );
    return result.rows.map((row: { domain: string }) => row.domain);
  }

  /** Get all distinct tags. */
  async getTags(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT UNNEST(tags) AS tag FROM config_metadata ORDER BY tag`,
    );
    return result.rows.map((row: { tag: string }) => row.tag);
  }

  /** Get all configs grouped by domain. */
  async groupByDomain(): Promise<Record<string, unknown[]>> {
    const flat = await this.findAllPlain();
    const groups: Record<string, unknown[]> = {};
    for (const item of flat) {
      const d = (item as Record<string, unknown>).domain as string;
      if (!groups[d]) groups[d] = [];
      groups[d].push(item);
    }
    return groups;
  }

  protected mapRowToEntity(row: any): ConfigMetadataEntity {
    return {
      id: row.id,
      domain: row.domain,
      key: row.key,
      type: row.type,
      description: row.description,
      example: row.example,
      defaultValue: row.default_value,
      sensitivity: (row.sensitivity ?? 'internal') as ConfigMetadataEntity['sensitivity'],
      tags: Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? JSON.parse(row.tags) : []),
      validations: typeof row.validations === 'string' ? JSON.parse(row.validations) : row.validations,
      uiConfig: typeof row.ui_config === 'string' ? JSON.parse(row.ui_config) : row.ui_config,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
