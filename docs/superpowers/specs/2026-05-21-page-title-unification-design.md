# 页面标题统一设计规范

## 概述

本文档定义了 Orion 平台所有页面标题的统一样式规范，确保8大菜单模块下的页面标题保持视觉一致性。

**目标用户**：产品专家、视觉交互设计师、前端开发工程师

**评审重点**：样式规范、图标选择、间距系统、视觉层次

---

## 1. 页面主标题样式规范

### 1.1 基础样式

| 属性 | 规范值 | 说明 |
|------|--------|------|
| 标题级别 | `level={2}` | 所有页面主标题统一使用 H2 |
| 字体大小 | `20px` | 对应 Ant Design Typography Title level=2 |
| 字体粗细 | `600` (fontWeight) | 加粗突出主标题 |
| 字体颜色 | `#1f1f1f` (neutral[900]) | 主标题深色高对比 |
| 底部间距 | `8px` (marginBottom) | 与副标题保持间距 |
| 对齐方式 | 左对齐 (默认) | 特殊场景可居中 |

### 1.2 代码示例

```jsx
import { Title } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

<Title level={2} style={{ marginBottom: 8 }}>
  <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面标题
</Title>
```

### 1.3 可选装饰线样式 (视觉增强)

在主标题左侧增加 3px 装饰线，增强视觉层次感：

```jsx
<div style={{
  borderLeft: `3px solid ${colors.primary[500]}`,
  paddingLeft: 12,
  marginBottom: 16
}}>
  <Title level={2} style={{ marginBottom: 0 }}>
    页面标题
  </Title>
</div>
```

**视觉示意**：

```
┌─────────────────────────────────────────────┐
│  │  🔵 页面主标题                            │
│  │                                            │
│  └──────────────────────────────────────────  │  ← 装饰线 (可选)
│                                             │
│  [页面内容]                                  │
└─────────────────────────────────────────────┘
```

**使用建议**：装饰线为可选项，建议在「治理」「安全」类严肃风格页面使用，「工作台」「AI平台」类页面可省略。

---

## 2. 标题图标规范

### 2.1 图标使用规则

| 属性 | 规范值 | 说明 |
|------|--------|------|
| 图标位置 | 标题文字左侧 | 视觉引导 |
| 图标间距 | `marginRight: 12px` | 与文字保持呼吸感 |
| 图标大小 | Ant Design 默认 | 约 18-20px |
| 图标颜色 | `#3370E6` (primary[500]) | 与品牌色统一 |

### 2.2 推荐图标映射表

| 菜单模块 | 图标 | 场景 |
|----------|------|------|
| 工作台 | `DashboardOutlined` | 仪表盘、看板类页面 |
| 控制台 | `SettingOutlined` | 系统配置、管理页面 |
| 交付 | `CloudUploadOutlined` | CI/CD、流水线、部署 |
| 可观测性 | `RadarChartOutlined` | 监控、告警、诊断 |
| AI 平台 | `RobotOutlined` | AI 相关功能 |
| 基础设施 | `ClusterOutlined` | 环境、中间件、CMDB |
| 治理 | `SafetyCertificateOutlined` | 安全、合规、审批 |
| 生态 | `AppstoreOutlined` | 扩展能力、子系统 |

### 2.3 特殊页面图标

| 页面类型 | 推荐图标 |
|----------|---------|
| 列表页面 | `UnorderedListOutlined` |
| 详情页面 | `FileTextOutlined` |
| 创建/编辑 | `PlusOutlined` / `EditOutlined` |
| 统计/分析 | `BarChartOutlined` |
| 设置 | `SettingOutlined` |
| 用户 | `UserOutlined` |

---

## 3. 副标题/描述样式规范

### 3.1 样式定义

