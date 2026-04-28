/**
 * Orion Design Tokens - 阴影系统
 * 提供一致的光影效果，增强界面层次感
 */

export const shadows = {
  // ============ 基础阴影 (高度层级) ============
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  xxl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // ============ 语义化阴影 ============
  button: '0 2px 0 rgba(0, 0, 0, 0.045)',
  card: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
  dropdown:
    '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  modal:
    '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  popover:
    '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',

  // ============ 暗黑模式阴影 ============
  dark: {
    card: '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
    dropdown:
      '0 6px 16px 0 rgba(0, 0, 0, 0.48), 0 3px 6px -4px rgba(0, 0, 0, 0.52), 0 9px 28px 8px rgba(0, 0, 0, 0.45)',
    modal:
      '0 3px 6px -4px rgba(0, 0, 0, 0.52), 0 6px 16px 0 rgba(0, 0, 0, 0.48), 0 9px 28px 8px rgba(0, 0, 0, 0.45)',
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
