import React from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { useAppStore } from './stores/appStore';
import { colors } from './tokens/colors';
import { radius } from './tokens/radius';
import { shadows } from './tokens/shadows';
import { typography } from './tokens/typography';
import { injectDesignTokens } from './tokens/injectTokens';

// Inject Design Token CSS variables on first load
if (typeof document !== 'undefined') {
  const styleId = 'orion-design-tokens';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = injectDesignTokens();
    document.head.appendChild(style);
  }
}

const AppContent: React.FC = () => {
  const { theme: appTheme } = useAppStore();

  const antdToken = {
    colorPrimary: colors.primary[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    colorInfo: colors.info[500],
    colorText: colors.light.text.primary,
    colorBgContainer: colors.light.bg.primary,
    colorBgLayout: colors.light.bg.secondary,
    colorBorder: colors.light.border.default,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    boxShadow: shadows.card,
    fontFamily: typography.fontFamily.base,
    fontSize: typography.fontSize.md,
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: antdToken,
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