| 属性 | 规范值 | 说明 |
|------|--------|------|
| 组件 | `Typography.Text` | 使用 Ant Design 文本组件（可选） |
| 字号 | `14px` | 较主标题小，辅助信息 |
| 颜色 | `#8c8c8c` (neutral[500]) | 中性灰，降低视觉权重 |
| 底部间距 | `16px` | 与主要内容区分 |

### 3.2 代码示例

```jsx
import { Typography } from 'antd';

<Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
  页面描述文字，说明当前页面的功能和用途
</Typography.Text>
```

### 3.3 无副标题场景

并非所有页面都需要副标题。无副标题时，主标题底部间距调整为 **16px**：

```jsx
// 无副标题
<Title level={2} style={{ marginBottom: 16 }}>
  页面标题
</Title>

// 有副标题
<Title level={2} style={{ marginBottom: 8 }}>
  页面标题
</Title>
<Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
  副标题描述
</Typography.Text>
```

---

## 4. 完整页面标题布局

### 4.1 标准结构（有副标题）

```jsx
import { Typography, Title } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

<div>
  <Title level={2} style={{ marginBottom: 8 }}>
    <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    页面主标题
  </Title>
  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
    页面描述文字，说明当前页面的功能和用途
  </Typography.Text>
  {/* 页面内容区域 */}
</div>
```

### 4.2 标准结构（无副标题）

```jsx
<div>
  <Title level={2} style={{ marginBottom: 16 }}>
    <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    页面主标题
  </Title>
  {/* 页面内容区域 */}
</div>
```

### 4.3 视觉示意

```
┌─────────────────────────────────────────────┐
│  🔵 DashboardOutlined  页面主标题            │  ← level={2}, 20px, #1f1f1f
│                                             │
│  页面描述文字，说明当前页面的功能和用途        │  ← 14px, #8c8c8c (可选)
│                                             │
│  ─────────────────────────────────────────  │  ← 分隔线 (可选)
│                                             │
│  [页面主要内容区域]                          │
└─────────────────────────────────────────────┘
```

---

## 5. 间距系统

### 5.1 标题区域间距

| 场景 | 间距值 | Token |
|------|--------|-------|
| 主标题底部（有副标题） | `8px` | `spacing.sm` |
| 主标题底部（无副标题） | `16px` | `spacing.md` |
| 副标题底部 | `16px` | `spacing.md` |
| 标题与内容区 | `16px` | `spacing.md` |
| Section 标题间距 | `12px` | - |

### 5.2 与 Design Token 对应

- `spacing.xs` = 4px
- `spacing.sm` = 8px
- `spacing.md` = 16px
- `spacing.lg` = 24px

---

## 6. 特殊情况处理

### 6.1 页面内嵌标题 (Section 标题)

部分页面包含多个 Section，每个 Section 可使用 `level={3}`：

```jsx
<Title level={3} style={{ marginBottom: 12 }}>Section 标题</Title>
<div>Section 内容...</div>
```

**多级标题分隔线**：当同一页面存在多个 Section 标题时，可在标题下方增加分隔线：

```jsx
<>
  <Title level={3} style={{ marginBottom: 12 }}>Section 1</Title>
  <div style={{ marginBottom: 24 }}>Section 1 内容</div>

  <Divider style={{ margin: '16px 0' }} />

  <Title level={3} style={{ marginBottom: 12 }}>Section 2</Title>
  <div>Section 2 内容</div>
</>
```

### 6.2 卡片内标题

卡片内标题可适当降级使用 `level={4}`：

```jsx
<Card>
  <Title level={4}>卡片标题</Title>
  卡片内容...
</Card>
```

### 6.3 居中场景

部分营销页、登录页可使用居中布局：

```jsx
<div style={{ textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
  <Title level={2} style={{ marginBottom: 16 }}>
    标题文字
  </Title>
  <Typography.Text type="secondary">
    副标题描述
  </Typography.Text>
</div>
```

---

## 7. 标题与面包屑导航

### 7.1 布局层级

页面顶部布局建议（面包屑 + 标题）：

