# Apple + 飞书极简设计风格统一 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Orion 前端 Design Token 体系从 Ant Design 默认风格迁移至 Apple + 飞书极简风格

**Architecture:** 修改 Design Token 层（colors → radius → shadows → typography），下游的 theme.ts 和 global.css 自动继承新值，最后调整 Layout 组件的硬编码尺寸。

**Tech Stack:** React 18 + Ant Design v5 + TypeScript + Vite + CSS Variables

---

## File Map

| 文件 | 职责 | 类型 |
|------|------|------|
| `src/tokens/colors.ts` | 色彩定义 + CSS 变量映射 | Modify |
| `src/tokens/radius.ts` | 圆角定义 + CSS 变量映射 | Modify |
| `src/tokens/shadows.ts` | 阴影定义 + CSS 变量映射 | Modify |
| `src/tokens/typography.ts` | 排版定义 + CSS 变量映射 | Modify |
| `src/tokens/theme.ts` | Ant Design v5 theme 配置 | Modify |
| `src/assets/styles/global.css` | 全局 CSS 变量硬编码 | Modify |
| `src/components/Layout/index.tsx` | 布局尺寸 + branding 渐变 | Modify |

**依赖关系:** Task 1-4 互相独立 → Task 5 依赖 1-4 → Task 6 依赖 1-4 → Task 7 依赖 5-6

---

### Task 1: 色彩系统更新

**Files:**
- Modify: `orion-frontend/src/tokens/colors.ts`

- [ ] **Step 1: 更新主色 primary 为飞书蓝 `#3370E6`**

将 `colors.primary` 从 Ant Design 经典蓝改为飞书蓝：

```ts
// 替换 primary 对象
primary: {
  50: '#EBF0FB',
  100: '#D7E1F7',
  200: '#B3C5EE',
  300: '#8FA9E5',
  400: '#5B8DEF',
  500: '#3370E6',
  600: '#2B5DD6',
  700: '#1F4BB5',
  800: '#153A94',
  900: '#0C2873',
},
```

- [ ] **Step 2: 更新紫色 purple 为更柔和的紫色 `#7C5CFC`**

```ts
// 替换 purple 对象
purple: {
  50: '#f9f0ff',
  100: '#efdbff',
  200: '#d3adf7',
  300: '#b37feb',
  400: '#9B7FFD',
  500: '#7C5CFC',
  600: '#6349E0',
  700: '#391085',
  800: '#22075e',
  900: '#110358',
},
```

- [ ] **Step 3: 更新中性色 neutral[100] 为 Apple 浅灰 `#F5F5F7`**

```ts
// 仅修改 neutral[100]
neutral: {
  // ... 其他不变
  100: '#F5F5F7', // 旧值: '#f5f5f5'
  // ...
},
```

- [ ] **Step 4: 更新浅色模式背景 light.bg.secondary**

```ts
light: {
  bg: {
    primary: '#ffffff',
    secondary: '#F5F5F7', // 旧值: '#fafafa'
    tertiary: '#f5f5f5',
    elevated: '#ffffff',
  },
  // ...
},
```

- [ ] **Step 5: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors related to colors.ts.

---

### Task 2: 圆角系统更新

**Files:**
- Modify: `orion-frontend/src/tokens/radius.ts`

- [ ] **Step 1: 更新基础圆角**

```ts
export const radius = {
  none: 0,
  xs: 4,    // 旧值: 2
  sm: 6,    // 旧值: 4
  md: 8,    // 旧值: 6
  lg: 12,   // 旧值: 8
  xl: 16,   // 旧值: 12
  xxl: 20,  // 保持不变
  full: 9999,

  // 数值圆角
  0: 0,
  1: 4,   // 旧值: 2
  2: 6,   // 旧值: 4
  3: 8,   // 旧值: 6
  4: 12,  // 旧值: 8
  5: 14,  // 旧值: 10
  6: 16,  // 旧值: 12
  8: 20,  // 旧值: 16
  10: 24,
  12: 28,
} as const;
```

- [ ] **Step 2: 更新组件圆角**

```ts
export const componentRadius = {
  button: {
    sm: 4,    // 旧值: 2
    md: 6,    // 旧值: 4
    lg: 8,    // 旧值: 6
  },
  card: 12,   // 旧值: 8
  modal: 16,  // 旧值: 12
  dropdown: 10, // 旧值: 6
  input: 6,   // 保持不变
  avatar: {
    square: 4,
    circle: 9999,
  },
  tag: 6,     // 旧值: 4
  badge: 9999,
} as const;
```

