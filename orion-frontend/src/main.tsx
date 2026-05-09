import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthInitializer } from './components/AuthInitializer';
import { getAntdThemeConfig } from './tokens/theme';
import { colors, colorCSSVariables } from './tokens/colors';
import { spacingCSSVariables } from './tokens/spacing';
import { typographyCSSVariables } from './tokens/typography';
import { radiusCSSVariables } from './tokens/radius';
import { shadowsCSSVariables } from './tokens/shadows';
import '@/assets/styles/global.css';

/**
 * Inject all design token CSS variables into document root.
 * Enables var(--color-primary-500) etc. in any CSS.
 */
function injectDesignTokens(isDark: boolean) {
  const root = document.documentElement;
  const bg = isDark ? colors.dark.bg : colors.light.bg;
  const text = isDark ? colors.dark.text : colors.light.text;
  const border = isDark ? colors.dark.border : colors.light.border;

  root.style.setProperty('--bg-primary', bg.primary);
  root.style.setProperty('--bg-secondary', bg.secondary);
  root.style.setProperty('--bg-tertiary', bg.tertiary);
  root.style.setProperty('--bg-elevated', bg.elevated);

  root.style.setProperty('--text-primary', text.primary);
  root.style.setProperty('--text-secondary', text.secondary);
  root.style.setProperty('--text-tertiary', text.tertiary);
  root.style.setProperty('--text-disabled', text.disabled);

  root.style.setProperty('--border-default', border.default);
  root.style.setProperty('--border-light', border.light);
  root.style.setProperty('--border-heavy', border.heavy);

  // Static tokens (colors, spacing, typography, radius, shadows)
  for (const [key, value] of Object.entries(colorCSSVariables)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(spacingCSSVariables)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(typographyCSSVariables)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(radiusCSSVariables)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(shadowsCSSVariables)) {
    root.style.setProperty(key, value);
  }
}

const AppContent: React.FC = () => {
  const { theme: appTheme } = useAppStore();
  const isDark = appTheme === 'dark';

  useEffect(() => {
    injectDesignTokens(isDark);
  }, [isDark]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={getAntdThemeConfig({ algorithm: isDark ? 'dark' : 'default' }) as any}
    >
      <AppRouter />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthInitializer>
        <AppContent />
      </AuthInitializer>
    </ErrorBoundary>
  </React.StrictMode>
);
