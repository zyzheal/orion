# 诊断 Agent - 前端设计文档

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/diagnostic` | 主布局 | 侧边栏菜单导航 |
| `/diagnostic/sessions` | 诊断会话列表 | 触发记录列表 |
| `/diagnostic/sessions/:id` | 会话详情 | 诊断流程 + 报告 |
| `/diagnostic/reports` | 报告历史 | 历史报告列表 |
| `/diagnostic/reports/:id` | 报告详情 | 完整诊断报告 |
| `/diagnostic/knowledge` | 知识库 | 模式匹配列表 |
| `/diagnostic/knowledge/:id` | 模式详情 | 症状 → 根因 → 解决方案 |
| `/diagnostic/trigger` | 触发诊断 | 触发表单页 |
| `/diagnostic/status` | 服务状态 | 诊断服务健康检查 |

## 组件清单

`DiagnosticLayout` — 页面骨架
`DiagnosticTrigger` — 触发表单（触发类型选择器、症状构建器）
`SessionList` — 诊断会话表格
`SessionDetail` — 会话详情 + 诊断流程可视化
`SessionSymptomList` — 症状列表
`ReportViewer` — 诊断报告查看器
`ReportList` — 报告历史表格
`KnowledgeBase` — 知识库页面（模式列表 + 搜索）
`PatternList` — 模式表格 + 分类过滤
`PatternModal` — 模式创建/编辑弹窗
`PatternDetail` — 模式详情卡片
`ComplexityEstimator` — 修复复杂度估算组件
`ServiceStatus` — 服务状态展示
`OutcomeRecorder` — 结果记录表单

## API 契约

基础路径：`/api/v1/diagnostic`

### 触发
```
POST   /v1/diagnostic/trigger              # 触发诊断 (body: triggerType, triggerId, symptoms[], tenantId?)
```

### 会话
```
GET    /v1/diagnostic/sessions?triggerType=&status=&since=  # 历史
GET    /v1/diagnostic/sessions/:id         # 详情（含报告）
POST   /v1/diagnostic/sessions/:id/symptoms  # 添加症状
POST   /v1/diagnostic/sessions/:id/complete  # 完成会话（重新生成报告）
GET    /v1/diagnostic/sessions/:id/complexity  # 估算修复复杂度
```

### 报告
```
GET    /v1/diagnostic/reports?sessionId=    # 历史
GET    /v1/diagnostic/reports/:id           # 报告详情
```

### 知识库
```
GET    /v1/diagnostic/knowledge/patterns?category=&keyword=  # 搜索模式
GET    /v1/diagnostic/knowledge/patterns/:id  # 模式详情
POST   /v1/diagnostic/knowledge/patterns    # 添加模式
GET    /v1/diagnostic/knowledge/stats       # 知识库统计
POST   /v1/diagnostic/knowledge/outcomes    # 记录结果 (body: sessionId, patternId, confirmed)
```

### 状态
```
GET    /v1/diagnostic/status                # 服务状态
```

## 数据流

```
API (axios via api/diagnostic.ts)
  -> useEffect 触发请求
  -> useState 管理 loading/data/error
  -> Ant Design 组件渲染
```

会话详情页展示诊断流程：症状 → 匹配模式 → 根因分析 → 建议 → 报告。

## UI 布局

- **触发**: 表单（触发类型选择器、触发 ID 输入、症状构建器（动态添加症状：类型/来源/描述/严重级别）、租户选择器）
- **会话**: 表格（触发类型、状态、症状数、开始时间、耗时）
- **会话详情**: 分步诊断流程可视化（类似向导进度指示器），症状列表、匹配模式、根因、最终报告
- **报告**: 表格（会话链接、模式匹配、置信度、生成时间）
- **知识库**: 模式表格 + 分类过滤 + 关键词搜索 + 频率展示
- **模式详情**: 卡片展示 症状 → 根因 → 解决方案 的映射关系

## 关键交互

- 触发诊断：表单带动态症状构建器（可增删症状条目）
- 向现有会话添加症状
- 完成会话以重新生成报告
- 记录结果（确认/不确认模式匹配）+ 实际根因 + 修复时间
- 知识库按关键词/分类搜索
- 会话详情页展示修复复杂度估算

## API 客户端文件

`orion-frontend/src/api/diagnostic.ts` — 约 15 个函数。