- [ ] **Step 3: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors.

---

### Task 3: 阴影系统更新

**Files:**
- Modify: `orion-frontend/src/tokens/shadows.ts`

- [ ] **Step 1: 更新基础阴影**

```ts
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  md: '0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.10), 0 4px 8px rgba(0, 0, 0, 0.06)',
  xl: '0 12px 24px rgba(0, 0, 0, 0.12), 0 6px 12px rgba(0, 0, 0, 0.08)',
  xxl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // 语义化阴影
  button: '0 1px 2px rgba(0, 0, 0, 0.04)',
  card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  dropdown:
    '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
  modal:
    '0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.08)',
  popover:
    '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',

  // 暗黑模式阴影
  dark: {
    card: '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
    dropdown:
      '0 8px 24px rgba(0, 0, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4)',
    modal:
      '0 20px 60px rgba(0, 0, 0, 0.7), 0 8px 20px rgba(0, 0, 0, 0.5)',
  },
} as const;
```

- [ ] **Step 2: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors.

---

### Task 4: 排版系统更新

**Files:**
- Modify: `orion-frontend/src/tokens/typography.ts`

- [ ] **Step 1: 更新字体系列，SF Pro 优先**

```ts
fontFamily: {
  base: 'SF Pro Display, -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif',
  code: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
  cn: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
},
```

- [ ] **Step 2: 更新标题字号和字间距**

```ts
headings: {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 600,
    letterSpacing: '-0.025em',
    marginTop: 0,
    marginBottom: 24,
  },
  h2: {
    fontSize: 28,     // 旧值: 24
    lineHeight: 36,   // 旧值: 32
    fontWeight: 600,
    letterSpacing: '-0.025em',
    marginTop: 32,
    marginBottom: 16,
  },
  h3: {
    fontSize: 22,     // 旧值: 20
    lineHeight: 30,   // 旧值: 28
    fontWeight: 600,
    letterSpacing: '-0.025em',
    marginTop: 24,
    marginBottom: 12,
  },
  h4: {
    fontSize: 18,     // 旧值: 16
    lineHeight: 26,   // 旧值: 24
    fontWeight: 600,
    letterSpacing: '-0.025em',
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
```

- [ ] **Step 3: 更新行高 normal**

```ts
lineHeight: {
  none: 1,
  tight: 1.25,
  normal: 1.57,   // 旧值: 1.5
  relaxed: 1.625,
  loose: 2,
  // 具体数值行保持不变
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '22px',
  xl: '28px',
  xxl: '32px',
  xxxl: '40px',
},
```

- [ ] **Step 4: 更新 textStyles.body 行高引用**

```ts
body: {
  fontSize: typography.fontSize.md,
  lineHeight: typography.lineHeight.normal,  // 已自动变为 1.57
  fontWeight: typography.fontWeight.normal,
},
```

This is auto-updated since it references `typography.lineHeight.normal`. No code change needed — just verify the reference is correct.

- [ ] **Step 5: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors.

---

### Task 5: Ant Design Theme Token 更新

**Files:**
- Modify: `orion-frontend/src/tokens/theme.ts`

- [ ] **Step 1: 更新 designTokens 中的 borderRadius**

```ts
const designTokens = {
  // 颜色 (自动继承 colors.ts 的新值)
  colorPrimary: colors.primary[500],
  colorSuccess: colors.success[500],
  colorWarning: colors.warning[500],
  colorError: colors.error[500],
  colorInfo: colors.info[500],

  // 间距 (保持不变)
  paddingXS: spacing.xs,
  paddingSM: spacing.sm,
  padding: spacing.md,
  paddingLG: spacing.lg,
  paddingXL: spacing.xl,

  // 圆角 (自动继承 radius.ts 的新值)
  borderRadiusXS: radius.xs,
  borderRadiusSM: radius.sm,
  borderRadius: radius.md,
  borderRadiusLG: radius.lg,

  // 字体 (自动继承 typography.ts 的新值)
  fontSizeSM: typography.fontSize.sm,
  fontSize: typography.fontSize.md,
  fontSizeLG: typography.fontSize.lg,
  fontSizeXL: typography.fontSize.xl,
  fontFamily: typography.fontFamily.base,

  // 阴影 (自动继承 shadows.ts 的新值)
  boxShadow: shadows.md,
  boxShadowSecondary: shadows.sm,
  boxShadowTertiary: shadows.xs,

  // 动画
  motionDurationFast: `${animation.duration.fast}ms`,
  motionDurationMid: `${animation.duration.normal}ms`,
  motionDurationSlow: `${animation.duration.slow}ms`,
  motionEaseInOut: animation.easing.easeInOut,
  motionEaseOut: animation.easing.easeOut,
} as const;
```

