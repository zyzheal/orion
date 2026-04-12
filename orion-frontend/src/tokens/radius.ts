/**
 * Orion Design Tokens - 圆角系统
 * 提供一致的圆角样式，增强视觉层次感
 */

export const radius = {
  // ============ 基础圆角 ============
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  full: 9999,

  // ============ 数值圆角 (px) ============
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  8: 16,
  10: 20,
  12: 24,
} as const;

/**
 * 组件专用圆角
 */
export const componentRadius = {
  // 按钮圆角
  button: {
    sm: 2,
    md: 4,
    lg: 6,
  },

  // 卡片圆角
  card: 8,

  // 弹窗圆角
  modal: 12,

  // 下拉菜单圆角
  dropdown: 6,

  // 输入框圆角
  input: 6,

  // 头像圆角
  avatar: {
    square: 4,
    circle: 9999,
  },

  // 标签圆角
  tag: 4,

  // 徽章圆角
  badge: 9999,
} as const;

export default radius;
