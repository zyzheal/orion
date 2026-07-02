# 代码管理详细规格 (Phase 1)

> **日期**: 2026-07-02
> **状态**: 已验证
> **能力域**: 11. 代码管理
> **目标成熟度**: L2 → L3
> **关键交付**: SCM 适配器、PR/MR 管理、Webhook、代码审查

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- SCM 适配器框架（GitLab/GitHub 适配器）
- 仓库管理（Repository CRUD + code-repo-routes）
- 分支策略管理（BranchPolicyService + branch-policy-routes）
- Pull Request / Merge Request 基础查询
- Webhook 接收与处理（WebhookService）
- 代码审查集成（AI Code Review 服务）

**不足**：
- 缺少 getRepository/getPullRequest/updatePullRequest 路由（部分 CRUD 操作缺失）
- Webhook 密钥管理路由缺失（无法管理 Webhook Secret）
- CodeOwnershipService 内存 Map 存储（重启丢失）
- 缺少文件 diff API（无法查看代码变更）
- 缺少评论 API（无法在 PR/MR 上评论）
- 缺少提交历史 API
- 缺少 Bitbucket 支持

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 路由补全 | 仓库/PR/Webhook 缺失路由 | L3 |
| 文件 Diff | 代码变更对比查看 | L3 |
| 评论系统 | PR/MR 行内评论 | L3 |
| 提交历史 | 分支提交历史查看 | L3 |
| Webhook 安全 | 密钥管理、签名验证 | L3 |

## 二、验收标准

### 2.1 路由补全

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | `GET /api/v1/code-repo/:id` 返回仓库详情 | API 测试 |
| R2 | `GET /api/v1/code-repo/:id/pull-requests` 返回 PR 列表 | API 测试 |
| R3 | `PUT /api/v1/code-repo/:id/pull-requests/:prId` 更新 PR | API 测试 |
| R4 | `GET /api/v1/code-repo/:id/webhooks` 返回 Webhook 列表 | API 测试 |
| R5 | `POST /api/v1/code-repo/:id/webhooks` 创建 Webhook | API 测试 |
| R6 | `DELETE /api/v1/code-repo/:id/webhooks/:wId` 删除 Webhook | API 测试 |

### 2.2 文件 Diff

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | PR/MR 的文件变更列表（增/删/改文件数） | API 测试 |
| D2 | 单个文件的 diff 内容（行级增删高亮） | API 测试 |
| D3 | diff 统计信息（+N/-M 行） | API 测试 |

### 2.3 评论系统

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 支持在 PR/MR 上添加评论 | API 测试 |
| C2 | 支持行内评论（指定文件/行号） | API 测试 |
| C3 | 支持回复评论（线程化） | API 测试 |
| C4 | 评论支持 Markdown 格式 | 前端验证 |

### 2.4 提交历史

| # | 标准 | 验证方式 |
|---|------|----------|
| H1 | 获取分支提交历史（分页，每页 20 条） | API 测试 |
| H2 | 每次提交显示：SHA/作者/日期/提交信息 | API 测试 |
| H3 | 支持按作者/日期范围过滤 | API 测试 |

## 三、API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/code-repo/:id` | 仓库详情 |
| GET | `/api/v1/code-repo/:id/pull-requests` | PR 列表 |
| PUT | `/api/v1/code-repo/:id/pull-requests/:prId` | 更新 PR |
| GET | `/api/v1/code-repo/:id/pull-requests/:prId/diff` | PR Diff |
| POST | `/api/v1/code-repo/:id/pull-requests/:prId/comments` | 添加评论 |
| GET | `/api/v1/code-repo/:id/commits` | 提交历史 |
| GET | `/api/v1/code-repo/:id/webhooks` | Webhook 列表 |
| POST | `/api/v1/code-repo/:id/webhooks` | 创建 Webhook |
| DELETE | `/api/v1/code-repo/:id/webhooks/:wId` | 删除 Webhook |

---

_文档版本: v1.0 | 创建日期: 2026-07-02 | 状态: 已验证_