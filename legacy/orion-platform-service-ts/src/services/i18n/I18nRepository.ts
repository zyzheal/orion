import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface I18nLocaleEntity {
  id: string;
  tenantId: string;
  localeCode: string;
  localeName: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export interface I18nTranslationEntity {
  id: string;
  tenantId: string;
  localeCode: string;
  namespace: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export class I18nLocaleRepository extends BaseRepository<I18nLocaleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'i18n_locales');
  }

  async findByTenant(tenantId: string): Promise<I18nLocaleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM i18n_locales WHERE tenant_id = $1 ORDER BY is_default DESC, locale_code`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(tenantId: string): Promise<I18nLocaleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM i18n_locales WHERE tenant_id = $1 AND enabled = true ORDER BY is_default DESC, locale_code`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): I18nLocaleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      localeCode: row.locale_code,
      localeName: row.locale_name,
      enabled: row.enabled,
      isDefault: row.is_default,
      createdAt: row.created_at,
    };
  }
}

export class I18nTranslationRepository extends BaseRepository<I18nTranslationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'i18n_translations');
  }

  async findByLocaleAndNamespace(tenantId: string, localeCode: string, namespace: string): Promise<I18nTranslationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM i18n_translations WHERE tenant_id = $1 AND locale_code = $2 AND namespace = $3 ORDER BY key`,
      [tenantId, localeCode, namespace],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByLocale(tenantId: string, localeCode: string): Promise<I18nTranslationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM i18n_translations WHERE tenant_id = $1 AND locale_code = $2 ORDER BY namespace, key`,
      [tenantId, localeCode],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertTranslation(
    tenantId: string,
    localeCode: string,
    namespace: string,
    key: string,
    value: string,
  ): Promise<I18nTranslationEntity> {
    const result = await this.db.query(
      `INSERT INTO i18n_translations (tenant_id, locale_code, namespace, key, value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, locale_code, namespace, key)
       DO UPDATE SET value = $5, updated_at = NOW()
       RETURNING *`,
      [tenantId, localeCode, namespace, key, value],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): I18nTranslationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      localeCode: row.locale_code,
      namespace: row.namespace,
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
