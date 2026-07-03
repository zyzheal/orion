import { I18nLocaleRepository, I18nTranslationRepository } from './I18nRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'i18n-service' });

export class I18nService {
  private localeRepo: I18nLocaleRepository;
  private translationRepo: I18nTranslationRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.localeRepo = new I18nLocaleRepository(db);
    this.translationRepo = new I18nTranslationRepository(db);
  }

  // ==================== Locale Management ====================

  async createLocale(input: { localeCode: string; localeName: string; isDefault?: boolean }): Promise<any> {
    const tenantId = getCurrentTenantId();
    return this.localeRepo.create({
      tenant_id: tenantId,
      locale_code: input.localeCode,
      locale_name: input.localeName,
      enabled: true,
      is_default: input.isDefault || false,
    });
  }

  async listLocales(): Promise<any[]> {
    const tenantId = getCurrentTenantId();
    return this.localeRepo.findByTenant(tenantId);
  }

  async listEnabledLocales(): Promise<any[]> {
    const tenantId = getCurrentTenantId();
    return this.localeRepo.findEnabled(tenantId);
  }

  // ==================== Translation Management ====================

  async setTranslation(localeCode: string, namespace: string, key: string, value: string): Promise<any> {
    const tenantId = getCurrentTenantId();
    return this.translationRepo.upsertTranslation(tenantId, localeCode, namespace, key, value);
  }

  async setBulkTranslations(localeCode: string, namespace: string, translations: Record<string, string>): Promise<number> {
    const tenantId = getCurrentTenantId();
    let count = 0;
    for (const [key, value] of Object.entries(translations)) {
      await this.translationRepo.upsertTranslation(tenantId, localeCode, namespace, key, value);
      count++;
    }
    logger.info({ tenantId, localeCode, namespace, count }, 'Bulk translations set');
    return count;
  }

  async getTranslations(localeCode: string, namespace: string): Promise<Record<string, string>> {
    const tenantId = getCurrentTenantId();
    const translations = await this.translationRepo.findByLocaleAndNamespace(tenantId, localeCode, namespace);
    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.key] = t.value;
    }
    return result;
  }

  async getAllTranslations(localeCode: string): Promise<Record<string, Record<string, string>>> {
    const tenantId = getCurrentTenantId();
    const translations = await this.translationRepo.findByLocale(tenantId, localeCode);
    const result: Record<string, Record<string, string>> = {};
    for (const t of translations) {
      if (!result[t.namespace]) result[t.namespace] = {};
      result[t.namespace][t.key] = t.value;
    }
    return result;
  }

  async deleteTranslation(localeCode: string, namespace: string, key: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const translations = await this.translationRepo.findByLocaleAndNamespace(tenantId, localeCode, namespace);
    const target = translations.find((t) => t.key === key);
    if (!target) return false;
    await this.translationRepo.delete(target.id);
    return true;
  }
}
