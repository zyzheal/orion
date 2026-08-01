import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, Empty } from 'antd';
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
import { QueryProvider } from './providers/QueryProvider';
import '@/assets/styles/global.css';

/**
 * 微前端初始化标记（模块级单例）
 * HMR 时模块会被重新执行，通过 import.meta.hot.data 跨热更新保持状态
 */
let initialized = false;

// HMR 状态持久化
if (import.meta.hot) {
  const hot = import.meta.hot;
  // 恢复状态
  if (hot.data.microFrontendInitialized) {
    initialized = true;
  }
  // HMR 替换前清理
  hot.dispose(() => {
    if (hot.data.microFrontendInitialized) {
      cleanupMicroFrontend();
    }
  });
}

/**
 * 初始化微前端（延迟异步执行，不阻塞主线程）
 * 开发环境下仅在访问子应用路由时初始化，避免 preloadApp iframe 阻塞
 */
const MicroFrontendInitializer: React.FC = () => {
  React.useEffect(() => {
    if (initialized) return;
    initialized = true;
    if (import.meta.hot) {
      import.meta.hot.data.microFrontendInitialized = true;
    }

    // 使用 requestIdleCallback 在主线程空闲时初始化，避免阻塞页面渲染
    const scheduleInit = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => initMicroFrontend(), { timeout: 2000 });
      } else {
        setTimeout(initMicroFrontend, 100);
      }
    };
    scheduleInit();
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
      renderEmpty={() => (
        <Empty
          description="暂无数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    >
      <AppRouter />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <MicroFrontendInitializer />
        <AuthInitializer>
          <ChartProvider>
            <AppContent />
          </ChartProvider>
        </AuthInitializer>
      </QueryProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