```
[面包屑]  首页 / 工作台 / 项目管理          ← 14px, #8c8c8c
┌─────────────────────────────────────────┐
│  🔵  项目管理                             │  ← 主标题 level={2}
│     项目列表与协作管理                    │  ← 副标题 (可选)
└─────────────────────────────────────────┘
```

### 7.2 间距关系

| 场景 | 间距值 |
|------|--------|
| 面包屑底部 | 16px |
| 主标题底部（有副标题） | 8px |
| 主标题底部（无副标题） | 16px |
| 副标题底部 | 16px |

### 7.3 代码示例

```jsx
import { Breadcrumb, Typography, Title } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

<div>
  <Breadcrumb style={{ marginBottom: 16 }}>
    <Breadcrumb.Item>首页</Breadcrumb.Item>
    <Breadcrumb.Item>工作台</Breadcrumb.Item>
    <Breadcrumb.Item>项目管理</Breadcrumb.Item>
  </Breadcrumb>

  <Title level={2} style={{ marginBottom: 8 }}>
    <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    项目管理
  </Title>
  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
    项目列表与协作管理
  </Typography.Text>
</div>
```

---

## 8. 响应式适配

### 8.1 断点定义

| 屏幕宽度 | 主标题字号 | 副标题字号 | 图标大小 |
|----------|------------|------------|----------|
| ≥1200px (桌面) | 20px (level=2) | 14px | 18px |
| 768px-1199px (平板) | 18px (level=3) | 13px | 16px |
| <768px (手机) | 16px (level=3) | 12px | 14px |

### 8.2 响应式代码示例

```jsx
import { useBreakpoint } from '@/hooks/useBreakpoint';

const PageTitle = ({ title, description, icon }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.lg;

  return (
    <Title
      level={isMobile ? 3 : 2}
      style={{
        marginBottom: 8,
        fontSize: isMobile ? 18 : 20
      }}
    >
      {React.cloneElement(icon, {
        style: { marginRight: 12, color: colors.primary[500], fontSize: isMobile ? 16 : 18 }
      })}
      {title}
    </Title>
  );
};
```

### 8.3 暗色模式适配

| 元素 | 浅色模式 | 暗色模式 |
|------|----------|----------|
| 主标题 | `#1f1f1f` | `rgba(255,255,255,0.85)` |
| 副标题 | `#8c8c8c` | `rgba(255,255,255,0.45)` |
| 图标 | `#3370E6` | `#4B9FE8` (稍亮) |
| 装饰线 | `#3370E6` | `#4B9FE8` |

**暗色模式代码示例**：

```jsx
import { theme } from 'antd';

const { useToken } = theme;

const PageTitle = ({ title, icon }) => {
  const { token } = useToken();
  const isDark = token.colorBgBase === '#141414';

  return (
    <Title level={2} style={{ marginBottom: 16 }}>
      {React.cloneElement(icon, {
        style: {
          marginRight: 12,
          color: isDark ? '#4B9FE8' : colors.primary[500]
        }
      })}
      <span style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#1f1f1f' }}>
        {title}
      </span>
    </Title>
  );
};
```

---

## 9. 8大菜单模块清单

| 模块 | 路由前缀 | 页面数量(约) | 涉及文件目录 |
|------|----------|-------------|-------------|
| 工作台 | `/workbench`, `/dashboard` | 12 | DashboardNew, Projects, TicketList... |
| 控制台 | `/console` | 8 | Console, PluginManagement, UserManagement... |
| 交付 | `/pipelines`, `/deployments` | 15 | PipelineList, DeploymentList, ArtifactBrowser... |
| 可观测性 | `/observability`, `/alerts` | 10 | Monitoring, AlertList, Diagnostic... |
| AI 平台 | `/ai` | 12 | AIReview, AISecurity, LLMTraceDashboard... |
| 基础设施 | `/environments`, `/cmdb` | 18 | Environments, CMDB, Queue... |
| 治理 | `/governance`, `/policies` | 15 | PolicyManagement, AuditLog, Approvals... |
| 生态 | `/ecosystem`, `/skills` | 8 | SkillManagement, KnowledgeBase... |

