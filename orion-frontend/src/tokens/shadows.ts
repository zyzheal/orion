/**
 * Orion Design Tokens - 阴影系统
 * 提供一致的光影效果，增强界面层次感
 */

export const shadows = {
  // ============ 基础阴影 (高度层级) ============
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  md: '0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.10), 0 4px 8px rgba(0, 0, 0, 0.06)',
  xl: '0 12px 24px rgba(0, 0, 0, 0.12), 0 6px 12px rgba(0, 0, 0, 0.08)',
  xxl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // ============ 语义化阴影 ============
  button: '0 1px 2px rgba(0, 0, 0, 0.04)',
  card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  dropdown:
    '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
  modal:
    '0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.08)',
  popover:
    '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',

  // ============ 暗黑模式阴影 ============
  dark: {
    card: '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
    dropdown:
      '0 8px 24px rgba(0, 0, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4)',
    modal:
      '0 20px 60px rgba(0, 0, 0, 0.7), 0 8px 20px rgba(0, 0, 0, 0.5)',
  },
} as const;

/**
 * 阴影透明度配置
 * 用于动态生成不同主题下的阴影
 */
export const shadowOpacity = {
  light: {
    outer: 0.1,
    middle: 0.08,
    inner: 0.05,
  },
  dark: {
    outer: 0.5,
    middle: 0.4,
    inner: 0.3,
  },
} as const;

export default shadows;

/**
 * CSS Variables 映射
 */
export const shadowsCSSVariables: Record<string, string> = {};
for (const [key, value] of Object.entries(shadows)) {
  if (typeof value === 'string') {
    shadowsCSSVariables[`--shadow-${key}`] = value;
  }
}
