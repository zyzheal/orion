/**
 * Orion Design Tokens - 排版系统
 * 定义字体、字号、行高等排版相关的设计令牌
 */

export const typography = {
  // ============ 字体系列 ============
  fontFamily: {
    base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    code: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
    cn: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  },

  // ============ 字号系统 ============
  fontSize: {
    xs: 10, // 辅助文字
    sm: 12, // 次要文字
    md: 14, // 正文
    lg: 16, // 标题小字
    xl: 20, // 三级标题
    xxl: 24, // 二级标题
    xxxl: 32, // 一级标题
    display: 48, // 展示文字
  },

  // ============ 行高系统 ============
  lineHeight: {
    none: 1,
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
    // 具体数值
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '22px',
    xl: '28px',
    xxl: '32px',
    xxxl: '40px',
  },

  // ============ 字重系统 ============
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // ============ 字间距 ============
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // ============ 段落间距 ============
  paragraph: {
    marginTop: '0',
    marginBottom: '1em',
  },

  // ============ 标题样式 ============
  headings: {
    h1: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: 600,
      marginTop: 0,
      marginBottom: 24,
    },
    h2: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: 600,
      marginTop: 32,
      marginBottom: 16,
    },
    h3: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: 600,
      marginTop: 24,
      marginBottom: 12,
    },
    h4: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: 600,
      marginTop: 16,
      marginBottom: 8,
    },
    h5: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: 600,
      marginTop: 12,
      marginBottom: 8,
    },
    h6: {
      fontSize: 12,
      lineHeight: 20,
      fontWeight: 600,
      marginTop: 8,
      marginBottom: 4,
    },
  },
} as const;

/**
 * 语义化文本样式
 */
export const textStyles = {
  // 正文
  body: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.normal,
    fontWeight: typography.fontWeight.normal,
  },

  // 标题
  heading: {
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.tight,
    fontWeight: typography.fontWeight.semibold,
  },

  // 小字
  small: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.normal,
    fontWeight: typography.fontWeight.normal,
  },

  // 辅助文字
  caption: {
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.normal,
    fontWeight: typography.fontWeight.normal,
  },

  // 代码
  code: {
    fontFamily: typography.fontFamily.code,
    fontSize: '0.9em',
    lineHeight: typography.lineHeight.normal,
  },

  // 强调
  strong: {
    fontWeight: typography.fontWeight.bold,
  },

  // 链接
  link: {
    color: 'var(--color-primary-500)',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
} as const;

export default typography;

/**
 * CSS Variables 映射
 */
export const typographyCSSVariables: Record<string, string> = {};
for (const [key, value] of Object.entries(typography.fontFamily)) {
  typographyCSSVariables[`--font-family-${key}`] = value;
}
for (const [key, value] of Object.entries(typography.fontSize)) {
  if (typeof value === 'number') {
    typographyCSSVariables[`--font-size-${key}`] = `${value}px`;
  }
}
for (const [key, value] of Object.entries(typography.fontWeight)) {
  typographyCSSVariables[`--font-weight-${key}`] = String(value);
}
for (const [key, value] of Object.entries(typography.letterSpacing)) {
  typographyCSSVariables[`--letter-spacing-${key}`] = value;
}
