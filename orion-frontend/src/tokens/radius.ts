/**
 * Orion Design Tokens - 圆角系统
 * 提供一致的圆角样式，增强视觉层次感
 */

export const radius = {
  // ============ 基础圆角 ============
  none: 0,
  xs: 4,    // Apple/Feishu: was 2
  sm: 6,    // was 4
  md: 8,    // was 6
  lg: 12,   // Apple card style: was 8
  xl: 16,   // was 12
  xxl: 20,
  full: 9999,

  // ============ 数值圆角 (px) ============
  0: 0,
  1: 4,
  2: 6,
  3: 8,
  4: 12,
  5: 14,
  6: 16,
  8: 20,
  10: 24,
  12: 28,
} as const;

/**
 * 组件专用圆角
 */
export const componentRadius = {
  // 按钮圆角
  button: {
    sm: 4,    // was 2
    md: 6,    // Feishu style: was 4
    lg: 8,    // was 6
  },

  // 卡片圆角 — Apple style
  card: 12,   // was 8

  // 弹窗圆角 — Apple style
  modal: 16,  // was 12

  // 下拉菜单圆角
  dropdown: 10, // was 6

  // 输入框圆角
  input: 6,

  // 头像圆角
  avatar: {
    square: 4,
    circle: 9999,
  },

  // 标签圆角
  tag: 6,     // was 4

  // 徽章圆角
  badge: 9999,
} as const;

export default radius;

/**
 * CSS Variables 映射
 */
export const radiusCSSVariables: Record<string, string> = {};
for (const [key, value] of Object.entries(radius)) {
  radiusCSSVariables[`--radius-${key}`] = `${value}px`;
}
