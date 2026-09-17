
---

## P0-MB Phase 5c — 生产接线（2026-08-26）

### 目标

Phase 5b 的 `gitmerge.Executor` 已在 `service.go` 中支持，但生产环境（`cmd/server/wiring-core-domains.go`）仍使用 `NewService(repo)`（gitExecutor=nil，降级到 empty fallback）。本 Phase 将 gitmerge 接入生产 wiring，让 `/branch-policy/merge-preview` 端点在真实环境中自动跑 `git merge-tree`。

### 设计决策

| 决策 | 理由 |
|---|---|
| `ORION_GIT_WORKDIR` env 变量 | 允许部署时指定 git 仓库路径；未设置时使用当前工作目录（`""`） |
| `ORION_GIT_BINARY` env 变量 | 允许自定义 git 二进制路径；未设置时使用默认 `git` |
| LocalExecutor 构造无副作用 | git 二进制缺失不阻塞服务启动；CreateMergePreview 降级到 empty fallback |
| 向后兼容 | 未设置 env 变量时使用默认值，行为与 Phase 5b 前一致（降级到 empty fallback） |

### 文件清单

| 文件 | 变更 |
|---|---|
| `cmd/server/wiring-core-domains.go` | +`os` import / +`sb_git` import / branch-policy 块改为 `NewServiceWithGit(repo, gitExec)` + env 变量支持 |
| `docs/ALL_TODOS.md` | Phase 5c 行标记 ✅ 已完成 + 状态更新（8/8）+ 授权状态更新 |
| `docs/development-progress.md` | 本 Phase 5c 章节追加 |

### 关键代码

```go
// cmd/server/wiring-core-domains.go
// branch-policy (Phase 5b: wire git merge-tree executor for real conflict detection)
{
    repo := sb_repo.NewRepository(db.DB)
    gitExec := sb_git.NewLocalExecutor()
    if wd := os.Getenv("ORION_GIT_WORKDIR"); wd != "" {
        gitExec.WorkDir = wd
    }
    if bp := os.Getenv("ORION_GIT_BINARY"); bp != "" {
        gitExec.BinaryPath = bp
    }
    svc := sb_service.NewServiceWithGit(repo, gitExec)
    securityBranchPolicyH = sb_handler.NewHandler(svc)
}
```

### 验证

- `go build ./...` ✅
- `go vet ./cmd/...` ✅
- `go test ./internal/branch-policy/...` ✅（全部测试通过）

### 已知问题

1. **git 二进制可用性**：生产环境需确保 `git` 二进制在 PATH 中或通过 `ORION_GIT_BINARY` 指定路径。缺失时 CreateMergePreview 降级到 empty fallback（RiskLevel=low）。
2. **git 仓库路径**：生产环境需通过 `ORION_GIT_WORKDIR` 指定 git 仓库路径。未设置时使用当前工作目录（`""`），merge-tree 可能失败（降级到 empty fallback）。
3. **git merge-tree 输出格式版本差异**：parser 针对 git ≥ 2.38；旧版 git 降级到 empty fallback。
4. **AddedFiles/ModifiedFiles/DeletedFiles 未分类**：`git merge-tree --write-tree` 不输出文件变更类型；当前返回空 slice。
5. **DB migration 未落地**：7 张表待建（Repository stubs 返回 sentinel.NotFound）。

### Commit

```
feat(branch-policy): P0-MB Phase 5c — production wiring for gitmerge executor
```

### 累计进度（Phase 301-306 + P0-MB Phase 1-6 + Phase 5b + Phase 5c 全部完成）

- **Phase 301-306 实施**：✅
- **P0-MB Phase 1 实施**：✅ `5fe58f0c4`
- **P0-MB Phase 2 实施**：✅ `49d106242`
- **P0-MB Phase 3 实施**：✅ `9f9bc3e1b`
- **P0-MB Phase 4 实施**：✅ `7ba5b9819`
- **P0-MB Phase 5 实施**：✅ `2163cbd45`
- **P0-MB Phase 6 实施**：✅ `082462c47`
- **P0-MB Phase 5b 实施**：✅ `22755c55d`
- **P0-MB Phase 5c 实施**：✅ 本轮

---

## 迁移链全量验证 + 孤儿表补建（2026-09-17，Stage B1-B2 / C / D）

### 背景

跨多轮会话的系统性清理：迁移链（001→684）全量 UP/DOWN 验证、孤儿表盘点与补建迁移、遗留 P2 手动评估。全部在分支 `feat/wave2-parallel-execution` 上完成并推送至 `07103fd27`。

### Stage B1 — 干净库全链路 UP/DOWN 验证

- 用 `orion_mig_test_clean` 库（PG 16.14, port 5433）+ `RunMigrationsDownTo` 完成 001→684 全量 DOWN 链验证
- 验证工具：`/tmp/mig_verify_tool/mig_down_to.go`（临时，不入库）
- 结论：全链路无阻塞错误

### Stage B2 — 幂等性抽查 + 构建回归

- 对含 `IF NOT EXISTS` 的迁移抽查幂等性（重复执行不报错）
- `go build ./...` ✅ / 测试回归 ✅

### Stage C — 79 孤儿表清单 + 迁移 685-694 补建

- 盘点了 internal/* 仓库引用但无迁移创建的表，共 **79 张孤儿表，覆盖 22 个模块**
- 新增迁移（10 个版本，均带 _down 回滚）：

| 迁移 | 覆盖模块 |
|---|---|
| 685 `create_job_source_missing_tables` | job-source |
| 686 `create_ticket_domain_missing_tables` | ticketing 域 |
| 687 `create_ticket_automation_table` | ticket-automation |
| 688 `create_hyphen_named_module_tables` | 连字符命名模块 |
| 689 `create_ai_domain_orphan_tables` | AI 域 |
| 690 `create_infrastructure_orphan_tables` | 基础设施域 |
| 691 `create_cicd_orphan_tables` | CI/CD 域 |
| 692 `create_governance_code_repo_orphan_tables` | governance/code-repo |
| 693 `create_module_orphan_tables` | 模块孤儿表（10 表） |
| 694 `create_module_orphan_tables` | 模块孤儿表（11 表：scheduler_job_definitions / degradation_* / llm_traces / llm_model_pricing / queue_jobs / skill_versions / webhook_config / gateway_gray_release / crossover_calls 等） |

- 明细清单一览：`docs/orphan-tables-inventory-2026-09-16.md`
- 694 中 `crossover_calls` 的 DDL 精确镜像了仓库 `CreateTable()` 的运行时 schema，使迁移成为权威来源，新部署不依赖应用自建表

### Stage D — P2 遗留项手动评估

- P2-03/04/05（approval merge、ticketing/ticket 路径拆分、chaos 3 模块 facade）逐一人工评估，结论记录于评估文档

### Commit

```
A1-D 各阶段独立提交，分支已推送至 origin/feat/wave2-parallel-execution @ 07103fd27
```

### 剩余任务

- **DB migration**：✅ 已由 `migrations/552_branch_policy_tables.sql` 落地（commit `2795b19cc`），7 张表（branch_profiles / build_artifacts / namespace_bindings / sync_policies / sync_run_logs / deploy_events / merge_previews）全部创建；本条备注为过时项，已修正
- **前端页面**（FORBIDDEN routes.tsx）：BranchProfileList + NamespaceMatrix + SyncPolicyList + ChangeAuditTrail + MergePreviewDialog + PreDeployGatePanel
- **R6 schema-compatibility 真实实现**：需要 migration service 支持
- **AddedFiles/ModifiedFiles/DeletedFiles 分类**：需调用 `git diff --name-status` 后解析
