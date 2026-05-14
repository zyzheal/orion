# AI Code Review - 前端设计文档

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/ai-review` | 主布局 | 侧边栏菜单导航 |
| `/ai-review/dashboard` | 审查仪表盘 | 摘要卡片 + 最近审查 |
| `/ai-review/history` | 审查历史 | 可过滤表格 |
| `/ai-review/history/:reviewId` | 审查详情 | Diff 视图 + AI 发现 |
| `/ai-review/rules` | 规则管理 | 规则列表 |
| `/ai-review/rules/:ruleId` | 规则详情 | 规则编辑 |
| `/ai-review/config` | 配置页面 | AI 模型、Prompt 模板 |

## 组件清单

`AIReviewLayout` — 页面骨架
`ReviewDashboard` — 仪表盘（摘要卡片 + 最近审查表格）
`ReviewHistoryList` — 审查历史表格 + 多条件过滤
`ReviewDetail` — 审查详情（左右分栏：Diff + AI 评论）
`ReviewResultCard` — 审查结果摘要卡片
`ReviewCommentList` — AI 发现的评论列表（严重级别徽章 + 文件:行引用 + 建议修复）
`RuleList` — 规则表格 + 启用/禁用切换
`RuleModal` — 规则创建/编辑表单
`RuleToggle` — 单条规则启用切换
`ReviewConfigForm` — AI 模型选择 + Prompt 模板 + 审查范围设置
`TriggerReviewModal` — 手动触发审查弹窗（仓库/PR 选择器）

## API 契约

基础路径：`/api/v1/ai-review`

### 审查操作
```
POST   /v1/ai-review/review              # 触发 PR 审查 (body: prId, repoId, diff)
POST   /v1/ai-review/review-diff         # 仅审查 Diff (body: diff, prId?)
```

### 历史记录
```
GET    /v1/ai-review/history?repoId=&prId=&status=&page=&perPage=  # 列表
GET    /v1/ai-review/history/:reviewId   # 详情
```

### 规则管理
```
GET    /v1/ai-review/rules               # 全部规则
GET    /v1/ai-review/rules/enabled       # 仅启用规则
GET    /v1/ai-review/rules/:ruleId       # 单条规则
POST   /v1/ai-review/rules               # 创建规则
PUT    /v1/ai-review/rules/:ruleId       # 更新规则
DELETE /v1/ai-review/rules/:ruleId       # 删除规则
PATCH  /v1/ai-review/rules/:ruleId/toggle # 启用/禁用
```

### 配置
```
GET    /v1/ai-review/config              # 获取配置
PUT    /v1/ai-review/config              # 更新配置
```

## 数据流

```
API (axios via api/ai-review.ts)
  -> useEffect 触发请求
  -> useState 管理 loading/data/error
  -> Ant Design 组件渲染
```

审查详情页使用左右分栏布局。规则管理使用标准 CRUD 流。

## UI 布局

- **仪表盘**: 摘要卡片（总审查数、发现问题数、通过率、平均审查时间）+ 最近审查表格
- **历史**: 可过滤表格（仓库、PR、状态、日期范围），点击跳转详情
- **审查详情**: 分屏视图 — 左侧 Diff 查看器，右侧 AI 发现列表（严重级别标签、文件:行引用、建议修复）
- **规则**: 表格（名称、分类、严重级别、模式、启用状态、操作列）
- **配置**: 表单（AI 模型选择、Prompt 模板编辑器、审查范围设置）

## 关键交互

- 触发审查：Modal 弹窗选择仓库/PR + 可选上下文
- 规则管理：Modal 创建/编辑，内联切换启用/禁用
- 审查结果按严重级别过滤（critical / warning / info）
- 复制建议到剪贴板
- 标记发现问题为已解决

## API 客户端文件

`orion-frontend/src/api/ai-review.ts` — 约 14 个函数，覆盖审查、规则、配置。
