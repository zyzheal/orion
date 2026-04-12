/**
 * Orion Design Tokens - 主题配置
 * 用于 Ant Design theme 的配置生成
 */

import { colors } from './colors';
import { shadows } from './shadows';
import { radius } from './radius';
import { typography } from './typography';
import { animation } from './animation';

/**
 * 浅色主题配置
 */
export const lightTheme = {
  token: {
    // 主色
    colorPrimary: colors.primary[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    colorInfo: colors.info[500],

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

    // 圆角
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    borderRadiusXL: radius.xl,

    // 字体
    fontFamily: typography.fontFamily.base,
    fontSize: typography.fontSize.md,
    fontSizeLG: typography.fontSize.lg,

    // 线宽
    lineWidth: 1,
    lineWidthBold: 2,

    // 阴影
    boxShadow: shadows.md,
    boxShadowSecondary: shadows.sm,

    // 动画
    motionDurationFast: `${animation.duration.fast}ms`,
    motionDurationMid: `${animation.duration.normal}ms`,
    motionDurationSlow: `${animation.duration.slow}ms`,
    motionEaseOut: animation.easing.easeOut,
    motionEaseInOut: animation.easing.easeInOut,
  },
};

/**
 * 暗黑主题配置
 */
export const darkTheme = {
  token: {
    ...lightTheme.token,

    // 主色（暗黑模式下适当降低饱和度）
    colorPrimary: colors.primary[400],

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

    // 阴影（暗黑模式下更明显）
    boxShadow: shadows.dark.card,
    boxShadowSecondary: shadows.sm,
  },
};

/**
 * 根据主题名称返回对应配置
 */
export const getThemeConfig = (theme: 'light' | 'dark') => {
  return theme === 'dark' ? darkTheme : lightTheme;
};

export default { lightTheme, darkTheme, getThemeConfig };
