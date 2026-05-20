import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthInitializer } from './components/AuthInitializer';
import { ChartProvider } from './components/charts/ChartProvider';
import { getAntdThemeConfig } from './tokens/theme';
import { colors, colorCSSVariables } from './tokens/colors';
import { spacingCSSVariables } from './tokens/spacing';
import { typographyCSSVariables } from './tokens/typography';
import { radiusCSSVariables } from './tokens/radius';
import { shadowsCSSVariables } from './tokens/shadows';
import { initMicroFrontend, cleanupMicroFrontend } from './microfront/config';
import '@/assets/styles/global.css';

/**
 * 初始化微前端（一次性副作用）
 * 放在组件内而非模块顶层，避免 HMR 时重复执行导致 wujie 内部状态混乱
 * 使用 useRef 防止 React.StrictMode 下双重初始化
 */
const MicroFrontendInitializer: React.FC = () => {
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initMicroFrontend();

    return () => {
      cleanupMicroFrontend();
    };
  }, []);
  return null;
};

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

  React.useEffect(() => {
    injectDesignTokens(isDark);
  }, [isDark]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={getAntdThemeConfig({ algorithm: isDark ? 'dark' : 'default' })}
    >
      <AppRouter />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MicroFrontendInitializer />
      <AuthInitializer>
        <ChartProvider>
          <AppContent />
        </ChartProvider>
      </AuthInitializer>
    </ErrorBoundary>
  </React.StrictMode>
);
