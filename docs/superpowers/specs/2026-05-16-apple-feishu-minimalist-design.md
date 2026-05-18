# Apple + 飞书极简设计风格统一

> 日期: 2026-05-16
> 状态: 待实施

## 目标

将 Orion 前端所有页面的视觉效果统一为 Apple + 飞书极简设计风格，去除 Ant Design 默认的"企业后台"感，打造更精致、更现代的视觉体验。

## 设计原则

- **克制** — 低饱和度色彩，减少视觉噪音
- **透气** — 更大的间距和圆角，让内容呼吸
- **精致** — 扩散型阴影、细腻的渐变、紧凑的标题字间距
- **一致** — 通过 Design Token 体系全局统一，而非局部修补

## 色彩系统

### 主色

| Token | 旧值 | 新值 |
|-------|------|------|
| primary[50] | #e6f7ff | #EBF0FB |
| primary[100] | #bae7ff | #D7E1F7 |
| primary[200] | #91d5ff | #B3C5EE |
| primary[300] | #69c0ff | #8FA9E5 |
| primary[400] | #40a9ff | #5B8DEF |
| **primary[500]** | **#1890ff** | **#3370E6** |
| primary[600] | #0984e2 | #2B5DD6 |
| primary[700] | #006dc2 | #1F4BB5 |
| primary[800] | #005aa1 | #153A94 |
| primary[900] | #004780 | #0C2873 |

### 紫色

| Token | 旧值 | 新值 |
|-------|------|------|
| purple[500] | #722ed1 | #7C5CFC |
| purple[400] | #9254de | #9B7FFD |
| purple[600] | #531dab | #6349E0 |

### 中性色（仅调整 100）

| Token | 旧值 | 新值 |
|-------|------|------|
| neutral[100] | #f5f5f5 | #F5F5F7 |

### 背景色

| Token | 旧值 | 新值 |
|-------|------|------|
| light.bg.secondary | #fafafa | #F5F5F7 |

### 功能色

保持现有色相，不做调整。

## 圆角系统

### 基础圆角

| Token | 旧值 | 新值 |
|-------|------|------|
| radius.xs | 2px | 4px |
| radius.sm | 4px | 6px |
| radius.md | 6px | 8px |
| radius.lg | 8px | 12px |
| radius.xl | 12px | 16px |

### 组件圆角

| 组件 | 旧值 | 新值 |
|------|------|------|
| button.md | 4px | 6px |
| button.lg | 6px | 8px |
| card | 8px | 12px |
| modal | 12px | 16px |
| dropdown | 6px | 10px |
| input | 6px | 6px (保持) |
| tag | 4px | 6px |

## 阴影系统

### 基础阴影

| Token | 旧值 | 新值 |
|-------|------|------|
| xs | 0 1px 2px 0 rgba(0,0,0,0.05) | 0 1px 2px 0 rgba(0,0,0,0.04) |
| sm | 0 1px 3px + 0 1px 2px | 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04) |
| md | 0 4px 6px + 0 2px 4px | 0 4px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04) |
| lg | 0 10px 15px + 0 4px 6px | 0 8px 16px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06) |
| xl | 0 20px 25px + 0 8px 10px | 0 12px 24px rgba(0,0,0,0.12), 0 6px 12px rgba(0,0,0,0.08) |

### 语义化阴影

| Token | 新值 |
|-------|------|
| button | 0 1px 2px rgba(0,0,0,0.04) (保持轻阴影) |
| card | 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04) |
| dropdown | 0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06) |
| modal | 0 20px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08) |
| popover | 0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06) |

### 卡片 hover

```css
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

## 排版系统

### 标题

| 级别 | 旧值 | 新值 |
|------|------|------|
| H1 | 32px / 600 / 40px | 32px / 600 / 40px / -0.025em |
| H2 | 24px / 600 / 32px | 28px / 600 / 36px / -0.025em |
| H3 | 20px / 600 / 28px | 22px / 600 / 30px / -0.025em |
| H4 | 16px / 600 / 24px | 18px / 600 / 26px / -0.025em |

### 正文

| Token | 旧值 | 新值 |
|-------|------|------|
| fontSize.md | 14px | 14px (保持) |
| lineHeight.normal | 1.5 | 1.57 |

### 字体栈

```
SF Pro Display, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', ...
```

## 组件级覆盖

| Token | 旧值 | 新值 |
|-------|------|------|
| componentSize | 32 | 36 |
| borderRadius | 6px | 8px |

## 布局调整

| 元素 | 旧值 | 新值 |
|------|------|------|
| Header 高度 | 64px | 60px |
| Content margin | 16px 24px | 20px 32px |
| Content padding | 24px | 32px |
| Breadcrumb padding | 12px 24px | 10px 32px |

## Branding

| 元素 | 旧值 | 新值 |
|------|------|------|
| 渐变 | #1890ff → #722ed1 | #3370E6 → #7C5CFC |
| 字体粗细 | bold (700) | 600 |

## 变更文件清单

1. `orion-frontend/src/tokens/colors.ts` — 主色、紫色、中性色、背景色
2. `orion-frontend/src/tokens/radius.ts` — 基础圆角和组件圆角
3. `orion-frontend/src/tokens/shadows.ts` — 全部阴影值
4. `orion-frontend/src/tokens/typography.ts` — 标题、行高、字体栈、字间距
5. `orion-frontend/src/tokens/theme.ts` — Ant Design theme tokens
6. `orion-frontend/src/assets/styles/global.css` — CSS 变量同步
7. `orion-frontend/src/components/Layout/index.tsx` — 布局尺寸和 branding
