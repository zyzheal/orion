import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { i18n } from './i18n';
import type { LocaleCode } from '@/locales';

type IntlAction = { type: 'SET_LOCALE'; locale: LocaleCode };

interface IntlContextValue {
  t: (key: string, fallback?: string) => string;
  tr: (key: string, params?: Record<string, string | number>) => string;
  tc: (key: string, count: number) => string;
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
}

const IntlContext = createContext<IntlContextValue | null>(null);

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, dispatch] = useReducer(
    (_: LocaleCode, action: IntlAction) => action.locale,
    i18n.currentLocale,
  );
  const unmountedRef = useRef(false);

  React.useEffect(() => {
    const unsub = i18n.subscribe(() => {
      if (!unmountedRef.current) dispatch({ type: 'SET_LOCALE', locale: i18n.currentLocale });
    });
    return () => {
      unmountedRef.current = true;
      unsub();
    };
  }, []);

  const value = useCallback(
    (): IntlContextValue => ({
      t: (key, fallback) => i18n.t(key, fallback),
      tr: (key, params) => i18n.tr(key, params),
      tc: (key, count) => i18n.tc(key, count),
      locale,
      setLocale: (code) => { i18n.setLocale(code); dispatch({ type: 'SET_LOCALE', locale: code }); },
    }),
    [locale],
  );

  return <IntlContext.Provider value={value()}>{children}</IntlContext.Provider>;
}

export function useIntl(): IntlContextValue {
  const ctx = useContext(IntlContext);
  if (!ctx) throw new Error('useIntl must be used within IntlProvider');
  return ctx;
}
