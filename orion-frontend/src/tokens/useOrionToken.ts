// ============================================================
// useOrionToken — 类型化 Token 访问 Hook (Plan 02)
// 替代直接 import colors.light.xxx，自动响应主题切换
// ============================================================

import { useCallback } from 'react';
import { designTokens } from './index';
import { themeVars } from './theme-vars';
import { useTokenStore } from './tokenStore';

type DesignTokens = typeof designTokens;

/** 所有 token 路径的类型联合 */
type TokenPath =
  | 'colors.primary'
  | 'colors.success'
  | 'colors.warning'
  | 'colors.error'
  | 'colors.info'
  | 'colors.purple'
  | 'colors.neutral'
  | `colors.${'primary' | 'success' | 'warning' | 'error' | 'info' | 'purple'}.${number}`
  | 'spacing'
  | `spacing.${keyof typeof designTokens.spacing}`
  | 'radius'
  | `radius.${keyof typeof designTokens.radius}`
  | 'shadows'
  | `shadows.${keyof typeof designTokens.shadows}`
  | 'typography'
  | `typography.${keyof typeof designTokens.typography}`
  | 'zIndex'
  | `zIndex.${keyof typeof designTokens.zIndex}`
  | 'animation'
  | `animation.${keyof typeof designTokens.animation}`
  | 'breakpoints'
  | `breakpoints.${keyof typeof designTokens.breakpoints}`
  | 'themeVars'
  | `themeVars.${keyof typeof themeVars}`;

/** Token 值类型 */
type TokenValue = string | number | Record<string, unknown> | readonly string[];

interface TokenResult<T = TokenValue> {
  /** CSS 变量格式 (var(--xxx)) */
  cssVar?: string;
  /** 原始值 */
  value: T;
  /** 是否可用 */
  exists: boolean;
}

/**
 * 类型化的 Token 访问 Hook
 * @example
 *   const primary = useOrionToken('colors.primary');
 *   const spacing = useOrionToken('spacing', 'md');
 *   const bgColor = useOrionToken('themeVars', 'bgPrimary');
 */
export function useOrionToken<K extends keyof DesignTokens>(
  category: K
): TokenResult<DesignTokens[K]>;

export function useOrionToken<K extends keyof DesignTokens, S extends keyof DesignTokens[K]>(
  category: K,
  subKey: S
): TokenResult<DesignTokens[K][S]>;

export function useOrionToken(
  category: string,
  subKey?: string
): TokenResult<TokenValue> {
  const { activeTokens, theme } = useTokenStore();

  const resolve = useCallback((): TokenResult<TokenValue> => {
    const tokens = activeTokens || designTokens;

    if (!category) {
      return { value: tokens as TokenValue, exists: true };
    }

    const catTokens = (tokens as Record<string, unknown>)[category];
    if (catTokens === undefined) {
      return { value: undefined as TokenValue, exists: false };
    }

    if (!subKey) {
      return { value: catTokens as TokenValue, exists: true };
    }

    const subVal = (catTokens as Record<string, TokenValue>)[subKey];
    if (subVal === undefined) {
      return { value: undefined as TokenValue, exists: false };
    }

    // 如果是 themeVars，CSS 变量就是值本身
    if (category === 'themeVars') {
      return { value: subVal, cssVar: subVal as string, exists: true };
    }

    return { value: subVal, exists: true };
  }, [activeTokens, theme, category, subKey]);

  return resolve();
}

/** 主题变更事件 */
export type ThemeChangeHandler = (theme: 'light' | 'dark' | 'high-contrast') => void;

/** 主题订阅 Hook */
export function useThemeSubscription(handler: ThemeChangeHandler): () => void {
  const { theme } = useTokenStore();

  const unsubscribe = useTokenStore.subscribe(
    (state) => state.theme,
    (newTheme) => handler(newTheme)
  );

  // 首次订阅时触发
  handler(theme);

  return unsubscribe;
}

/** 便捷主题获取 Hook */
export function useCurrentTheme() {
  const { theme, isDark, isHighContrast } = useTokenStore();
  return { theme, isDark, isHighContrast };
}
