/**
 * i18n Internationalization API
 * Phase 3 - Locale and translation management
 */
import apiClient from './client';

export interface I18nLocale {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  enabled: boolean;
  createdAt: string;
}

export interface I18nTranslation {
  id: string;
  tenantId: string;
  localeCode: string;
  namespace: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocaleInput {
  code: string;
  name: string;
  enabled?: boolean;
}

export interface SetTranslationInput {
  localeCode: string;
  namespace: string;
  key: string;
  value: string;
}

export interface BulkTranslationInput {
  localeCode: string;
  namespace: string;
  translations: { key: string; value: string }[];
}

// Locales
export const listLocales = () =>
  apiClient.get<I18nLocale[]>('/i18n/locales');

export const createLocale = (data: CreateLocaleInput) =>
  apiClient.post<I18nLocale>('/i18n/locales', data);

// Translations
export const getTranslations = (localeCode: string, params?: { namespace?: string }) =>
  apiClient.get<Record<string, string>>(`/i18n/translations/${localeCode}`, { params });

export const setTranslation = (data: SetTranslationInput) =>
  apiClient.post<I18nTranslation>('/i18n/translations', data);

export const setBulkTranslations = (data: BulkTranslationInput) =>
  apiClient.post<{ count: number }>('/i18n/translations/bulk', data);

export const deleteTranslation = (localeCode: string, namespace: string, key: string) =>
  apiClient.delete(`/i18n/translations/${localeCode}/${namespace}/${key}`);
