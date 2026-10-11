/**
 * Theme-aware CSS variable references.
 *
 * These map to --bg-primary, --border-default, etc. which are injected
 * into :root by main.tsx injectDesignTokens() and automatically respond
 * to light/dark theme toggling via data-theme attribute.
 *
 * Replaces direct colors.light.* / colors.dark.* inline usage so that
 * page components are theme-aware without importing useTheme().
 */
export const themeVars = {
  bgPrimary: 'var(--bg-primary)',
  bgSecondary: 'var(--bg-secondary)',
  bgTertiary: 'var(--bg-tertiary)',
  bgElevated: 'var(--bg-elevated)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',
  textDisabled: 'var(--text-disabled)',
  borderDefault: 'var(--border-default)',
  borderLight: 'var(--border-light)',
  borderHeavy: 'var(--border-heavy)',
  // P2-2: 交互状态半透明叠加（暗色/浅色自动切换）
  overlaySubtle: 'var(--overlay-subtle)',
  overlayHover: 'var(--overlay-hover)',
  overlayActive: 'var(--overlay-active)',
  overlayDivider: 'var(--overlay-divider)',
  overlayBorder: 'var(--overlay-border)',
  // P2-2: 导航菜单文本色（暗色模式用 alpha 白，浅色模式用中性色）
  menuText: 'var(--menu-text-default)',
  menuTextActive: 'var(--menu-text-active)',
  menuTextHover: 'var(--menu-text-hover)',
  menuTextSecondary: 'var(--menu-text-secondary)',
  menuTextDisabled: 'var(--menu-text-disabled)',
} as const;
