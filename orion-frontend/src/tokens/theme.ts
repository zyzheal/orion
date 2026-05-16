/**
 * Orion Design Tokens - 主题配置
 * 用于 Ant Design theme 的配置生成
 */

import { colors } from './colors';
import { shadows } from './shadows';
import { radius, componentRadius } from './radius';
import { typography } from './typography';
import { animation } from './animation';
import { spacing } from './spacing';

// ============================================================================
// 基础 Token 映射
// ============================================================================

/**
 * 将设计 Token 映射为 Ant Design v5 的 token 名称
 */
const designTokens = {
  // 颜色
  colorPrimary: colors.primary[500],
  colorSuccess: colors.success[500],
  colorWarning: colors.warning[500],
  colorError: colors.error[500],
  colorInfo: colors.info[500],

  // 间距 (Ant Design padding 系列)
  paddingXS: spacing.xs,    // 4px
  paddingSM: spacing.sm,    // 8px
  padding: spacing.md,      // 16px
  paddingLG: spacing.lg,    // 24px
  paddingXL: spacing.xl,    // 32px

  // 圆角
  borderRadiusXS: radius.xs,  // 4px
  borderRadiusSM: radius.sm,  // 6px
  borderRadius: radius.md,    // 8px
  borderRadiusLG: radius.lg,  // 12px

  // 字体
  fontSizeSM: typography.fontSize.sm,   // 12px
  fontSize: typography.fontSize.md,     // 14px
  fontSizeLG: typography.fontSize.lg,   // 16px
  fontSizeXL: typography.fontSize.xl,   // 20px
  fontFamily: typography.fontFamily.base,

  // 阴影
  boxShadow: shadows.md,
  boxShadowSecondary: shadows.sm,
  boxShadowTertiary: shadows.xs,

  // 动画
  motionDurationFast: `${animation.duration.fast}ms`,     // 200ms
  motionDurationMid: `${animation.duration.normal}ms`,    // 300ms
  motionDurationSlow: `${animation.duration.slow}ms`,     // 400ms
  motionEaseInOut: animation.easing.easeInOut,
  motionEaseOut: animation.easing.easeOut,
} as const;

// ============================================================================
// 组件级 Override
// ============================================================================

/**
 * 组件级别的 Token 覆盖
 * 用于微调特定组件的样式，不影响全局 token
 */
const componentOverrides = {
  // Card 组件
  Card: {
    paddingLG: spacing.lg,           // 卡片内边距 24px
    borderRadiusLG: componentRadius.card,     // 卡片圆角 8px
    boxShadow: shadows.card,         // 卡片专属阴影
  },

  // Button 组件
  Button: {
    paddingXS: spacing.xs,           // 按钮水平内边距 4px (基础)
    paddingSM: spacing.sm,           // 按钮垂直内边距 8px
    borderRadiusSM: componentRadius.button.md, // 按钮圆角 4px
    boxShadowSecondary: shadows.button, // 按钮阴影
  },

  // Table 组件
  Table: {
    paddingSM: spacing.sm,           // 表格单元格内边距 8px
    padding: spacing.md,             // 表格单元格内边距 16px
    borderRadiusLG: radius.md,       // 表格圆角 6px
  },

  // Input 组件
  Input: {
    paddingSM: spacing.sm,           // 输入框内边距 8px
    padding: spacing.md,             // 输入框内边距 16px
    borderRadiusSM: componentRadius.input,    // 输入框圆角 6px
    boxShadowSecondary: shadows.none, // 输入框无阴影
  },

  // Statistic 组件
  Statistic: {
    padding: spacing.md,             // 统计卡片内边距 16px
    borderRadiusLG: radius.lg,       // 统计卡片圆角 8px
    boxShadow: shadows.sm,           // 统计卡片轻微阴影
  },
} as const;

// ============================================================================
// 浅色主题
// ============================================================================

/**
 * 浅色主题配置
 */
export const lightTheme = {
  token: {
    ...designTokens,

    // 基础颜色
    colorText: colors.light.text.primary,
    colorTextSecondary: colors.light.text.secondary,
    colorTextTertiary: colors.light.text.tertiary,
    colorTextQuaternary: colors.light.text.disabled,

    // 背景色
    colorBgLayout: colors.light.bg.secondary,
    colorBgContainer: colors.light.bg.primary,
    colorBgElevated: colors.light.bg.elevated,

    // 边框色
    colorBorder: colors.light.border.default,
    colorBorderSecondary: colors.light.border.light,

    // 线宽
    lineWidth: 1,
    lineWidthBold: 2,

    // 组件默认尺寸
    componentSize: 36, // 默认组件高度 (Apple style: was 32)

    // 是否使用线框风格
    wireframe: false,
  },
  components: componentOverrides,
};

