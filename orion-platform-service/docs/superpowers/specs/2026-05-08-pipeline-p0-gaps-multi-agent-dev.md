# Orion P0 级差距修复 - 多 Agent 开发设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 使用多 Agent 协作方式修复 Orion Pipeline 的 5 项 P0 级差距

**Architecture:** 基于 subagent-driven-development 模式，每个差距修复由独立子 Agent 完成，带自动 spec compliance review + code quality review

**Tech Stack:** TypeScript, Fastify, PostgreSQL, React, Ant Design

**Date:** 2026-05-08

---

## 1. 开发范围与优先级

### 1.1 P0 级差距清单

| # | 差距 | 复杂度 | 预估工作量 |
|---|------|--------|-----------|
| Task 1 | GAP-01 条件表达式引擎增强 | 低 | 2-3 天 |
| Task 2 | GAP-08 Workspace 隔离 | 低 | 1-2 天 |
| Task 3 | GAP-07 Secrets 管理 | 中 | 1-2 周 |
| Task 4 | GAP-05 执行状态持久化 | 高 | 2-3 周 |
| Task 5 | GAP-CN-05 IM 通知集成 | 低 | 2-3 天 |

### 1.2 依赖关系

```
Task 1 (条件引擎) ──→ 无依赖，可并行
Task 2 (Workspace) ──→ 无依赖，可并行
Task 3 (Secrets)   ──→ 无依赖，可并行
Task 4 (持久化)    ──→ 无依赖，可并行
Task 5 (IM通知)    ──→ 无依赖，可并行
```

所有 Task 相互独立，可以并行执行。

---

## 2. 多 Agent 执行模式

### 2.1 子 Agent 分配

| Task | 子 Agent 类型 | 职责 | 审查标准 |
|------|-------------|------|---------|
| Task 1 | implementer | 实现 ExpressionEvaluator，集成到 PipelineEngine | spec compliance + code quality |
| Task 2 | implementer | 实现 WorkspaceIsolator，改造 TaskRunner | spec compliance + code quality |
| Task 3 | implementer | 实现 SecretsService + 日志遮蔽 + 引用语法 | spec compliance + code quality |
| Task 4 | implementer | 实现 Checkpoint 持久化 + startup recovery | spec compliance + code quality |
| Task 5 | implementer | 实现 IMNotifier（钉钉/企微/飞书） | spec compliance + code quality |

### 2.2 执行流程

```
1. 主 Agent 创建 TodoWrite（5个 Task）
2. 对每个 Task：
   a. 派遣 implementer 子 Agent
   b. 子 Agent 实现 + 测试 + 提交
   c. 派遣 spec compliance reviewer
   d. 如果有问题 → implementer 修复 → 重新 review
   e. 派遣 code quality reviewer
   f. 如果有问题 → implementer 修复 → 重新 review
   g. 两项审查都通过 → 标记 Task 完成
3. 所有 Task 完成 → final code review → 完成 Phase 1
```

### 2.3 分支策略

- 基于 `feat/frontend-gap-implementation` 分支
- 每个 Task 在一个独立的 git worktree 中开发
- 完成后 merge 回主分支

---

## 3. 各 Task 详细规范

### Task 1: 条件表达式引擎增强

**目标：** 替换 PipelineEngine 中仅支持 `==` 的简单正则匹配，实现完整的条件表达式引擎

**当前代码：**
- `src/engine/PipelineEngine.ts:673-705` - `evaluateCondition()` 仅支持 `/^(\S+)\s*==\s*'([^']+)'$/`

**目标语法：**
```yaml
stages:
  - name: deploy-prod
    if: github.ref == 'refs/heads/main' && success() && contains(changedFiles, 'Dockerfile')
  - name: test
    if: branch != 'main' || contains(tags, 'nightly')
```

**支持的操作符和函数：**

| 类别 | 支持项 |
|------|--------|
| 比较 | `==`, `!=`, `>`, `<`, `>=`, `<=` |
| 逻辑 | `&&`, `\|\|`, `!` |
| 字符串 | `startsWith()`, `endsWith()`, `contains()` |
| 状态 | `success()`, `failure()`, `cancelled()`, `always()` |
| 上下文 | `branch`, `tags`, `changedFiles`, `triggerBy` |

**文件变更：**
- 创建：`src/engine/ExpressionEvaluator.ts`
- 修改：`src/engine/PipelineEngine.ts` - 替换 `evaluateCondition()` 调用

