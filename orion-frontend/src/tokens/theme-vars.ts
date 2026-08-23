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
} as const;
