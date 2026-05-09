/**
 * Orion Design Tokens - 色彩系统
 * 符合 WCAG 2.1 AA 对比度标准 (4.5:1 for normal text, 3:1 for large text)
 */

export const colors = {
  // ============ 主色系统 ============
  primary: {
    50: '#e6f7ff',
    100: '#bae7ff',
    200: '#91d5ff',
    300: '#69c0ff',
    400: '#40a9ff',
    500: '#1890ff', // 主色
    600: '#0984e2',
    700: '#006dc2',
    800: '#005aa1',
    900: '#004780',
  },

  // ============ 功能色 ============
  success: {
    50: '#f6ffed',
    100: '#d9f7be',
    200: '#b7eb8f',
    300: '#95de64',
    400: '#73d13d',
    500: '#52c41a', // 成功色
    600: '#389e0d',
    700: '#237804',
    800: '#135200',
    900: '#092b00',
  },

  warning: {
    50: '#fffbe6',
    100: '#fff7e6',
    200: '#ffecb3',
    300: '#ffe58f',
    400: '#ffd666',
    500: '#faad14', // 警告色
    600: '#d48806',
    700: '#ad6800',
    800: '#874d00',
    900: '#613400',
  },

  error: {
    50: '#fff1f0',
    100: '#ffccc7',
    200: '#ffa39e',
    300: '#ff7875',
    400: '#ff4d4f',
    500: '#f5222d', // 错误色
    600: '#cf1322',
    700: '#a8071a',
    800: '#85000c',
    900: '#5c0011',
  },

  info: {
    50: '#e8f4fd',
    100: '#c6e2fc',
    200: '#a3d0fa',
    300: '#80bdf8',
    400: '#5dabf6',
    500: '#3a98f4', // 信息色 (区别于 primary 的偏青色)
    600: '#2e7ac5',
    700: '#235c95',
    800: '#173e64',
    900: '#0c1f33',
  },

  purple: {
    50: '#f9f0ff',
    100: '#efdbff',
    200: '#d3adf7',
    300: '#b37feb',
    400: '#9254de',
    500: '#722ed1', // 紫色
    600: '#531dab',
    700: '#391085',
    800: '#22075e',
    900: '#110358',
  },

  // ============ 中性色 ============
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#f0f0f0',
    300: '#d9d9d9',
    400: '#bfbfbf',
    500: '#8c8c8c', // 中性灰
    600: '#595959',
    700: '#434343',
    800: '#262626',
    900: '#1f1f1f',
    950: '#141414',
  },

  // ============ 暗黑模式色彩 ============
  dark: {
    bg: {
      primary: '#141414',
      secondary: '#1f1f1f',
      tertiary: '#262626',
      elevated: '#434343',
    },
    text: {
      primary: '#ffffff',
      secondary: '#d9d9d9',
      tertiary: '#8c8c8c',
      disabled: '#595959',
    },
    border: {
      default: '#434343',
      light: '#262626',
      heavy: '#595959',
    },
  },

  // ============ 浅色模式色彩 ============
  light: {
    bg: {
      primary: '#ffffff',
      secondary: '#fafafa',
      tertiary: '#f5f5f5',
      elevated: '#ffffff',
    },
    text: {
      primary: '#1f1f1f',
      secondary: '#434343',
      tertiary: '#595959',
      disabled: '#bfbfbf',
    },
    border: {
      default: '#d9d9d9',
      light: '#f0f0f0',
      heavy: '#bfbfbf',
    },
  },
} as const;

/**
 * CSS Variables 映射
 * 用于在 CSS 中通过 var(--color-primary-500) 等方式引用
 */
