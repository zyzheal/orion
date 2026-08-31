// ============================================================
// useOrionToken — 类型化 Token 访问 Hook (Plan 02)
// 替代直接 import colors.light.xxx，自动响应主题切换
// ============================================================

import { useCallback } from 'react';
import { designTokens } from './index';
import { useTokenStore } from './tokenStore';

type DesignTokens = typeof designTokens;

/** Token 值类型 */
type TokenValue = string | number | Record<string, unknown> | readonly string[];

/**
 * Token 查询结果。用判别联合把 exists 与 value 的互斥关系编进类型：
 * exists === false 时 value 必然是 undefined（原实现用 `undefined as TokenValue`
 * 硬转，类型上声称有值而运行时没有，调用方无法据此判空）。
 *
 * 路径类型不必手写 —— `useOrionToken<K extends keyof DesignTokens>` 的泛型已经
 * 从 designTokens 派生出同样的补全，手写联合既重复又容易漂移（原先那个 TokenPath
 * 因此从未被任何调用方使用，已删除）。
 */
type TokenResult<T = TokenValue> =
  | {
      /** CSS 变量格式 (var(--xxx)) */
      cssVar?: string;
      /** 原始值 */
      value: T;
      exists: true;
    }
  | {
      cssVar?: string;
      value: undefined;
      exists: false;
    };

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
      return { value: undefined, exists: false };
    }

    if (!subKey) {
      return { value: catTokens as TokenValue, exists: true };
    }

    const subVal = (catTokens as Record<string, TokenValue>)[subKey];
    if (subVal === undefined) {
      return { value: undefined, exists: false };
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

  // zustand 原生 subscribe 只接受单个 (state, prevState) listener；
  // (selector, listener) 两参形式需要 subscribeWithSelector 中间件，而 tokenStore
  // 没有启用它。旧写法下第一个箭头被当成 listener 整体调用、第二个箭头永不执行，
  // 主题一变 handler 就收不到通知（只有下面那次首帧调用生效）—— 真 bug。
  // 选择器语义在这里手工实现，顺带获得同值去重。
  const unsubscribe = useTokenStore.subscribe((state, prevState) => {
    if (state.theme !== prevState.theme) {
      handler(state.theme);
    }
  });

  // 首次订阅时触发
  handler(theme);

  return unsubscribe;
}

/** 便捷主题获取 Hook */
export function useCurrentTheme() {
  const { theme, isDark, isHighContrast } = useTokenStore();
  return { theme, isDark, isHighContrast };
}
