/**
 * Orion Design Tokens - 响应式断点
 * 与 Ant Design 保持一致，定义不同屏幕尺寸的断点值
 */

export const breakpoints = {
  xs: 0,        // 超小屏（手机竖屏）
  sm: 576,      // 小屏（手机横屏）
  md: 768,      // 中屏（平板）
  lg: 992,      // 大屏（桌面小屏）
  xl: 1200,     // 超大屏（桌面大屏）
  xxl: 1600,    // 超大屏（超宽屏）
} as const;

/**
 * 断点说明
 *
 * xs (0px):       手机竖屏 (<576px)
 * sm (576px):     手机横屏 (576px - 767px)
 * md (768px):     平板 (768px - 991px)
 * lg (992px):     桌面小屏 (992px - 1199px)
 * xl (1200px):    桌面大屏 (1200px - 1599px)
 * xxl (1600px):   超宽屏 (>=1600px)
 */

/**
 * CSS Media Query 模板
 * 用于在 CSS 中快速生成响应式样式
 */
export const mediaQueries = {
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  xxl: `(min-width: ${breakpoints.xxl}px)`,
} as const;

export default breakpoints;