export const colorCSSVariables = {
  // 主色
  '--color-primary-50': colors.primary[50],
  '--color-primary-100': colors.primary[100],
  '--color-primary-200': colors.primary[200],
  '--color-primary-300': colors.primary[300],
  '--color-primary-400': colors.primary[400],
  '--color-primary-500': colors.primary[500],
  '--color-primary-600': colors.primary[600],
  '--color-primary-700': colors.primary[700],
  '--color-primary-800': colors.primary[800],
  '--color-primary-900': colors.primary[900],

  // 成功色
  '--color-success-50': colors.success[50],
  '--color-success-100': colors.success[100],
  '--color-success-200': colors.success[200],
  '--color-success-300': colors.success[300],
  '--color-success-400': colors.success[400],
  '--color-success-500': colors.success[500],
  '--color-success-600': colors.success[600],
  '--color-success-700': colors.success[700],
  '--color-success-800': colors.success[800],
  '--color-success-900': colors.success[900],

  // 警告色
  '--color-warning-50': colors.warning[50],
  '--color-warning-100': colors.warning[100],
  '--color-warning-200': colors.warning[200],
  '--color-warning-300': colors.warning[300],
  '--color-warning-400': colors.warning[400],
  '--color-warning-500': colors.warning[500],
  '--color-warning-600': colors.warning[600],
  '--color-warning-700': colors.warning[700],
  '--color-warning-800': colors.warning[800],
  '--color-warning-900': colors.warning[900],

  // 错误色
  '--color-error-50': colors.error[50],
  '--color-error-100': colors.error[100],
  '--color-error-200': colors.error[200],
  '--color-error-300': colors.error[300],
  '--color-error-400': colors.error[400],
  '--color-error-500': colors.error[500],
  '--color-error-600': colors.error[600],
  '--color-error-700': colors.error[700],
  '--color-error-800': colors.error[800],
  '--color-error-900': colors.error[900],

  // 信息色
  '--color-info-50': colors.info[50],
  '--color-info-100': colors.info[100],
  '--color-info-200': colors.info[200],
  '--color-info-300': colors.info[300],
  '--color-info-400': colors.info[400],
  '--color-info-500': colors.info[500],
  '--color-info-600': colors.info[600],
  '--color-info-700': colors.info[700],
  '--color-info-800': colors.info[800],
  '--color-info-900': colors.info[900],

  // 中性色
  '--color-neutral-0': colors.neutral[0],
  '--color-neutral-50': colors.neutral[50],
  '--color-neutral-100': colors.neutral[100],
  '--color-neutral-200': colors.neutral[200],
  '--color-neutral-300': colors.neutral[300],
  '--color-neutral-400': colors.neutral[400],
  '--color-neutral-500': colors.neutral[500],
  '--color-neutral-600': colors.neutral[600],
  '--color-neutral-700': colors.neutral[700],
  '--color-neutral-800': colors.neutral[800],
  '--color-neutral-900': colors.neutral[900],
  '--color-neutral-950': colors.neutral[950],
} as const;

/**
 * 语义化颜色映射
 * 根据主题自动切换
 */
export const semanticColors = {
  light: {
    bgPrimary: colors.light.bg.primary,
    bgSecondary: colors.light.bg.secondary,
    bgTertiary: colors.light.bg.tertiary,
    textPrimary: colors.light.text.primary,
    textSecondary: colors.light.text.secondary,
    textTertiary: colors.light.text.tertiary,
    textDisabled: colors.light.text.disabled,
    borderDefault: colors.light.border.default,
    borderLight: colors.light.border.light,
    borderHeavy: colors.light.border.heavy,
  },
  dark: {
    bgPrimary: colors.dark.bg.primary,
    bgSecondary: colors.dark.bg.secondary,
    bgTertiary: colors.dark.bg.tertiary,
    textPrimary: colors.dark.text.primary,
    textSecondary: colors.dark.text.secondary,
    textTertiary: colors.dark.text.tertiary,
    textDisabled: colors.dark.text.disabled,
    borderDefault: colors.dark.border.default,
    borderLight: colors.dark.border.light,
    borderHeavy: colors.dark.border.heavy,
  },
} as const;

export default colors;