**安全要求：**
- 禁止 `Function`, `eval`, `require` 等 JS 内置函数
- 仅允许白名单操作符和函数
- 超时保护（表达式求值 < 10ms）

---

### Task 2: Workspace 隔离

**目标：** 为每个 Pipeline run 创建独立 workspace，替代全局 `/tmp`

**当前代码：**
- `src/engine/TaskRunner.ts` 8 处硬编码 `/tmp`

**目标行为：**
```typescript
// 每个 run 创建独立 workspace
const workspace = `/tmp/orion-workspaces/${runId}/`;
// 每个 task 子目录
const taskWorkspace = `${workspace}${taskId}/`;
// run 完成后清理
```

**文件变更：**
- 创建：`src/engine/WorkspaceIsolator.ts`
- 修改：`src/engine/TaskRunner.ts` - 使用 WorkspaceIsolator 替代 `/tmp`
- 修改：`src/services/pipeline/ArtifactService.ts` - 适配新 workspace 路径

---

### Task 3: Secrets 管理

**目标：** 实现 Secret 引用语法 + 日志遮蔽 + 后端存储

**目标语法：**
```yaml
tasks:
  - uses: shell@v1
    with:
      script: echo $DEPLOY_KEY
    env:
      DEPLOY_KEY: ${secrets.deploy_key}
```

**三层设计：**
1. **Secret 引用语法** - `${secrets.xxx}` 解析
2. **日志遮蔽** - 自动替换 secret 值为 `***`
3. **后端存储** - PostgreSQL encrypted column

**文件变更：**
- 创建：`src/services/pipeline/SecretsService.ts`
- 创建：`src/repositories/SecretRepository.ts`
- 修改：`src/engine/TaskRunner.ts` - 解析 `${secrets.xxx}` 引用
- 修改：`src/engine/TaskRunner.ts` - 日志遮蔽
- 创建：DB migration `056_create_secrets_table.sql`

---

### Task 4: 执行状态持久化

**目标：** 将 Pipeline 执行状态从内存 Map 持久化到 PostgreSQL，支持 startup recovery

**当前代码：**
- `src/engine/PipelineEngine.ts:54` - `executions = new Map()`

**目标行为：**
```typescript
// 关键状态变更时写入 PostgreSQL
// - stage 状态变更（PENDING → RUNNING → SUCCESS/FAILED）
// - task 完成时
// 启动时扫描 RUNNING 状态的 pipeline，根据 checkpoint 恢复
```

**文件变更：**
- 创建：`src/repositories/PipelineCheckpointRepository.ts`
- 创建：`src/engine/PipelineCheckpointManager.ts`
- 修改：`src/engine/PipelineEngine.ts` - 集成 CheckpointManager
- 创建：DB migration `055_create_pipeline_checkpoints_table.sql`

---

### Task 5: IM 通知集成

**目标：** 实现钉钉、企业微信、飞书的 Pipeline 状态通知

**目标配置：**
```yaml
notifications:
  - type: dingtalk
    webhook: https://oapi.dingtalk.com/robot/send?access_token=xxx
    events: [success, failure]
  - type: wecom
    webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
    events: [failure]
  - type: feishu
    webhook: https://open.feishu.cn/open-apis/bot/v2/hook/xxx
    events: [success, failure, cancelled]
```

**文件变更：**
- 创建：`src/services/pipeline/IMNotifier.ts`
- 创建：`src/services/pipeline/im-adapters/DingTalkAdapter.ts`
- 创建：`src/services/pipeline/im-adapters/WeComAdapter.ts`
- 创建：`src/services/pipeline/im-adapters/FeishuAdapter.ts`
- 修改：`src/engine/PipelineEngine.ts` - Pipeline 完成/失败时触发通知

---

## 4. 质量标准

### 4.1 测试要求

- 每个 Task 必须有单元测试
- 测试覆盖率 >= 80%
- TDD 方式开发（先写失败的测试，再实现）

### 4.2 代码规范

- 遵循现有代码库的 TypeScript 风格
- 使用 pino 日志
- 错误处理使用自定义 Error 类
- 所有公共 API 必须有 JSDoc

### 4.3 提交规范

- 使用 Conventional Commits
- 每个 Task 的修改分多个 commit（测试 → 实现 → 文档）
- 提交前运行 lint 和 type-check