- [ ] **Step 2: 更新 componentOverrides**

```ts
const componentOverrides = {
  Card: {
    paddingLG: spacing.lg,
    borderRadiusLG: componentRadius.card,    // 自动变为 12px
    boxShadow: shadows.card,
  },
  Button: {
    paddingXS: spacing.xs,
    paddingSM: spacing.sm,
    borderRadiusSM: componentRadius.button.md, // 自动变为 6px
    boxShadowSecondary: shadows.button,
  },
  Table: {
    paddingSM: spacing.sm,
    padding: spacing.md,
    borderRadiusLG: radius.md,
  },
  Input: {
    paddingSM: spacing.sm,
    padding: spacing.md,
    borderRadiusSM: componentRadius.input,
    boxShadowSecondary: shadows.none,
  },
  Statistic: {
    padding: spacing.md,
    borderRadiusLG: radius.lg,
    boxShadow: shadows.sm,
  },
} as const;
```

- [ ] **Step 3: 更新 lightTheme token**

```ts
export const lightTheme = {
  token: {
    ...designTokens,
    colorText: colors.light.text.primary,
    colorTextSecondary: colors.light.text.secondary,
    colorTextTertiary: colors.light.text.tertiary,
    colorTextQuaternary: colors.light.text.disabled,
    colorBgLayout: colors.light.bg.secondary,
    colorBgContainer: colors.light.bg.primary,
    colorBgElevated: colors.light.bg.elevated,
    colorBorder: colors.light.border.default,
    colorBorderSecondary: colors.light.border.light,
    lineWidth: 1,
    lineWidthBold: 2,
    componentSize: 36,   // 旧值: 32
    wireframe: false,
  },
  components: componentOverrides,
};
```

- [ ] **Step 4: 更新 darkTheme token**

```ts
export const darkTheme = {
  token: {
    colorPrimary: colors.primary[400],
    colorSuccess: colors.success[400],
    colorWarning: colors.warning[400],
    colorError: colors.error[400],
    colorInfo: colors.info[400],
    colorText: colors.dark.text.primary,
    colorTextSecondary: colors.dark.text.secondary,
    colorTextTertiary: colors.dark.text.tertiary,
    colorTextQuaternary: colors.dark.text.disabled,
    colorBgLayout: colors.dark.bg.primary,
    colorBgContainer: colors.dark.bg.secondary,
    colorBgElevated: colors.dark.bg.elevated,
    colorBorder: colors.dark.border.default,
    colorBorderSecondary: colors.dark.border.light,
    borderRadiusXS: radius.xs,
    borderRadiusSM: radius.sm,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    paddingXS: spacing.xs,
    paddingSM: spacing.sm,
    padding: spacing.md,
    paddingLG: spacing.lg,
    paddingXL: spacing.xl,
    fontSizeSM: typography.fontSize.sm,
    fontSize: typography.fontSize.md,
    fontSizeLG: typography.fontSize.lg,
    fontSizeXL: typography.fontSize.xl,
    fontFamily: typography.fontFamily.base,
    boxShadow: shadows.dark.card,
    boxShadowSecondary: shadows.sm,
    boxShadowTertiary: shadows.xs,
    motionDurationFast: `${animation.duration.fast}ms`,
    motionDurationMid: `${animation.duration.normal}ms`,
    motionDurationSlow: `${animation.duration.slow}ms`,
    motionEaseInOut: animation.easing.easeInOut,
    motionEaseOut: animation.easing.easeOut,
    lineWidth: 1,
    lineWidthBold: 2,
    componentSize: 36,   // 旧值: 32
    wireframe: false,
  },
  components: {
    ...componentOverrides,
    Card: {
      ...componentOverrides.Card,
      boxShadow: shadows.dark.card,
    },
  },
};
```