// ============================================================================
// 暗黑主题
// ============================================================================

/**
 * 暗黑主题配置
 */
export const darkTheme = {
  token: {
    // 继承浅色主题的所有 token
    colorPrimary: colors.primary[400],     // 暗黑模式降低饱和度
    colorSuccess: colors.success[400],
    colorWarning: colors.warning[400],
    colorError: colors.error[400],
    colorInfo: colors.info[400],

    // 基础颜色
    colorText: colors.dark.text.primary,
    colorTextSecondary: colors.dark.text.secondary,
    colorTextTertiary: colors.dark.text.tertiary,
    colorTextQuaternary: colors.dark.text.disabled,

    // 背景色
    colorBgLayout: colors.dark.bg.primary,
    colorBgContainer: colors.dark.bg.secondary,
    colorBgElevated: colors.dark.bg.elevated,

    // 边框色
    colorBorder: colors.dark.border.default,
    colorBorderSecondary: colors.dark.border.light,

    // 圆角 (继承)
    borderRadiusXS: radius.xs,
    borderRadiusSM: radius.sm,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,

    // 间距 (继承)
    paddingXS: spacing.xs,
    paddingSM: spacing.sm,
    padding: spacing.md,
    paddingLG: spacing.lg,
    paddingXL: spacing.xl,

    // 字体 (继承)
    fontSizeSM: typography.fontSize.sm,
    fontSize: typography.fontSize.md,
    fontSizeLG: typography.fontSize.lg,
    fontSizeXL: typography.fontSize.xl,
    fontFamily: typography.fontFamily.base,

    // 阴影 (暗黑模式更明显)
    boxShadow: shadows.dark.card,
    boxShadowSecondary: shadows.sm,
    boxShadowTertiary: shadows.xs,

    // 动画 (继承)
    motionDurationFast: `${animation.duration.fast}ms`,
    motionDurationMid: `${animation.duration.normal}ms`,
    motionDurationSlow: `${animation.duration.slow}ms`,
    motionEaseInOut: animation.easing.easeInOut,
    motionEaseOut: animation.easing.easeOut,

    // 组件默认
    lineWidth: 1,
    lineWidthBold: 2,
    componentSize: 36,   // Apple style: was 32
    wireframe: false,
  },
  components: {
    ...componentOverrides,
    // 暗黑模式下的卡片阴影覆盖
    Card: {
      ...componentOverrides.Card,
      boxShadow: shadows.dark.card,
    },
  },
};

// ============================================================================
// 导出函数
// ============================================================================

/**
 * Ant Design v5 主题配置类型
 */
export type AntdThemeConfig = {
  token: Record<string, string | number | boolean>;
  components?: Record<string, Record<string, string | number>>;
};

/**
 * 根据主题名称返回对应的 Ant Design 主题配置
 * @param theme - 'light' | 'dark'
 * @returns Ant Design v5 主题配置对象
 */
export const getThemeConfig = (theme: 'light' | 'dark'): typeof lightTheme | typeof darkTheme => {
  return theme === 'dark' ? darkTheme : lightTheme;
};

/**
 * 获取完整的 Ant Design v5 主题配置
 * 支持 light 和 dark 两种主题模式
 *
 * @param options - 配置选项
 * @param options.algorithm - 主题算法，'default' 为浅色，'dark' 为深色
 * @returns Ant Design v5 完整主题配置
 *
 * @example
 * ```ts
 * // 浅色主题
 * const lightConfig = getAntdThemeConfig();
 *
 * // 深色主题
 * const darkConfig = getAntdThemeConfig({ algorithm: 'dark' });
 *
 * // 在 ConfigProvider 中使用
 * <ConfigProvider theme={getAntdThemeConfig()}>
 *   <App />
 * </ConfigProvider>
 * ```
 */
export function getAntdThemeConfig(
  options: { algorithm?: 'default' | 'dark' } = {}
): AntdThemeConfig & { algorithm?: string } {
  const { algorithm = 'default' } = options;

  if (algorithm === 'dark') {
    return {
      ...darkTheme,
      algorithm: 'dark',
    };
  }

  return {
    ...lightTheme,
    algorithm: 'default',
  };
}

export default { lightTheme, darkTheme, getThemeConfig, getAntdThemeConfig };
