// ============================================================
// Token Store (Plan 02)
// 管理当前激活的 token set + 主题状态
// 使用 Zustand — 与现有 authStore/settingsStore 保持一致
// ============================================================

import { create } from 'zustand';
import { designTokens } from './index';
import { applyThemeVariables } from './themeEngine';

export type OrionTheme = 'light' | 'dark' | 'high-contrast';
export type TokenSet = typeof designTokens;

interface TokenState {
  theme: OrionTheme;
  isDark: boolean;
  isHighContrast: boolean;
  activeTokens: TokenSet | null;
  customTokens: Partial<TokenSet>;

  setTheme: (theme: OrionTheme) => void;
  toggleTheme: () => void;
  applyCustomTokens: (tokens: Partial<TokenSet>) => void;
  resetTokens: () => void;
}

const THEMES: Record<OrionTheme, { isDark: boolean; isHighContrast: boolean }> = {
  light: { isDark: false, isHighContrast: false },
  dark: { isDark: true, isHighContrast: false },
  'high-contrast': { isDark: true, isHighContrast: true },
};

const PERSIST_KEY = 'orion-theme-preference';

function loadTheme(): OrionTheme {
  try {
    const saved = localStorage.getItem(PERSIST_KEY);
    if (saved === 'dark' || saved === 'high-contrast') return saved;
    // 系统偏好检测
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // SSR / no window
  }
  return 'light';
}

export const useTokenStore = create<TokenState>((set, get) => {
  const initialTheme = loadTheme();

  return {
    theme: initialTheme,
    isDark: THEMES[initialTheme].isDark,
    isHighContrast: THEMES[initialTheme].isHighContrast,
    activeTokens: null,
    customTokens: {},

    setTheme: (theme: OrionTheme) => {
      const prevTheme = get().theme;
      set({
        theme,
        isDark: THEMES[theme].isDark,
        isHighContrast: THEMES[theme].isHighContrast,
      });
      // 持久化
      try {
        localStorage.setItem(PERSIST_KEY, theme);
      } catch {
        // SSR
      }
      // 应用 CSS 变量
      applyThemeVariables(theme, get().customTokens);
      // 触发系统事件（兼容第三方组件）
      window.dispatchEvent(new CustomEvent('orion:theme-change', {
        detail: { theme, previous: prevTheme },
      }));
    },

    toggleTheme: () => {
      const current = get().theme;
      const next: OrionTheme = current === 'light' ? 'dark' : 'light';
      get().setTheme(next);
    },

    applyCustomTokens: (tokens: Partial<TokenSet>) => {
      set({ customTokens: tokens });
      applyThemeVariables(get().theme, tokens);
    },

    resetTokens: () => {
      set({ customTokens: {} });
      applyThemeVariables(get().theme, {});
    },
  };
});
