// ============================================================
// Theme Engine (Plan 02)
// 多主题 CSS 变量引擎 — 支持 light / dark / high-contrast
// ============================================================

import type { OrionTheme, TokenSet } from './tokenStore';
import { colors } from './colors';
import { injectDesignTokens } from './injectTokens';

/** 暗色模式语义色映射 */
const DARK_SEMANTICS = {
  '--bg-primary': colors.dark.bg.primary,
  '--bg-secondary': colors.dark.bg.secondary,
  '--bg-tertiary': colors.dark.bg.tertiary,
  '--bg-elevated': colors.dark.bg.elevated,
  '--text-primary': colors.dark.text.primary,
  '--text-secondary': colors.dark.text.secondary,
  '--text-tertiary': colors.dark.text.tertiary,
  '--text-disabled': colors.dark.text.disabled,
  '--border-light': colors.dark.border.light,
  '--border-default': colors.dark.border.default,
  '--border-heavy': colors.dark.border.heavy,
};

/** 高对比度模式语义色映射（AA/AAA 合规） */
const HIGH_CONTRAST_SEMANTICS = {
  ...DARK_SEMANTICS,
  '--text-primary': '#FFFFFF',
  '--text-secondary': '#E0E0E0',
  '--text-tertiary': '#B0B0B0',
  '--border-default': '#FFFFFF',
  '--border-heavy': '#FFFFFF',
  '--border-light': '#808080',
};

/** 主题 → 语义色映射表 */
const THEME_SEMANTICS: Record<OrionTheme, Record<string, string>> = {
  light: {},        // light 由 injectDesignTokens 处理
  dark: DARK_SEMANTICS,
  'high-contrast': HIGH_CONTRAST_SEMANTICS,
};

let lastAppliedTheme: OrionTheme | null = null;
let lastAppliedTokens: Partial<TokenSet> | null = null;

/**
 * 将主题 CSS 变量应用到 document.documentElement
 * @param theme 目标主题
 * @param customTokens 自定义 token 覆盖
 */
export function applyThemeVariables(
  theme: OrionTheme,
  customTokens: Partial<TokenSet> = {}
): void {
  // 避免重复应用
  if (theme === lastAppliedTheme && JSON.stringify(customTokens) === JSON.stringify(lastAppliedTokens)) {
    return;
  }
  lastAppliedTheme = theme;
  lastAppliedTokens = customTokens;

  const root = document.documentElement;

  // 1. 基础 token 注入 (light 模式)
  const baseCSS = injectDesignTokens();
  // 将 :root { } 替换为 [data-theme="light"] { }
  const lightCSS = baseCSS.replace(':root', '[data-theme="light"]');
  applyCSSRule(lightCSS, 'orion-tokens-base');

  // 2. 暗色模式覆盖
  if (theme === 'dark' || theme === 'high-contrast') {
    const darkRules = Object.entries(THEME_SEMANTICS[theme])
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    applyCSSRule(`[data-theme="dark"] {\n${darkRules}\n}`, 'orion-tokens-dark');
    applyCSSRule(`[data-theme="high-contrast"] {\n${darkRules}\n}`, 'orion-tokens-hc');
  }

  // 3. 设置 data-theme 属性
  root.setAttribute('data-theme', theme);

  // 4. 自定义 token 覆盖 (内联 style)
  const customStyleId = 'orion-tokens-custom';
  let customEl = document.getElementById(customStyleId) as HTMLStyleElement | null;
  if (Object.keys(customTokens).length > 0) {
    if (!customEl) {
      customEl = document.createElement('style');
      customEl.id = customStyleId;
      document.head.appendChild(customEl);
    }
    const customRules = buildCustomTokenCSS(customTokens);
    customEl.textContent = customRules;
  } else if (customEl) {
    customEl.textContent = '';
  }
}

/** 将自定义 token 转为 CSS 规则 */
function buildCustomTokenCSS(tokens: Partial<TokenSet>): string {
  const rules: string[] = [];

  if (tokens.colors) {
    const c = tokens.colors;
    if (c.light) {
      rules.push('[data-theme="light"] {');
      rules.push(`  --bg-primary: ${c.light.bg.primary ?? ''};`);
      rules.push(`  --text-primary: ${c.light.text.primary ?? ''};`);
      rules.push('}');
    }
    if (c.dark) {
      rules.push('[data-theme="dark"] {');
      rules.push(`  --bg-primary: ${c.dark.bg.primary ?? ''};`);
      rules.push(`  --text-primary: ${c.dark.text.primary ?? ''};`);
      rules.push('}');
    }
  }

  if (tokens.spacing) {
    const entries = Object.entries(tokens.spacing);
    const spacingRules = entries
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `  --spacing-${k}: ${(v as number)}px;`)
      .join('\n');
    if (spacingRules) rules.push(`:root {\n${spacingRules}\n}`);
  }

  if (tokens.radius) {
    const entries = Object.entries(tokens.radius);
    const radiusRules = entries
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `  --radius-${k}: ${(v as number)}px;`)
      .join('\n');
    if (radiusRules) rules.push(`:root {\n${radiusRules}\n}`);
  }

  return rules.join('\n');
}

/** 插入/替换 <style> 元素 */
function applyCSSRule(css: string, id: string): void {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

/** 初始化主题引擎（在应用启动时调用一次） */
export function initThemeEngine(initialTheme?: OrionTheme): void {
  const theme = initialTheme || ('light' as OrionTheme);
  try {
    const saved = localStorage.getItem('orion-theme-preference');
    if (saved === 'dark' || saved === 'high-contrast') {
      applyThemeVariables(saved);
      return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyThemeVariables('dark');
      return;
    }
  } catch {
    // SSR
  }
  applyThemeVariables(theme);
}

/** 监听系统主题变化，自动切换 */
export function watchSystemTheme(): (() => void) | null {
  if (!window.matchMedia) return null;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    try {
      const saved = localStorage.getItem('orion-theme-preference');
      if (saved) return; // 用户手动设置过，不自动跟随
      const store = (window as unknown as { __orionTokenStore?: { getState: () => { theme: OrionTheme; setTheme: (t: OrionTheme) => void } } }).__orionTokenStore;
      if (store) {
        store.getState().setTheme(e.matches ? 'dark' : 'light');
      }
    } catch {
      // ignore
    }
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
