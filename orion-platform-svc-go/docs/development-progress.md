
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

### 剩余任务

- **DB migration**（FORBIDDEN）：branch_profiles + build_artifacts + namespace_bindings + sync_policies + sync_run_logs + deploy_events + merge_previews
- **前端页面**（FORBIDDEN routes.tsx）：BranchProfileList + NamespaceMatrix + SyncPolicyList + ChangeAuditTrail + MergePreviewDialog + PreDeployGatePanel
- **R6 schema-compatibility 真实实现**：需要 migration service 支持
- **AddedFiles/ModifiedFiles/DeletedFiles 分类**：需调用 `git diff --name-status` 后解析
