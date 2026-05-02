import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthInitializer } from './components/AuthInitializer';
import { getAntdThemeConfig } from './tokens/theme';
import '@/assets/styles/global.css';

const AppContent: React.FC = () => {
  const { theme: appTheme } = useAppStore();
  const isDark = appTheme === 'dark';

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
