/**
 * CSS Variables Injection
 * 将 Design Token 注入为 CSS 自定义属性，供全局使用
 */

import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { typography } from './typography';

export function injectDesignTokens(): string {
  const tokens: Record<string, string> = {};

  // 色彩
  (['primary', 'success', 'warning', 'error', 'info', 'purple'] as const).forEach((colorName) => {
    const scale = colors[colorName];
    ([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).forEach((step) => {
      tokens[`--color-${colorName}-${step}`] = scale[step];
    });
  });

  // 中性色
  ([0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const).forEach((step) => {
    tokens[`--color-neutral-${step}`] = colors.neutral[step];
  });

  // 浅色模式语义
  tokens['--bg-primary'] = colors.light.bg.primary;
  tokens['--bg-secondary'] = colors.light.bg.secondary;
  tokens['--bg-tertiary'] = colors.light.bg.tertiary;
  tokens['--bg-elevated'] = colors.light.bg.elevated;
  tokens['--text-primary'] = colors.light.text.primary;
  tokens['--text-secondary'] = colors.light.text.secondary;
  tokens['--text-tertiary'] = colors.light.text.tertiary;
  tokens['--text-disabled'] = colors.light.text.disabled;
  tokens['--border-light'] = colors.light.border.light;
  tokens['--border-default'] = colors.light.border.default;
  tokens['--border-heavy'] = colors.light.border.heavy;

  // 间距
  Object.entries(spacing).forEach(([key, value]) => {
    if (typeof value === 'number') {
      tokens[`--spacing-${key}`] = `${value}px`;
    }
  });

  // 圆角
  Object.entries(radius).forEach(([key, value]) => {
    if (typeof value === 'number') {
      tokens[`--radius-${key}`] = `${value}px`;
    }
  });
  tokens['--radius-sm'] = `${radius.sm}px`;
  tokens['--radius-md'] = `${radius.md}px`;
  tokens['--radius-lg'] = `${radius.lg}px`;
  tokens['--radius-xl'] = `${radius.xl}px`;

  // 阴影
  tokens['--shadow-xs'] = shadows.xs;
  tokens['--shadow-sm'] = shadows.sm;
  tokens['--shadow-md'] = shadows.md;
  tokens['--shadow-lg'] = shadows.lg;
  tokens['--shadow-xl'] = shadows.xl;
  tokens['--shadow-card'] = shadows.card;
  tokens['--shadow-button'] = shadows.button;
  tokens['--shadow-dropdown'] = shadows.dropdown;
  tokens['--shadow-modal'] = shadows.modal;

  // 字重
  tokens['--font-weight-light'] = `${typography.fontWeight.light}`;
  tokens['--font-weight-normal'] = `${typography.fontWeight.normal}`;
  tokens['--font-weight-medium'] = `${typography.fontWeight.medium}`;
  tokens['--font-weight-semibold'] = `${typography.fontWeight.semibold}`;
  tokens['--font-weight-bold'] = `${typography.fontWeight.bold}`;
  tokens['--font-weight-extrabold'] = `${typography.fontWeight.extrabold}`;

  // 构建 CSS
  const rules = Object.entries(tokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return `:root {\n${rules}\n}`;
}
