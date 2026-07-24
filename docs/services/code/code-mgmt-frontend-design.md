# 代码管理 - 前端设计文档

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/code-mgmt` | 主布局 | 侧边栏菜单导航 |
| `/code-mgmt/repos` | 仓库列表 | 卡片网格或表格 |
| `/code-mgmt/repos/:adapterId/:repoId` | 仓库详情 | Tab 布局（分支/PR/CODEOWNERS） |
| `/code-mgmt/repos/:adapterId/:repoId/branches/:branchName` | 分支详情 | 提交历史、保护状态 |
| `/code-mgmt/repos/:adapterId/:repoId/pulls/:prId` | PR 详情 | 审查意见、合并状态 |
| `/code-mgmt/policies` | 分支策略管理 | 规则列表 |
| `/code-mgmt/policies/:id` | 策略详情 | 匹配规则预览 |
| `/code-mgmt/ownership` | CODEOWNERS 管理 | 编辑器 + 验证 |
| `/code-mgmt/webhooks` | Webhook 事件日志 | 时间线表格 |

## 组件清单

`CodeMgmtLayout` — 页面骨架
`RepoList` — 仓库卡片网格（名称、适配器类型、分支数、PR 数）
`RepoDetail` — Tab 布局容器（分支列表 | PR 列表 | CODEOWNERS）
`BranchList` — 分支表格 + 创建按钮
`BranchModal` — 创建/删除分支表单
`PullRequestList` — PR 表格 + 状态过滤
`PullRequestDetail` — PR 详情 + 审查意见
`ReviewModal` — 添加审查意见弹窗
`BranchPolicyList` — 策略表格 + 模式匹配预览
`BranchPolicyModal` — 策略表单 + 规则构建器
`MergeCheckResult` — 合并检查通过/失败清单
`CodeOwnersEditor` — CODEOWNERS 内容编辑器（带实时验证）
`CodeOwnersValidator` — CODEOWNERS 格式验证结果
`WebhookEventLog` — Webhook 事件时间线表格

## API 契约

### 仓库管理（基于适配器，路径前缀 `/api/v1/code-repo`）
```
GET    /v1/code-repo/adapters                                    # 适配器列表
GET    /v1/code-repo/:adapterId/repos?search=&page=&perPage=     # 仓库列表
GET    /v1/code-repo/:adapterId/repos?projectId=xxx              # 单个仓库
GET    /v1/code-repo/:adapterId/repos/:repoId/branches           # 分支列表
GET    /v1/code-repo/:adapterId/repos/:repoId/branches/:name     # 分支详情
POST   /v1/code-repo/:adapterId/repos/:repoId/branches           # 创建分支
DELETE /v1/code-repo/:adapterId/repos/:repoId/branches/:name     # 删除分支
GET    /v1/code-repo/:adapterId/repos/:repoId/pulls?state=       # PR 列表
GET    /v1/code-repo/:adapterId/repos/:repoId/pulls/:prId        # PR 详情
POST   /v1/code-repo/:adapterId/repos/:repoId/pulls              # 创建 PR
POST   /v1/code-repo/:adapterId/repos/:repoId/pulls/:prId/merge  # 合并 PR
POST   /v1/code-repo/:adapterId/repos/:repoId/pulls/:prId/close  # 关闭 PR
POST   /v1/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews # 添加审查
GET    /v1/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews # 审查列表
```

### 分支策略 (`/api/v1/code-repo/branch-policies`)
```
GET/POST   /v1/code-repo/branch-policies                         # 列表/创建
GET        /v1/code-repo/branch-policies/repo/:repoId            # 按仓库查询
GET/PUT/DELETE /v1/code-repo/branch-policies/:id                # 单条 CRUD
GET        /v1/code-repo/branch-policies/match?repoId=&branch=   # 匹配策略
POST       /v1/code-repo/branch-policies/check-merge             # 合并检查
POST       /v1/code-repo/branch-policies/defaults/:repoId        # 创建默认策略
```

### CODEOWNERS (`/api/v1/code-repo/code-owners`)
```
GET/POST   /v1/code-repo/code-owners              # 获取/注册
DELETE     /v1/code-repo/code-owners/:repoId       # 删除
POST       /v1/code-repo/code-owners/validate      # 格式验证
POST       /v1/code-repo/code-owners/recommend     # 推荐审批人
POST       /v1/code-repo/code-owners/approvers     # 获取必需审批人
```

### Webhook (`/api/v1/code-repo/webhooks`)
```
POST   /v1/code-repo/webhooks/gitlab|gerrit|github  # 接收 Webhook
GET    /v1/code-repo/webhooks/logs                  # 事件日志
POST   /v1/code-repo/webhooks/secret                # 注册密钥
```

## 数据流

```
API (axios via api/code-mgmt.ts)
  -> useEffect 触发请求
  -> useState 管理 loading/data/error
  -> Ant Design Table/Modal 渲染
```

仓库/PR 数据通过适配器路由。CODEOWNERS 使用 Monaco Editor 或 TextArea 进行内容编辑。

## UI 布局

- **仓库**: 卡片网格展示（名称、适配器类型、分支数、PR 数）
- **仓库详情**: Tab 布局（分支 | PR | CODEOWNERS）
- **分支策略**: 表格 + 模式匹配显示 + 审批规则构建器
- **CODEOWNERS**: 分屏编辑器（左侧内容编辑，右侧解析规则预览）
- **Webhook**: 事件时间线表格 + 类型过滤

## 关键交互

- 创建分支/PR 通过 Modal 表单
- 合并 PR 带策略选择器（squash/merge/rebase）
- 分支策略：可视化规则构建器 + 模式匹配预览
- CODEOWNERS：实时验证 + 审批人推荐
- 合并检查：可视化通过/失败清单（每条策略一行）

## API 客户端文件

`orion-frontend/src/api/code-mgmt.ts` — 按资源组组织（repos, policies, ownership, webhooks），约 35 个函数。
