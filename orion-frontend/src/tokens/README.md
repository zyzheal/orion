# Orion Design Tokens

基于 W3C Design Tokens 社区组提案标准的设计令牌系统，符合 WCAG 2.1 AA 无障碍标准。

## 使用方式

### 1. JavaScript/TypeScript 使用

```typescript
import { designTokens, colors, spacing, radius } from '@/tokens';

// 使用语义化 tokens
const primaryColor = designTokens.colors.primary[500];
const mediumSpacing = designTokens.spacing.md;
const smallRadius = designTokens.radius.sm;

// 直接使用命名导出
const successColor = colors.success[500];
const largeSpacing = spacing.lg;
```

### 2. CSS Variables 使用

```css
/* 使用 CSS 变量 */
.button {
  background-color: var(--color-primary-500);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--text-primary);
}

/* 主题切换 */
[data-theme='dark'] .button {
  background-color: var(--color-primary-400);
}
```

### 3. Ant Design 主题配置

```typescript
import { lightTheme, darkTheme } from '@/tokens/theme';

<ConfigProvider theme={lightTheme}>
  <App />
</ConfigProvider>
```

## Tokens 分类

### Colors (色彩系统)

| 分类    | 说明   | 示例                              |
| ------- | ------ | --------------------------------- |
| primary | 主色   | `colors.primary[500]` = `#1890ff` |
| success | 成功色 | `colors.success[500]` = `#52c41a` |
| warning | 警告色 | `colors.warning[500]` = `#faad14` |
| error   | 错误色 | `colors.error[500]` = `#f5222d`   |
| info    | 信息色 | `colors.info[500]` = `#1890ff`    |
| neutral | 中性色 | `colors.neutral[500]` = `#8c8c8c` |

### Spacing (间距系统)

基于 4px 网格系统：

| Token | 值   | 使用场景 |
| ----- | ---- | -------- |
| xs    | 4px  | 极小间距 |
| sm    | 8px  | 小间距   |
| md    | 16px | 中间距   |
| lg    | 24px | 大间距   |
| xl    | 32px | 超大间距 |
| xxl   | 48px | 特大间距 |

### Radius (圆角系统)

| Token | 值     | 使用场景 |
| ----- | ------ | -------- |
| none  | 0      | 直角     |
| xs    | 2px    | 极小圆角 |
| sm    | 4px    | 小圆角   |
| md    | 6px    | 中等圆角 |
| lg    | 8px    | 大圆角   |
| xl    | 12px   | 超大圆角 |
| full  | 9999px | 圆形     |

### Typography (排版系统)

```typescript
import { typography } from '@/tokens';

typography.fontFamily.base; // 基础字体
typography.fontSize.md; // 14px 正文
typography.lineHeight.normal; // 1.5 行高
typography.fontWeight.medium; // 500 字重
```

### Shadows (阴影系统)

```typescript
import { shadows } from '@/tokens';

shadows.sm; // 小阴影
shadows.md; // 中等阴影
shadows.lg; // 大阴影
```

### Z-Index (层级系统)

```typescript
import { zIndex } from '@/tokens';

zIndex.dropdown; // 1000 - 下拉菜单
zIndex.modal; // 1050 - 弹窗
zIndex.toast; // 1080 - 消息提示
```

### Animation (动画系统)

```typescript
import { animation } from '@/tokens';

animation.duration.fast; // 200ms
animation.easing.easeOut; // cubic-bezier(0, 0, 0.2, 1)
```

## WCAG 2.1 AA 对比度验证

```typescript
import { meetsWCAGAA, getContrastRatio } from '@/tokens/utils';

// 检查颜色组合是否符合 AA 标准
const passes = meetsWCAGAA('#1f1f1f', '#ffffff', 'normal'); // true
const ratio = getContrastRatio('#1890ff', '#ffffff'); // 2.65
```

## 主题切换

```typescript
import { useAppStore } from '@/stores/appStore';
import { semanticColors } from '@/tokens';

function MyComponent() {
  const { theme } = useAppStore();
  const colors = semanticColors[theme];

  return (
    <div style={{
      backgroundColor: colors.bgPrimary,
      color: colors.textPrimary
    }}>
      Content
    </div>
  );
}
```

## 设计原则

1. **一致性**: 所有令牌使用统一的命名和数值系统
2. **可扩展性**: 支持未来新增令牌而不破坏现有代码
3. **无障碍性**: 所有颜色组合符合 WCAG 2.1 AA 标准
4. **主题化**: 支持浅色和暗黑模式切换
5. **跨平台**: 支持 JavaScript、CSS、Design 工具使用

## 更新日志

- 2026-04-11: 初始版本，包含完整的 Design Tokens 系统