- [ ] **Step 5: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors.

---

### Task 6: 全局 CSS 变量同步

**Files:**
- Modify: `orion-frontend/src/assets/styles/global.css`

- [ ] **Step 1: 更新 :root 色彩变量**

```css
:root {
  /* 主色 - 飞书蓝 */
  --color-primary-50: #EBF0FB;
  --color-primary-100: #D7E1F7;
  --color-primary-200: #B3C5EE;
  --color-primary-300: #8FA9E5;
  --color-primary-400: #5B8DEF;
  --color-primary-500: #3370E6;
  --color-primary-600: #2B5DD6;
  --color-primary-700: #1F4BB5;
  --color-primary-800: #153A94;
  --color-primary-900: #0C2873;

  /* 成功色 (保持) */
  --color-success-50: #f6ffed;
  --color-success-100: #d9f7be;
  --color-success-200: #b7eb8f;
  --color-success-300: #95de64;
  --color-success-400: #73d13d;
  --color-success-500: #52c41a;
  --color-success-600: #389e0d;
  --color-success-700: #237804;
  --color-success-800: #135200;
  --color-success-900: #092b00;

  /* 警告色 (保持) */
  --color-warning-50: #fffbe6;
  --color-warning-100: #fff7e6;
  --color-warning-200: #ffecb3;
  --color-warning-300: #ffe58f;
  --color-warning-400: #ffd666;
  --color-warning-500: #faad14;
  --color-warning-600: #d48806;
  --color-warning-700: #ad6800;
  --color-warning-800: #874d00;
  --color-warning-900: #613400;

  /* 错误色 (保持) */
  --color-error-50: #fff1f0;
  --color-error-100: #ffccc7;
  --color-error-200: #ffa39e;
  --color-error-300: #ff7875;
  --color-error-400: #ff4d4f;
  --color-error-500: #f5222d;
  --color-error-600: #cf1322;
  --color-error-700: #a8071a;
  --color-error-800: #85000c;
  --color-error-900: #5c0011;

  /* 信息色 (保持) */
  --color-info-50: #e8f4fd;
  --color-info-100: #c6e2fc;
  --color-info-200: #a3d0fa;
  --color-info-300: #80bdf8;
  --color-info-400: #5dabf6;
  --color-info-500: #3a98f4;
  --color-info-600: #2e7ac5;
  --color-info-700: #235c95;
  --color-info-800: #173e64;
  --color-info-900: #0c1f33;

  /* 紫色 */
  --color-purple-500: #7C5CFC;
  --color-purple-400: #9B7FFD;
  --color-purple-600: #6349E0;

  /* 中性色 */
  --color-neutral-0: #ffffff;
  --color-neutral-50: #fafafa;
  --color-neutral-100: #F5F5F7;
  --color-neutral-200: #f0f0f0;
  --color-neutral-300: #d9d9d9;
  --color-neutral-400: #bfbfbf;
  --color-neutral-500: #8c8c8c;
  --color-neutral-600: #595959;
  --color-neutral-700: #434343;
  --color-neutral-800: #262626;
  --color-neutral-900: #1f1f1f;
  --color-neutral-950: #141414;
}
```

- [ ] **Step 2: 更新 [data-theme='light'] 背景色**

