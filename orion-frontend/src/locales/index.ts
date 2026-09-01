/**
 * i18n Locale Index (P4-09)
 * Internationalization language packs for 5 newly created pages:
 *   - AlertRuleEditor
 *   - DashboardTemplateMarket
 *   - CMDBDrift
 *   - TestExecution
 *   - FormRenderer
 *
 * Usage example (when pages are ready for i18n integration):
 *   import { locales, getLocale } from '@/locales';
 *   const t = getLocale('zh-CN');
 *   const title = t.alertRuleEditor.title;
 */

import zhCN from './zh-CN.json';
import enUS from './en-US.json';

export type LocaleCode = 'zh-CN' | 'en-US';

export interface LocalePacks {
  common: Record<string, string>;
  login: Record<string, string | Record<string, string>>;
  dashboard: Record<string, string>;
  pipeline: Record<string, string | Record<string, string>>;
  deploy: Record<string, string | Record<string, string>>;
  ticket: Record<string, string | Record<string, string>>;
}

export const locales: Record<LocaleCode, LocalePacks> = {
  'zh-CN': zhCN as LocalePacks,
  'en-US': enUS as LocalePacks,
};

export const defaultLocale: LocaleCode = 'zh-CN';

export const supportedLocales: LocaleCode[] = Object.keys(locales) as LocaleCode[];

/**
 * Retrieve a locale pack by language code.
 * Falls back to default locale (zh-CN) if the code is unsupported.
 */
export function getLocale(code?: LocaleCode): LocalePacks {
  return locales[code ?? defaultLocale];
}
