/**
 * Orion Design Tokens - 间距系统
 * 基于 4px 基准网格，确保视觉节奏一致性
 */

export const spacing = {
  // ============ 基础间距 (基于 4px 网格) ============
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,

  // ============ 语义化间距 ============
  xs: 4,   // 极小间距
  sm: 8,   // 小间距
  md: 16,  // 中间距
  lg: 24,  // 大间距
  xl: 32,  // 超大间距
  xxl: 48, // 特大间距
} as const;

/**
 * 间距映射表 (px -> rem)
 * 假设根元素字体大小为 16px
 */
export const spacingRem = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
} as const;

/**
 * 组件专用间距
 */
export const componentSpacing = {
  // 按钮内边距
  buttonPaddingX: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  buttonPaddingY: {
    sm: 4,
    md: 6,
    lg: 8,
  },

  // 卡片内边距
  cardPadding: {
    sm: 12,
    md: 16,
    lg: 24,
  },

  // 表格单元格内边距
  cellPadding: {
    sm: 8,
    md: 12,
    lg: 16,
  },

  // 表单元素间距
  formItemGap: {
    sm: 12,
    md: 16,
    lg: 24,
  },

  // 段落间距
  paragraphMarginBottom: {
    sm: 12,
    md: 16,
    lg: 20,
  },
} as const;

export default spacing;
