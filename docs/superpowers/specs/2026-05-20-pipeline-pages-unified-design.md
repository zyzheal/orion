# Pipeline 页面风格统一与功能补全设计

**日期**: 2026-05-20
**分支**: `feat/frontend-gap-implementation`
**状态**: Approved

## 1. 概述

统一 Pipeline 模块 6 个子页面的展示样式与交互设计,补全版本历史 Diff 可视化、模板创建、批量操作、实时日志 4 项功能缺失。

## 2. 样式统一规范

所有 Pipeline 页面遵循以下统一规范:

| 规范项 | 规则 | Token |
|--------|------|-------|
| 页面容器 | `padding: 0` | - |
| 页标题 | `Title level={3}`, 下边距 `24px` | `spacing.lg` |
| 页面描述 | `Text type="secondary"`, 紧贴标题下方 | - |
| 内容卡片 | 使用 `CardPanel` 组件包裹 | `componentRadius.card` |
| 操作按钮组 | 右上角 `Space`, 主按钮 type="primary" | `spacing.sm` |
| 搜索筛选栏 | `SearchFilterBar` 组件, 下边距 `16px` | `spacing.md` |
| 表格 | `Table` 组件, `size="middle"`, `striped` | - |
| 状态标签 | `StatusBadge` 组件 | - |
| 空状态 | Ant Design `Empty` + 引导文字 | - |
| 加载状态 | 页面级 `loading` 状态, 不展示空白 | - |

### 页面清单

| 页面 | 文件 | 改动 |
|------|------|------|
| Pipeline 列表 | `PipelineList/index.tsx` | 微调: 标题间距、操作列宽度 |
| Pipeline 详情 | `PipelineDetail/index.tsx` | 微调: 移除 mock 数据提示 |
| Pipeline 运行历史 | `PipelineRunList/index.tsx` | 微调: 与列表页保持一致 |
| Pipeline 创建/编辑 | `PipelineEditor/index.tsx` | 微调: 基本信息表单布局 |
| Pipeline 版本历史 | `PipelineVersionHistory/index.tsx` | **重写**: 中文界面 + Design Token + CardPanel |
| Pipeline 预算管理 | `PipelineBudget/index.tsx` | 无需改动,已符合规范 |

## 3. 功能补全

### 3.1 版本历史 Diff 可视化

**目标**: 将版本对比从 JSON 展示改为专业的 YAML Diff 高亮对比

**设计**:
- 双栏 Diff 视图: 左侧旧版本 YAML,右侧新版本 YAML
- 行级高亮: 新增行绿色背景,删除行红色背景,修改行黄色背景
- 使用 `diff` 库计算差异,自定义渲染组件
- 支持全屏 Diff 弹窗,可从版本列表选择任意两个版本对比

**文件**:
- 新建: `orion-frontend/src/pages/pipeline-svc/PipelineVersionHistory/YamlDiffViewer.tsx`
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineVersionHistory/index.tsx`
- 依赖: 安装 `diff` npm 包

### 3.2 Pipeline 模板创建

**目标**: 支持从预定义模板快速创建 Pipeline

**设计**:
- Pipeline 列表页新增 "从模板创建" 按钮
- 弹出模板选择 Modal,展示常用模板(CI、CD、CI+CD、多环境部署等)
- 选择模板后跳转到编辑器,预填充 Stage 配置
- 新建 `pipeline-templates.ts` API 文件定义模板接口

**文件**:
- 新建: `orion-frontend/src/api/pipeline-templates.ts`
- 新建: `orion-frontend/src/pages/pipeline-svc/PipelineList/TemplateSelector.tsx`
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx`
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/index.tsx`(支持 URL 参数预填充)

### 3.3 Pipeline 批量操作

**目标**: 列表页支持批量启用/停用/删除 Pipeline

**设计**:
- 表格支持行选择(row selection)
- 选中后顶部显示批量操作栏(启用/停用/删除)
- 删除操作需二次确认,展示影响范围
- API 层调用批量接口或循环调用单条接口

**文件**:
- 新建: `orion-frontend/src/pages/pipeline-svc/PipelineList/BatchActions.tsx`
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx`
- 修改: `orion-frontend/src/api/pipelines.ts`(添加批量 API)

### 3.4 实时日志页面完善

**目标**: 完善 Pipeline 运行实时日志查看体验

**设计**:
- SSE 实时日志流(已有 `usePipelineLogs` hook)
- 日志级别颜色高亮(error=红色, warn=黄色, info=蓝色)
- 日志搜索/过滤功能
- 自动滚动开关(跟随最新日志 vs 手动查看历史)
- 日志下载功能(导出为文本文件)

**文件**:
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineRunLive/index.tsx`
- 检查: `orion-frontend/src/hooks/usePipelineLogs.ts`

## 4. 依赖关系

```
样式统一 (串行,改动小)
  └── PipelineVersionHistory 重写

功能补全 (4 个任务并行,互相独立)
  ├── Task A: 版本 Diff 可视化
  ├── Task B: 模板创建
  ├── Task C: 批量操作
  └── Task D: 实时日志
```

## 5. 测试策略

- 每个新建组件编写 Vitest 单元测试
- Diff 可视化: 测试 diff 计算逻辑和边界情况
- 模板创建: 测试模板选择到编辑器预填充的完整流程
- 批量操作: 测试选择、确认、执行的完整流程
- 实时日志: 测试 SSE 连接、搜索过滤、自动滚动

## 6. 验证标准

1. 所有 Pipeline 页面样式符合 Design Token 规范
2. 版本 Diff 可视化支持 YAML 高亮对比
3. 支持从模板创建 Pipeline
4. 列表页支持批量操作
5. 实时日志支持搜索/过滤/自动滚动/下载
