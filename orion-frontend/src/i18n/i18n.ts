/**
* i18n Engine — lightweight internationalization
* Loads locale packs from src/locales/*.json
*/

import { locales, defaultLocale, supportedLocales } from '@/locales';
import type { LocaleCode } from '@/locales';


function flatten(obj: Record<string, unknown>, prefix: string = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, path));
    } else if (typeof value === 'string') {
      result[path] = value;
    }
  }
  return result;
}

const flatLocales: Record<LocaleCode, Record<string, string>> = {} as Record<LocaleCode, Record<string, string>>;
for (const code of supportedLocales) {
  flatLocales[code] = flatten(locales[code] as Record<string, unknown>);
}

export class I18n {
  private locale: LocaleCode = defaultLocale;
  private readonly listeners = new Set<() => void>();
  get currentLocale(): LocaleCode { return this.locale; }

  setLocale(code: LocaleCode): void {
    if (!flatLocales[code]) throw new Error(`Unsupported locale: ${code}`);
    this.locale = code;
    try { localStorage.setItem('orion:locale', code); } catch { /* ignore */ }
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  t(key: string, fallback?: string): string {
    const val = flatLocales[this.locale]?.[key];
    if (val) return val;
    if (this.locale !== 'zh-CN') {
      const zhVal = flatLocales['zh-CN']?.[key];
      if (zhVal) return zhVal;
    }
    return fallback ?? key;
  }

  tr(key: string, params?: Record<string, string | number>): string {
    let msg = this.t(key);
    if (!params) return msg;
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return msg;
  }

  tc(key: string, count: number): string {
    const form = count === 1 ? 'one' : 'other';
    const pluralKey = `${key}.${form}`;
    const val = flatLocales[this.locale]?.[pluralKey];
    if (val) return val;
    if (this.locale !== 'zh-CN') {
      const zhVal = flatLocales['zh-CN']?.[pluralKey];
      if (zhVal) return zhVal;
    }
    return this.t(key);
  }
}

export const i18n = new I18n();

try {
  const saved = localStorage.getItem('orion:locale');
  if (saved && flatLocales[saved as LocaleCode]) {
    i18n.setLocale(saved as LocaleCode);
  }
} catch { /* ignore */ }