**总计**：约 100+ 页面需要统一标题样式

---

## 10. 验收标准

### 10.1 视觉验收

- [ ] 所有页面主标题使用 `level={2}`（响应式场景除外）
- [ ] 主标题左侧带图标，颜色为品牌色 `#3370E6`
- [ ] 主标题与副标题间距为 8px
- [ ] 无副标题时主标题底部间距为 16px
- [ ] 副标题颜色为中性灰 `#8c8c8c`
- [ ] 整体标题区域与内容区保持 16px 间距
- [ ] 暗色模式标题颜色正确适配

### 10.2 代码验收

- [ ] 使用 Design Token 颜色值（避免硬编码）
- [ ] 使用 Ant Design Typography 组件
- [ ] 图标与文字间距为 12px

---

## 11. 评审意见收集

### 评审人

| 角色 | 姓名 | 评审日期 |
|------|------|---------|
| 产品专家 | 张明 (产品经理) | 2026-05-21 |
| 视觉交互设计师 | 李华 (UI/UX 设计师) | 2026-05-21 |

### 评审意见 (产品专家视角)

| 序号 | 评审意见 | 处理结果 |
|------|---------|---------|
| 1 | **【建议】增加"页面面包屑"说明**：当前规范聚焦标题本身，但实际页面常包含面包屑导航。建议补充面包屑与标题的层级关系说明，避免视觉冲突。 | ✅ 已补充：新增第7章「标题与面包屑导航」 |
| 2 | **【建议】补充"无副标题"场景**：并非所有页面都有副标题描述，建议明确「无副标题」时的底部间距是否仍为16px，还是可以缩减。 | ✅ 已明确：3.3节新增无副标题场景，间距为16px |
| 3 | **【建议】移动端适配说明**：当前规范主要针对桌面端，建议补充移动端响应式标题样式（如屏幕<768px时的字号调整）。 | ✅ 已补充：新增第8章「响应式适配」 |
| 4 | **【确认】副标题必要性**：产品角度建议将「副标题/描述」设为可选而非必选，因为部分页面标题本身已足够清晰。 | ✅ 已确认：规范中明确「可选」 |

### 评审意见 (视觉交互设计师视角)

| 序号 | 评审意见 | 处理结果 |
|------|---------|---------|
| 1 | **【建议】图标颜色可适度调整**：当前规范统一使用品牌色 `#3370E6`，但从视觉层次角度，建议可根据页面主色调适度调整（如安全类页面可用绿色强调）。 | ⚠️ 保留原方案：品牌一致性优先，后续可通过 Design Token 扩展 |
| 2 | **【建议】增加标题左侧装饰线**：参考 Apple/飞书风格，可在标题左侧增加 3px 装饰线（颜色与图标一致），增强视觉层次感。 | ✅ 已补充：新增1.3节「可选装饰线样式」 |
| 3 | **【确认】间距系统合理**：8px/16px 间距符合 4px 网格系统，与现有 Design Token 一致，视觉上可行。 | ✅ 确认通过 |
| 4 | **【建议】Section 标题样式需更细致**：当前 level={3} 的使用场景说明较简略，建议补充「多级标题之间是否需要分隔线」的指引。 | ✅ 已补充：6.1节明确 Section 标题分隔线用法 |
| 5 | **【建议】暗色模式适配**：当前规范未提及暗色模式下的标题颜色，建议补充 dark mode 场景的样式调整。 | ✅ 已补充：8.3节「暗色模式适配」 |

---

**文档版本**：v1.2
**创建日期**：2026-05-21
**最后更新**：2026-05-21
**状态**：已完成评审，待实施