```css
[data-theme='light'] {
  --bg-primary: #ffffff;
  --bg-secondary: #F5F5F7;    /* 旧值: #fafafa */
  --bg-tertiary: #f5f5f5;
  --bg-elevated: #ffffff;
  --text-primary: #1f1f1f;
  --text-secondary: #434343;
  --text-tertiary: #595959;
  --text-disabled: #bfbfbf;
  --border-default: #d9d9d9;
  --border-light: #f0f0f0;
  --border-heavy: #bfbfbf;
  --shadow-card:
    0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 3: 更新 [data-theme='dark'] 阴影**

```css
[data-theme='dark'] {
  --bg-primary: #141414;
  --bg-secondary: #1f1f1f;
  --bg-tertiary: #262626;
  --bg-elevated: #434343;
  --text-primary: #ffffff;
  --text-secondary: #d9d9d9;
  --text-tertiary: #8c8c8c;
  --text-disabled: #595959;
  --border-default: #434343;
  --border-light: #262626;
  --border-heavy: #595959;
  --shadow-card:
    0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 4: 更新圆角变量**

```css
:root {
  --radius-none: 0;
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-xxl: 20px;
  --radius-full: 9999px;
}
```

- [ ] **Step 5: 更新阴影变量**

```css
:root {
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 400ms;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* 阴影 */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.10), 0 4px 8px rgba(0, 0, 0, 0.06);
  --shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.12), 0 6px 12px rgba(0, 0, 0, 0.08);
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06);
  --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.08);
}
```

- [ ] **Step 6: 更新字体变量**

```css
:root {
  --font-family-base:
    SF Pro Display, -apple-system, BlinkMacSystemFont, 'PingFang SC',
    'Helvetica Neue', Arial, 'Noto Sans', sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-family-code: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;

  --font-size-xs: 10px;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-xxl: 24px;
  --font-size-xxxl: 32px;

  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-none: 1;
  --line-height-tight: 1.25;
  --line-height-normal: 1.57;
  --line-height-relaxed: 1.625;
  --line-height-loose: 2;

  --letter-spacing-tight: -0.025em;
  --letter-spacing-normal: 0;
}
```

- [ ] **Step 7: 更新 body 背景**

```css
body {
  background-color: #F5F5F7;  /* 旧值: var(--ant-color-bg-layout, #f0f2f5) */
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 8: 更新卡片 hover 效果**

```css
.orion-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}
```

- [ ] **Step 9: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors.

---

### Task 7: Layout 组件布局尺寸与 Branding 更新

**Files:**
- Modify: `orion-frontend/src/components/Layout/index.tsx`

- [ ] **Step 1: 更新 Header 高度和样式**

```tsx
// Header style 对象修改
<Header
  style={{
    padding: '0 32px',               // 旧值: '0 24px'
    background: theme === 'dark' ? colors.dark.bg.primary : colors.light.bg.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', // 轻阴影
    height: 60,                       // 旧值: 64
    overflow: 'visible',
  }}
>
```

- [ ] **Step 2: 更新 Branding 渐变和字重**

```tsx
<span
  style={{
    fontSize: 16,
    fontWeight: 600,                  // 旧值: 'bold'
    background: `linear-gradient(135deg, #3370E6 0%, #7C5CFC 100%)`,  // 新渐变
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    whiteSpace: 'nowrap',
  }}
>
  Orion Platform
</span>
```

- [ ] **Step 3: 更新 Content 区域间距**

```tsx
<Content
  style={{
    margin: '20px 32px',              // 旧值: '16px 24px'
    background: theme === 'dark' ? colors.dark.bg.primary : colors.light.bg.primary,
    borderRadius: 12,
    padding: 32,                      // 旧值: 24
    minHeight: 'calc(100vh - 180px)',
    boxShadow: theme === 'dark'
      ? '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)'
      : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  }}
>
```

- [ ] **Step 4: 更新 Breadcrumb 区域间距**

```tsx
<div
  style={{
    background: theme === 'dark' ? colors.dark.bg.primary : colors.light.bg.tertiary,
    padding: '10px 32px',             // 旧值: '12px 24px'
  }}
>
```

- [ ] **Step 5: 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit
```

Expected: No new errors.

---

### Task 8: 构建验证与最终检查

**Files:**
- No code changes

- [ ] **Step 1: 构建项目**

```bash
cd orion-frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: 运行测试**

```bash
cd orion-frontend && npm run test -- --run
```

Expected: All tests pass (same count as before, no regressions).

- [ ] **Step 3: 提交**

```bash
git add orion-frontend/src/tokens/colors.ts \
        orion-frontend/src/tokens/radius.ts \
        orion-frontend/src/tokens/shadows.ts \
        orion-frontend/src/tokens/typography.ts \
        orion-frontend/src/tokens/theme.ts \
        orion-frontend/src/assets/styles/global.css \
        orion-frontend/src/components/Layout/index.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): unify Apple + Feishu minimalist design tokens

- Primary color: #1890ff → #3370E6 (Feishu Blue)
- Purple: #722ed1 → #7C5CFC (softer)
- Background: #fafafa → #F5F5F7 (Apple light gray)
- Card radius: 8px → 12px, Button: 4px → 6px
- Shadows: lighter, Apple-style diffusion effect
- Typography: larger H2-H4, SF Pro Display first, tight letter-spacing
- Layout: larger margins/padding, Header 64px → 60px
- Branding gradient: refined blue-purple gradient
EOF
)"
```
