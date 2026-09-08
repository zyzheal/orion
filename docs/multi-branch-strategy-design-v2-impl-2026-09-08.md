# 多分支并行策略详细设计 (v2 — P0-MB Phase 1-5)

> **来源**：Phase 300 差距扩展审计配套文档
> **前置设计**：`docs/multi-branch-strategy-design.md`（v1.1 架构设计）
> **配套实施**：`docs/flagship-review-v3.7-delta-impl-2026-09-08.md`（Phase 301-306 详细设计）
> **本文档定位**：P0-MB Phase 1-5 的详细技术设计（数据模型/路由/服务层/前端/测试/验收标准），纯文档不涉及代码修改。
>
> **⚠️ 授权状态**：全部涉及 `orion-platform-svc-go/` 目录（当前 FORBIDDEN），需用户明确授权后实施。

---

## 0. 现状基线（Phase 300 全库核实）

### 0.1 branch-policy 目录现状（1997 行）

| 文件 | 行数 | 现状评估 |
|------|------|---------|
| `models/models.go` | **23** | ❌ 只有 3 个通用类型（Record/ListQuery/CreateRequest），缺 6 大模型 |
| `service/service_interface.go` | 79 | ⚠️ 55+ 方法自动生成的通用骨架（含 Train/Escalate/Forecast 等无关方法）|
| `service/service.go` | 273 | ⚠️ 骨架实现 |
| `handler/handler.go` | 779 | ⚠️ 单路由 `/branch-policy` 下的 20+ 路由 |
| `handler/handler_test.go` | 777 | ✅ 完整测试 |
| `repository/repository.go` | 47 | ⚠️ 骨架 |
| `repository/repository_interface.go` | 19 | ⚠️ 骨架 |
| **总计** | **1997** | ⚠️ 骨架实现，非 P0-MB 目标架构 |

### 0.2 缺失的 6 大模型（Phase 1 核心任务）

```go
// ❌ 现有 models.go 完全缺失以下 6 个核心类型：
type BranchProfile struct     // L1 分支语义层
type BuildArtifact struct     // L3 制品指纹层
type NamespaceBinding struct  // L2 环境隔离层
type SyncPolicy struct        // L4 同步策略层
type DeployEvent struct       // L5 变更审计层
type PreDeployGateResult struct // 部署前阻断规则结果
```

### 0.3 接线现状

```
orion-platform-svc-go/cmd/server/wiring-core-domains.go:36-115
- 已完整 wiring（sb_handler alias + wiring 函数）
orion-platform-svc-go/cmd/server/router.go:125
- 已挂路由（变量名 securityBranchPolicyH）
```

**结论**：接线已完整，问题在业务模型缺失。

---

## 1. P0-MB Phase 1 — 基础数据模型（L1 + L3）

### 1.1 数据模型

```go
// models/branch_profile.go
package models

import "time"

type BranchProfile struct {
    ID             string    `db:"id" json:"id"`
    TenantID       string    `db:"tenant_id" json:"tenantId"`
    RepoID         string    `db:"repo_id" json:"repoId"`
    Name           string    `db:"name" json:"name"`                          // 如 'release/enterprise-2026'
    Semantic       BranchSemantic `db:"semantic" json:"semantic"`            // main|release|hotfix|lts|customer-custom
    OwnerID        string    `db:"owner_id" json:"ownerId"`
    OwnerName      string    `db:"owner_name" json:"ownerName"`
    Description    string    `db:"description" json:"description"`
    LTSUntil       *time.Time `db:"lts_until" json:"ltsUntil"`
    MergeTargets   []string  `db:"merge_targets" json:"mergeTargets"`        // 允许合入的分支
    MergeSources   []string  `db:"merge_sources" json:"mergeSources"`        // 允许同步的来源
    ProtectedEnvs  []string  `db:"protected_envs" json:"protectedEnvs"`
    AllowedPipelines []string `db:"allowed_pipelines" json:"allowedPipelines"`
    Status         BranchStatus `db:"status" json:"status"`                   // active|archived|retired
    CreatedAt      time.Time `db:"created_at" json:"createdAt"`
    UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
    ArchivedAt     *time.Time `db:"archived_at" json:"archivedAt"`
}

type BranchSemantic string
const (
    BranchMain         BranchSemantic = "main"
    BranchRelease      BranchSemantic = "release"
    BranchHotfix       BranchSemantic = "hotfix"
    BranchLTS          BranchSemantic = "lts"
    BranchCustomerCustom BranchSemantic = "customer-custom"
)

type BranchStatus string
const (
    BranchStatusActive  BranchStatus = "active"
    BranchStatusArchived BranchStatus = "archived"
    BranchStatusRetired  BranchStatus = "retired"
)

// models/build_artifact.go
type BuildArtifact struct {
    ID             string    `db:"id" json:"id"`
    TenantID       string    `db:"tenant_id" json:"tenantId"`
    BranchProfileID string   `db:"branch_profile_id" json:"branchProfileId"`
    Branch         string    `db:"branch" json:"branch"`
    CommitSHA      string    `db:"commit_sha" json:"commitSha"`
    ImageDigest    string    `db:"image_digest" json:"imageDigest"`       // sha256:xxx
    ImageTag       string    `db:"image_tag" json:"imageTag"`
    ImageRepo      string    `db:"image_repo" json:"imageRepo"`
    BuildPipelineID string   `db:"build_pipeline_id" json:"buildPipelineId"`
    TargetEnvs     []string  `db:"target_envs" json:"targetEnvs"`
    SignedBy       string    `db:"signed_by" json:"signedBy"`
    SignatureValid bool      `db:"signature_valid" json:"signatureValid"`
    BinaryChecksum string    `db:"binary_checksum" json:"binaryChecksum"`
    ConfigChecksum string    `db:"config_checksum" json:"configChecksum"`
    MigrationChecksum string `db:"migration_checksum" json:"migrationChecksum"`
    BuiltAt        time.Time `db:"built_at" json:"builtAt"`
    SizeBytes      int64     `db:"size_bytes" json:"sizeBytes"`
}
```

### 1.2 DB 表设计

```sql
CREATE TABLE branch_profiles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    repo_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    semantic VARCHAR(32) NOT NULL,
    owner_id VARCHAR(64) NOT NULL,
    owner_name VARCHAR(128),
    description TEXT,
    lts_until TIMESTAMP,
    merge_targets TEXT,              -- JSON array
    merge_sources TEXT,              -- JSON array
    protected_envs TEXT,             -- JSON array
    allowed_pipelines TEXT,          -- JSON array
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP,
    UNIQUE(tenant_id, repo_id, name),
    INDEX idx_branch_profile_tenant (tenant_id, status)
);

CREATE TABLE build_artifacts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    branch_profile_id VARCHAR(64) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    commit_sha VARCHAR(64) NOT NULL,
    image_digest VARCHAR(128) NOT NULL,
    image_tag VARCHAR(255) NOT NULL,
    image_repo VARCHAR(255) NOT NULL,
    build_pipeline_id VARCHAR(64) NOT NULL,
    target_envs TEXT NOT NULL,
    signed_by VARCHAR(128),
    signature_valid BOOLEAN DEFAULT FALSE,
    binary_checksum VARCHAR(128),
    config_checksum VARCHAR(128),
    migration_checksum VARCHAR(128),
    built_at TIMESTAMP NOT NULL,
    size_bytes BIGINT,
    FOREIGN KEY (branch_profile_id) REFERENCES branch_profiles(id),
    INDEX idx_build_artifact_branch (branch, commit_sha),
    INDEX idx_build_artifact_tenant (tenant_id, built_at)
);
```

### 1.3 路由（Gin handler）

```
// handler/branch_profile_handler.go
rg.GET("/branch-profiles", auth.RequirePermission("branch-policy", "read"), h.ListBranchProfiles)
rg.POST("/branch-profiles", auth.RequirePermission("branch-policy", "write"), h.CreateBranchProfile)
rg.GET("/branch-profiles/:id", auth.RequirePermission("branch-policy", "read"), h.GetBranchProfile)
rg.PUT("/branch-profiles/:id", auth.RequirePermission("branch-policy", "write"), h.UpdateBranchProfile)
rg.DELETE("/branch-profiles/:id", auth.RequirePermission("branch-policy", "delete"), h.ArchiveBranchProfile)
rg.POST("/branch-profiles/:id/activate", auth.RequirePermission("branch-policy", "write"), h.ActivateBranchProfile)
rg.POST("/branch-profiles/:id/archive", auth.RequirePermission("branch-policy", "write"), h.ArchiveBranchProfileByID)
rg.GET("/branch-profiles/:id/artifacts", auth.RequirePermission("branch-policy", "read"), h.ListBranchArtifacts)

// handler/build_artifact_handler.go
rg.GET("/build-artifacts", auth.RequirePermission("branch-policy", "read"), h.ListBuildArtifacts)
rg.POST("/build-artifacts", auth.RequirePermission("branch-policy", "write"), h.RegisterBuildArtifact)
rg.GET("/build-artifacts/:id", auth.RequirePermission("branch-policy", "read"), h.GetBuildArtifact)
rg.POST("/build-artifacts/:id/verify-signature", auth.RequirePermission("branch-policy", "read"), h.VerifyArtifactSignature)
rg.POST("/build-artifacts/:id/deprecate", auth.RequirePermission("branch-policy", "write"), h.DeprecateArtifact)
```

### 1.4 服务层接口扩展

```go
// service/branch_profile_service.go
type BranchProfileService interface {
    List(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error)
    Get(ctx context.Context, tenantID, id string) (*models.BranchProfile, error)
    Create(ctx context.Context, tenantID string, req models.CreateBranchProfileRequest) (*models.BranchProfile, error)
    Update(ctx context.Context, tenantID, id string, req models.UpdateBranchProfileRequest) (*models.BranchProfile, error)
    Archive(ctx context.Context, tenantID, id string, reason string) error
    Activate(ctx context.Context, tenantID, id string) error
}

// 校验规则
// - semantic != 'main' 且 MergeTargets 为空 → 拒绝
// - semantic == 'lts' 必须指定 LTSUntil
// - Name 必须匹配 semantic 模式（如 release/* 分支必须以 release/ 开头）
// - ProtectedEnvs 不能包含 "prod" 除非有 ChangeManagement 审批

type BuildArtifactService interface {
    List(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error)
    Get(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error)
    Register(ctx context.Context, tenantID string, req models.RegisterArtifactRequest) (*models.BuildArtifact, error)
    VerifySignature(ctx context.Context, tenantID, id string) (*models.SignatureVerificationResult, error)
    Deprecate(ctx context.Context, tenantID, id string, reason string) error
}
```

### 1.5 前端页面

**新增**：`orion-frontend/src/pages/BranchPolicy/BranchProfileList.tsx`（约 400 行）

```
- 分支画像列表（表格 + 语义筛选 + 状态看板）
- 状态筛选：全部 / active / archived / retired
- 语义筛选：main / release / hotfix / lts / customer-custom
- 卡片视图：每个分支的当前部署环境、最近构建、负责人
- 创建表单：语义、名称、负责人、LTS 截止日期、Merge 目标/来源、保护环境
- 详情页：分支画像 + 关联 BuildArtifacts + 关联 DeployEvents + 关联 SyncPolicies
```

**新增**：`orion-frontend/src/pages/BranchPolicy/ArtifactList.tsx`（约 300 行）

```
- 制品清单（表格 + 分支筛选 + 签名状态筛选）
- 状态：signed / unsigned / deprecated
- 校验按钮：VerifySignature
- 详情页：sha256 digest、签名者、构建 pipeline、目标环境
```

### 1.6 测试用例

- `TestBranchProfile_Create_Validation`：语义校验 + 命名规则
- `TestBranchProfile_LTS_RequiresUntilDate`：LTS 必须指定截止日
- `TestBranchProfile_MergeTargets_EmptyReject`：非 main 分支必须指定 MergeTargets
- `TestBuildArtifact_Register_WithDigest`：SHA256 digest 强制
- `TestBuildArtifact_VerifySignature_Failed`：签名验证失败
- `TestBranchProfile_Archive_Cascades`：归档后拒绝部署

### 1.7 验收标准

- [ ] `models.BranchProfile` 完整（15+ 字段 + 枚举）
- [ ] `models.BuildArtifact` 完整（18+ 字段 + 签名校验）
- [ ] DB 表迁移脚本（`branch_profiles` + `build_artifacts`）
- [ ] 15 条路由完整（含权限守卫）
- [ ] 前端 2 个新页面可用
- [ ] 6 个单元测试覆盖核心校验
- [ ] **PreDeployGate R1/R2 可基于此实现**（Phase 5 依赖）

### 1.8 工时分解

| 子任务 | 工时 |
|-------|-----|
| Go 数据模型 + 枚举 | 0.5d |
| DB 迁移脚本 + repository | 1d |
| Service 层（校验规则） | 1.5d |
| Handler 路由 + wiring | 1d |
| 前端 BranchProfileList | 0.5d |
| 单元测试 | 0.5d |
| **合计** | **5d** |

---

## 2. P0-MB Phase 2 — 环境隔离强化（L2 Namespace）

### 2.1 数据模型

```go
// models/namespace_binding.go
type NamespaceBinding struct {
    ID              string    `db:"id" json:"id"`
    TenantID        string    `db:"tenant_id" json:"tenantId"`
    BranchProfileID string    `db:"branch_profile_id" json:"branchProfileId"`
    EnvName         string    `db:"env_name" json:"envName"`         // dev/staging/prod
    K8sNamespace    string    `db:"k8s_namespace" json:"k8sNamespace"`
    ConfigNamespace string    `db:"config_namespace" json:"configNamespace"`
    DBName          string    `db:"db_name" json:"dbName"`
    MQTopicPrefix   string    `db:"mq_topic_prefix" json:"mqTopicPrefix"`
    RedisKeyPrefix  string    `db:"redis_key_prefix" json:"redisKeyPrefix"`
    ImageTagPrefix  string    `db:"image_tag_prefix" json:"imageTagPrefix"`
    CreatedAt       time.Time `db:"created_at" json:"createdAt"`
}

// 命名规则常量
const (
    ImageTagPrefixFmt    = "%s/%s"    // {repo}/{branch-slug}
    K8sNamespaceFmt      = "orion-%s" // orion-release-ent
    ConfigNamespaceFmt   = "nacos/orion-%s"
    DBNameFmt            = "orion_%s"
    MQTopicPrefixFmt     = "orion-%s-*"
    RedisKeyPrefixFmt    = "orion:%s:*"
)
```

### 2.2 DB 表

```sql
CREATE TABLE namespace_bindings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    branch_profile_id VARCHAR(64) NOT NULL,
    env_name VARCHAR(32) NOT NULL,
    k8s_namespace VARCHAR(128) NOT NULL,
    config_namespace VARCHAR(128),
    db_name VARCHAR(128),
    mq_topic_prefix VARCHAR(128),
    redis_key_prefix VARCHAR(128),
    image_tag_prefix VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (branch_profile_id) REFERENCES branch_profiles(id),
    UNIQUE(tenant_id, branch_profile_id, env_name)
);
```

### 2.3 路由

```
rg.GET("/namespace-bindings", auth.RequirePermission("branch-policy", "read"), h.ListNamespaceBindings)
rg.POST("/namespace-bindings", auth.RequirePermission("branch-policy", "write"), h.CreateNamespaceBinding)
rg.GET("/namespace-bindings/:id", auth.RequirePermission("branch-policy", "read"), h.GetNamespaceBinding)
rg.DELETE("/namespace-bindings/:id", auth.RequirePermission("branch-policy", "delete"), h.DeleteNamespaceBinding)
rg.POST("/namespace-bindings/:id/validate", auth.RequirePermission("branch-policy", "read"), h.ValidateNamespaceBinding)
rg.GET("/namespace-bindings/matrix", auth.RequirePermission("branch-policy", "read"), h.GetNamespaceMatrix)  // 分支×环境矩阵
```

### 2.4 服务层扩展

```go
type NamespaceService interface {
    List(ctx context.Context, tenantID string) ([]models.NamespaceBinding, error)
    Get(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error)
    Create(ctx context.Context, tenantID string, req models.CreateNamespaceRequest) (*models.NamespaceBinding, error)
    Delete(ctx context.Context, tenantID, id string) error
    Validate(ctx context.Context, tenantID, branch, envName string) (*models.NamespaceValidationResult, error)
    // 供部署 API 调用的强校验
    VerifyImageTagMatch(ctx context.Context, tenantID, imageTag, envName string) (bool, error)
    VerifyBranchEnvBinding(ctx context.Context, tenantID, branch, envName string) (bool, error)
}
```

### 2.5 部署 API 强校验集成

在现有部署 API（`/api/v1/deployments` 或 `/api/v1/deploy-enhanced`）前插入中间件：

```go
// middleware/branch_env_guard.go
func BranchEnvGuard(svc NamespaceService) gin.HandlerFunc {
    return func(c *gin.Context) {
        body, _ := c.GetRawBody()
        var req DeployRequest
        json.Unmarshal(body, &req)
        
        ok, err := svc.VerifyImageTagMatch(c, req.TenantID, req.ImageTag, req.TargetEnv)
        if !ok || err != nil {
            c.JSON(400, gin.H{
                "success": false,
                "code":    "BRANCH_ENV_MISMATCH",
                "message": fmt.Sprintf("image tag %s not allowed for env %s", req.ImageTag, req.TargetEnv),
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### 2.6 前端页面

**新增**：`orion-frontend/src/pages/BranchPolicy/NamespaceMatrix.tsx`（约 350 行）

```
- 分支 × 环境矩阵视图
  - 行：所有 active 分支
  - 列：dev / staging / prod
  - 单元格：NamespaceBinding 状态（存在/不存在）+ image tag prefix
- 点击单元格：查看/编辑命名空间详情
- 校验按钮：验证当前命名空间规则合规
```

### 2.7 测试用例

- `TestNamespaceBinding_UniquePerBranchEnv`：分支+环境唯一约束
- `TestNamespaceBinding_ImageTagPrefixEnforced`：tag 前缀格式校验
- `TestBranchEnvGuard_RejectMismatch`：image tag 不匹配拒绝
- `TestBranchEnvGuard_AllowMatch`：image tag 匹配放行
- `TestNamespaceMatrix_Build`：矩阵构建正确性

### 2.8 验收标准

- [ ] `models.NamespaceBinding` 完整
- [ ] 6 条路由完整
- [ ] `BranchEnvGuard` 中间件已挂载到部署 API
- [ ] 前端矩阵视图可用
- [ ] 5 个测试覆盖命名空间校验

### 2.9 工时分解

| 子任务 | 工时 |
|-------|-----|
| 数据模型 + DB 迁移 | 0.5d |
| Service 层 + 校验规则 | 1d |
| Handler 路由 + wiring | 0.5d |
| 部署 API 中间件集成 | 1d |
| 前端矩阵视图 | 0.75d |
| 单元测试 | 0.25d |
| **合计** | **4d** |

---

## 3. P0-MB Phase 3 — 同步策略（L4 SyncPolicy）

### 3.1 数据模型

```go
// models/sync_policy.go
type SyncPolicy struct {
    ID              string         `db:"id" json:"id"`
    TenantID        string         `db:"tenant_id" json:"tenantId"`
    Name            string         `db:"name" json:"name"`
    SourceBranch    string         `db:"source_branch" json:"sourceBranch"`
    TargetBranches  []string       `db:"target_branches" json:"targetBranches"`
    Frequency       SyncFrequency  `db:"frequency" json:"frequency"`       // daily|weekly|monthly
    CronExpr        string         `db:"cron_expr" json:"cronExpr"`
    Strategy        SyncStrategy   `db:"strategy" json:"strategy"`         // rebase|cherry-pick|merge
    AutoResolve     SyncResolve    `db:"auto_resolve" json:"autoResolve"` // none|skip-conflict|manual-required
    NotifyOnConflict []string      `db:"notify_on_conflict" json:"notifyOnConflict"`
    NotifyWebhook   string         `db:"notify_webhook" json:"notifyWebhook"`
    Enabled         bool           `db:"enabled" json:"enabled"`
    LastRunAt       *time.Time     `db:"last_run_at" json:"lastRunAt"`
    LastRunStatus   *SyncRunStatus `db:"last_run_status" json:"lastRunStatus"`
    LastRunConflictFiles []string   `db:"last_run_conflict_files" json:"lastRunConflictFiles"`
    ChangeManagementID string      `db:"change_management_id" json:"changeManagementId"`
    CreatedAt       time.Time      `db:"created_at" json:"createdAt"`
    UpdatedAt       time.Time      `db:"updated_at" json:"updatedAt"`
}

type SyncFrequency string
const (
    SyncDaily   SyncFrequency = "daily"
    SyncWeekly  SyncFrequency = "weekly"
    SyncMonthly SyncFrequency = "monthly"
)

type SyncStrategy string
const (
    SyncRebase      SyncStrategy = "rebase"
    SyncCherryPick  SyncStrategy = "cherry-pick"
    SyncMerge       SyncStrategy = "merge"
)

type SyncResolve string
const (
    SyncResolveNone          SyncResolve = "none"
    SyncResolveSkipConflict  SyncResolve = "skip-conflict"
    SyncResolveManualRequired SyncResolve = "manual-required"
)

type SyncRunStatus string
const (
    SyncStatusSuccess  SyncRunStatus = "success"
    SyncStatusConflict SyncRunStatus = "conflict"
    SyncStatusFailed   SyncRunStatus = "failed"
)

// models/sync_run_log.go
type SyncRunLog struct {
    ID             string         `db:"id" json:"id"`
    TenantID       string         `db:"tenant_id" json:"tenantId"`
    PolicyID       string         `db:"policy_id" json:"policyId"`
    TriggeredAt    time.Time      `db:"triggered_at" json:"triggeredAt"`
    TriggeredBy    string         `db:"triggered_by" json:"triggeredBy"`   // scheduler|manual
    SourceCommit   string         `db:"source_commit" json:"sourceCommit"`
    TargetBranches []string       `db:"target_branches" json:"targetBranches"`
    Status         SyncRunStatus  `db:"status" json:"status"`
    ConflictFiles  []string       `db:"conflict_files" json:"conflictFiles"`
    ErrorMsg       string         `db:"error_msg" json:"errorMsg"`
    DurationMs     int64          `db:"duration_ms" json:"durationMs"`
    ChangeID       string         `db:"change_id" json:"changeId"`         // ChangeManagement id
}
```

### 3.2 DB 表

```sql
CREATE TABLE sync_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    source_branch VARCHAR(255) NOT NULL,
    target_branches TEXT NOT NULL,
    frequency VARCHAR(32) NOT NULL,
    cron_expr VARCHAR(64),
    strategy VARCHAR(32) NOT NULL DEFAULT 'merge',
    auto_resolve VARCHAR(32) NOT NULL DEFAULT 'manual-required',
    notify_on_conflict TEXT,
    notify_webhook VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    last_run_status VARCHAR(32),
    last_run_conflict_files TEXT,
    change_management_id VARCHAR(64),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE sync_run_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    policy_id VARCHAR(64) NOT NULL,
    triggered_at TIMESTAMP NOT NULL,
    triggered_by VARCHAR(32) NOT NULL,
    source_commit VARCHAR(64) NOT NULL,
    target_branches TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    conflict_files TEXT,
    error_msg TEXT,
    duration_ms BIGINT,
    change_id VARCHAR(64),
    FOREIGN KEY (policy_id) REFERENCES sync_policies(id),
    INDEX idx_sync_run_log_policy (policy_id, triggered_at)
);
```

### 3.3 路由

```
rg.GET("/sync-policies", auth.RequirePermission("branch-policy", "read"), h.ListSyncPolicies)
rg.POST("/sync-policies", auth.RequirePermission("branch-policy", "write"), h.CreateSyncPolicy)
rg.GET("/sync-policies/:id", auth.RequirePermission("branch-policy", "read"), h.GetSyncPolicy)
rg.PUT("/sync-policies/:id", auth.RequirePermission("branch-policy", "write"), h.UpdateSyncPolicy)
rg.DELETE("/sync-policies/:id", auth.RequirePermission("branch-policy", "delete"), h.DeleteSyncPolicy)
rg.POST("/sync-policies/:id/run-now", auth.RequirePermission("branch-policy", "write"), h.RunSyncNow)
rg.POST("/sync-policies/:id/enable", auth.RequirePermission("branch-policy", "write"), h.EnableSyncPolicy)
rg.POST("/sync-policies/:id/disable", auth.RequirePermission("branch-policy", "write"), h.DisableSyncPolicy)
rg.GET("/sync-policies/:id/run-logs", auth.RequirePermission("branch-policy", "read"), h.ListSyncRunLogs)
rg.GET("/sync-policies/run-logs", auth.RequirePermission("branch-policy", "read"), h.ListAllSyncRunLogs)
```

### 3.4 服务层扩展

```go
type SyncPolicyService interface {
    // CRUD
    List(ctx context.Context, tenantID string) ([]models.SyncPolicy, error)
    Get(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error)
    Create(ctx context.Context, tenantID string, req models.CreateSyncPolicyRequest) (*models.SyncPolicy, error)
    Update(ctx context.Context, tenantID, id string, req models.UpdateSyncPolicyRequest) (*models.SyncPolicy, error)
    Delete(ctx context.Context, tenantID, id string) error
    
    // 执行
    RunNow(ctx context.Context, tenantID, id string, actor string) (*models.SyncRunLog, error)
    Enable(ctx context.Context, tenantID, id string) error
    Disable(ctx context.Context, tenantID, id string) error
    
    // 日志
    ListRunLogs(ctx context.Context, tenantID string, policyID *string, limit int) ([]models.SyncRunLog, error)
    
    // 供调度器调用
    GetEnabledPolicies(ctx context.Context, tenantID string, cronMatch func(string) bool) ([]models.SyncPolicy, error)
}

// 关键规则：
// - AutoResolve === 'manual-required' 时冲突必须阻断并通知
// - 同步后立即触发测试 Pipeline（通过 webhook）
// - 失败/冲突写入 ChangeManagement 变更单
```

### 3.5 调度器集成

```go
// cmd/server/wiring-sync-scheduler.go
func wireSyncScheduler(ctx context.Context, svc SyncPolicyService, logger *zap.Logger) {
    ticker := time.NewTicker(5 * time.Minute)  // 每 5 分钟扫描一次
    go func() {
        for {
            select {
            case <-ticker.C:
                now := time.Now()
                currentCron := getCronForNow(now)
                policies, _ := svc.GetEnabledPolicies(ctx, "", func(expr string) bool {
                    return cronMatches(expr, now)
                })
                for _, p := range policies {
                    if p.LastRunAt != nil && time.Since(*p.LastRunAt) < getMinInterval(p.Frequency) {
                        continue  // 未到执行间隔
                    }
                    log, err := svc.RunNow(ctx, p.TenantID, p.ID, "scheduler")
                    if err != nil || log.Status == models.SyncStatusConflict {
                        logger.Warn("sync policy conflict", zap.String("policy", p.ID), zap.Strings("conflicts", log.ConflictFiles))
                    }
                }
            case <-ctx.Done():
                return
            }
        }
    }()
}
```

### 3.6 前端页面

**新增**：`orion-frontend/src/pages/BranchPolicy/SyncPolicyList.tsx`（约 450 行）

```
- 同步策略列表（表格 + 状态筛选 + 执行历史）
- 创建向导：
  Step 1: 选择源分支
  Step 2: 选择目标分支（多选）
  Step 3: 频率 + 策略（rebase/cherry-pick/merge）
  Step 4: 冲突处理策略 + 通知配置
- 详情页：
  - 最近执行状态（成功/冲突/失败）
  - 冲突文件列表（点击可跳转 CodeMgmt 查看 diff）
  - 执行历史（表格）
- "立即执行"按钮：Run Now
```

### 3.7 测试用例

- `TestSyncPolicy_Validation_FrequencyCronMatch`：频率和 cron 匹配
- `TestSyncPolicy_RunNow_Success`：无冲突成功执行
- `TestSyncPolicy_RunNow_Conflict_WithManualRequired`：冲突阻断 + 通知
- `TestSyncPolicy_RunNow_Conflict_WithSkipConflict`：跳过冲突继续
- `TestSyncScheduler_TriggerOnTime`：调度器按时触发
- `TestSyncScheduler_RespectMinInterval`：调度器尊重最小执行间隔

### 3.8 验收标准

- [ ] `models.SyncPolicy` + `SyncRunLog` 完整
- [ ] DB 表 + 迁移脚本
- [ ] 10 条路由完整
- [ ] 调度器集成（wiring-sync-scheduler.go）
- [ ] 前端 2 个页面（列表 + 详情）
- [ ] 6 个测试覆盖核心逻辑

### 3.9 工时分解

| 子任务 | 工时 |
|-------|-----|
| 数据模型 + DB 迁移 | 1d |
| Service 层 + 执行逻辑 | 1.5d |
| Handler 路由 + wiring | 1d |
| 调度器集成 | 1d |
| 前端页面 | 1d |
| 单元测试 | 0.5d |
| **合计** | **6d** |

---

## 4. P0-MB Phase 4 — 变更审计（L5 DeployEvent）

### 4.1 数据模型

```go
// models/deploy_event.go
type DeployEvent struct {
    ID          string    `db:"id" json:"id"`
    TenantID    string    `db:"tenant_id" json:"tenantId"`
    ActorID     string    `db:"actor_id" json:"actorId"`
    ActorName   string    `db:"actor_name" json:"actorName"`
    Branch      string    `db:"branch" json:"branch"`
    Env         string    `db:"env" json:"env"`
    FromCommit  string    `db:"from_commit" json:"fromCommit"`
    ToCommit    string    `db:"to_commit" json:"toCommit"`
    ArtifactID  string    `db:"artifact_id" json:"artifactId"`
    ImageDigest string    `db:"image_digest" json:"imageDigest"`
    ApprovalID  string    `db:"approval_id" json:"approvalId"`   // ChangeManagement id
    Outcome     DeployOutcome `db:"outcome" json:"outcome"`      // success|rolled-back|failed
    RollbackTo  *string   `db:"rollback_to" json:"rollbackTo"`
    DurationMs  int64     `db:"duration_ms" json:"durationMs"`
    ErrorRate   float64   `db:"error_rate" json:"errorRate"`
    P99Latency  int64     `db:"p99_latency" json:"p99Latency"`
    StartedAt   time.Time `db:"started_at" json:"startedAt"`
    CompletedAt *time.Time `db:"completed_at" json:"completedAt"`
    GateResult  string    `db:"gate_result" json:"gateResult"`   // JSON PreDeployGate 结果
}

type DeployOutcome string
const (
    DeployOutcomeSuccess    DeployOutcome = "success"
    DeployOutcomeRolledBack DeployOutcome = "rolled-back"
    DeployOutcomeFailed     DeployOutcome = "failed"
)
```

### 4.2 DB 表

```sql
CREATE TABLE deploy_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(128),
    branch VARCHAR(255) NOT NULL,
    env VARCHAR(32) NOT NULL,
    from_commit VARCHAR(64),
    to_commit VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(64),
    image_digest VARCHAR(128),
    approval_id VARCHAR(64),
    outcome VARCHAR(32) NOT NULL,
    rollback_to VARCHAR(64),
    duration_ms BIGINT,
    error_rate DOUBLE,
    p99_latency BIGINT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    gate_result TEXT,
    INDEX idx_deploy_event_branch_env (branch, env, started_at),
    INDEX idx_deploy_event_tenant_time (tenant_id, started_at),
    INDEX idx_deploy_event_approval (approval_id)
);
```

### 4.3 路由

```
rg.GET("/deploy-events", auth.RequirePermission("branch-policy", "read"), h.ListDeployEvents)
rg.GET("/deploy-events/:id", auth.RequirePermission("branch-policy", "read"), h.GetDeployEvent)
rg.POST("/deploy-events", auth.RequirePermission("branch-policy", "write"), h.CreateDeployEvent)
rg.POST("/deploy-events/:id/rollback", auth.RequirePermission("branch-policy", "write"), h.RollbackDeployEvent)
rg.GET("/deploy-events/by-branch/:branch", auth.RequirePermission("branch-policy", "read"), h.ListByBranch)
rg.GET("/deploy-events/by-env/:env", auth.RequirePermission("branch-policy", "read"), h.ListByEnv)
rg.GET("/deploy-events/by-actor/:actor", auth.RequirePermission("branch-policy", "read"), h.ListByActor)
rg.GET("/deploy-events/audit-trail", auth.RequirePermission("branch-policy", "read"), h.GetAuditTrail)  // 分支/环境/制品完整轨迹
```

### 4.4 服务层扩展

```go
type DeployEventService interface {
    // 记录
    Record(ctx context.Context, evt *models.DeployEvent) error
    UpdateOutcome(ctx context.Context, tenantID, id string, outcome models.DeployOutcome, errorMsg string) error
    UpdateMetrics(ctx context.Context, tenantID, id string, m models.DeployMetrics) error
    
    // 查询
    Get(ctx context.Context, tenantID, id string) (*models.DeployEvent, error)
    List(ctx context.Context, tenantID string, q models.DeployEventQuery) ([]models.DeployEvent, error)
    ListByBranch(ctx context.Context, tenantID, branch string, limit int) ([]models.DeployEvent, error)
    ListByEnv(ctx context.Context, tenantID, env string, limit int) ([]models.DeployEvent, error)
    
    // 回滚
    Rollback(ctx context.Context, tenantID, id string, actorID string) (*models.DeployEvent, error)
    // - 找到原始 DeployEvent
    // - 创建新的 DeployEvent 记录 rollback（ToCommit = 原 FromCommit）
    // - 触发部署 pipeline（部署回滚镜像）
    // - 关联 ApprovalID（ChangeManagement 变更单）
    
    // 追溯
    GetAuditTrail(ctx context.Context, tenantID string, params models.AuditTrailParams) (*models.AuditTrailResult, error)
    // - 环境 → 分支 → 制品 → 变更单 完整链路
}
```

### 4.5 与 ChangeManagement 集成

```go
// 部署 API 调用流程：
func DeployEnhancedHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. PreDeployGate 检查（Phase 5）
        gateResult, err := gate.Check(ctx, req)
        if !gateResult.Passed {
            c.JSON(400, gateResult); c.Abort(); return
        }
        
        // 2. 记录 DeployEvent（started）
        evt := &models.DeployEvent{
            ActorID:    c.GetString("user_id"),
            Branch:     req.Branch,
            Env:        req.Env,
            FromCommit: currentCommit,
            ToCommit:   req.CommitSHA,
            ArtifactID: req.ArtifactID,
            ApprovalID: req.ChangeManagementID,
            Outcome:    models.DeployOutcomeSuccess,
            GateResult: toJSON(gateResult),
            StartedAt:  time.Now(),
        }
        deployEventSVC.Record(ctx, evt)
        
        // 3. 执行部署
        err := deploymentPipeline.Execute(ctx, req)
        if err != nil {
            deployEventSVC.UpdateOutcome(ctx, tenantID, evt.ID, models.DeployOutcomeFailed, err.Error())
            c.JSON(500, gin.H{"success": false, "error": err.Error()}); return
        }
        
        // 4. 部署完成
        deployEventSVC.UpdateMetrics(ctx, tenantID, evt.ID, metrics)
        c.JSON(200, evt)
    }
}
```

### 4.6 前端页面

**新增**：`orion-frontend/src/pages/BranchPolicy/DeployAudit.tsx`（约 400 行）

```
- 变更审计列表（表格 + 多条件筛选：分支/环境/演员/结果）
- 详情抽屉：完整 DeployEvent 信息 + Gate 结果 + 关联变更单
- 一键回滚按钮：调用 /rollback 端点
- 追溯视图：环境 → 分支 → 制品 → 变更单（图形化）
- 审计追踪：GetAuditTrail 结果展示
```

### 4.7 测试用例

- `TestDeployEvent_Record_Success`：正常记录
- `TestDeployEvent_Record_WithApproval`：带变更单
- `TestDeployEvent_Rollback_CreatesNewEvent`：回滚创建新事件
- `TestDeployEvent_GetAuditTrail_FullChain`：完整追溯链
- `TestDeployEvent_MetricsUpdate`：指标更新
- `TestDeployEvent_OutcomeTransition`：状态机（started→success/failed→rolled-back）

### 4.8 验收标准

- [ ] `models.DeployEvent` 完整（17 字段 + 状态机）
- [ ] DB 表 + 3 个索引
- [ ] 8 条路由完整
- [ ] 部署 API 集成 DeployEvent 记录
- [ ] 一键回滚能力
- [ ] 前端审计 + 回滚页面
- [ ] 6 个测试覆盖状态机

### 4.9 工时分解

| 子任务 | 工时 |
|-------|-----|
| 数据模型 + DB 迁移 | 0.5d |
| Service 层 + 回滚逻辑 | 1.5d |
| Handler 路由 + wiring | 0.75d |
| 部署 API 集成 | 1d |
| 前端审计页面 | 1d |
| 单元测试 | 0.25d |
| **合计** | **5d** |

---

## 5. P0-MB Phase 5 — 冲突预检查（PreDeployGate R1-R6）

### 5.1 数据模型

```go
// models/pre_deploy_gate.go
type PreDeployGateResult struct {
    Passed      bool              `json:"passed"`
    RequestID   string            `json:"requestId"`
    CheckedAt   time.Time         `json:"checkedAt"`
    Branch      string            `json:"branch"`
    Env         string            `json:"env"`
    Rules       []GateRuleResult  `json:"rules"`
    Blocked     []string          `json:"blocked"`     // 触发阻断的规则 ID 列表
}

type GateRuleResult struct {
    RuleID    string  `json:"ruleId"`   // R1-R6
    Name      string  `json:"name"`     // 规则名（如 "Branch-Env 匹配"）
    Passed    bool    `json:"passed"`
    Detail    string  `json:"detail"`
    Severity  string  `json:"severity"` // blocking|warning
}

// models/merge_preview.go
type MergePreview struct {
    ID            string     `db:"id" json:"id"`
    TenantID      string     `db:"tenant_id" json:"tenantId"`
    SourceBranch  string     `db:"source_branch" json:"sourceBranch"`
    TargetBranch  string     `db:"target_branch" json:"targetBranch"`
    SourceCommit  string     `db:"source_commit" json:"sourceCommit"`
    TargetCommit  string     `db:"target_commit" json:"targetCommit"`
    ConflictFiles []string   `db:"conflict_files" json:"conflictFiles"`
    AddedFiles    []string   `db:"added_files" json:"addedFiles"`
    ModifiedFiles []string   `db:"modified_files" json:"modifiedFiles"`
    DeletedFiles  []string   `db:"deleted_files" json:"deletedFiles"`
    ConflictCount int        `db:"conflict_count" json:"conflictCount"`
    RiskLevel     string     `db:"risk_level" json:"riskLevel"`  // low|medium|high|critical
    PreviewedAt   time.Time  `db:"previewed_at" json:"previewedAt"`
}
```

### 5.2 DB 表

```sql
CREATE TABLE merge_previews (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    source_branch VARCHAR(255) NOT NULL,
    target_branch VARCHAR(255) NOT NULL,
    source_commit VARCHAR(64) NOT NULL,
    target_commit VARCHAR(64) NOT NULL,
    conflict_files TEXT,
    added_files TEXT,
    modified_files TEXT,
    deleted_files TEXT,
    conflict_count INT NOT NULL DEFAULT 0,
    risk_level VARCHAR(32) NOT NULL DEFAULT 'low',
    previewed_at TIMESTAMP NOT NULL,
    INDEX idx_merge_preview_tenant (tenant_id, previewed_at)
);
-- 说明：PreDeployGateResult 不落库，只作为 API 响应
```

### 5.3 PreDeployGate 服务（核心）

```go
// service/pre_deploy_gate.go
type PreDeployGate interface {
    Check(ctx context.Context, tenantID string, req DeployRequest) (*models.PreDeployGateResult, error)
}

type PreDeployGateImpl struct {
    branchProfileSVC  BranchProfileService
    buildArtifactSVC  BuildArtifactService
    namespaceSVC      NamespaceService
    syncPolicySVC     SyncPolicyService
    deployEventSVC    DeployEventService
    migrationSVC      MigrationService  // 数据库迁移服务
}

func (g *PreDeployGateImpl) Check(ctx context.Context, tenantID string, req DeployRequest) (*models.PreDeployGateResult, error) {
    result := &models.PreDeployGateResult{
        RequestID: req.RequestID,
        CheckedAt: time.Now(),
        Branch:    req.Branch,
        Env:       req.Env,
        Rules:     make([]models.GateRuleResult, 0, 6),
    }
    
    // R1: Branch-Env 匹配
    r1 := g.checkR1BranchEnvMatch(ctx, tenantID, req)
    result.Rules = append(result.Rules, r1)
    
    // R2: Digest 完整性（签名验证）
    r2 := g.checkR2DigestSignature(ctx, tenantID, req)
    result.Rules = append(result.Rules, r2)
    
    // R3: 变更单审批
    r3 := g.checkR3ApprovalRequired(ctx, tenantID, req)
    result.Rules = append(result.Rules, r3)
    
    // R4: 分支状态（未归档）
    r4 := g.checkR4BranchNotArchived(ctx, tenantID, req)
    result.Rules = append(result.Rules, r4)
    
    // R5: Pipeline 匹配（allowedPipelines）
    r5 := g.checkR5PipelineAllowed(ctx, tenantID, req)
    result.Rules = append(result.Rules, r5)
    
    // R6: Schema 兼容（DB migration 不降级）
    r6 := g.checkR6SchemaCompatibility(ctx, tenantID, req)
    result.Rules = append(result.Rules, r6)
    
    // 汇总
    result.Passed = allPassed(result.Rules)
    for _, r := range result.Rules {
        if !r.Passed && r.Severity == "blocking" {
            result.Blocked = append(result.Blocked, r.RuleID)
        }
    }
    return result, nil
}

func (g *PreDeployGateImpl) checkR1BranchEnvMatch(ctx context.Context, tenantID string, req DeployRequest) models.GateRuleResult {
    ok, err := g.namespaceSVC.VerifyImageTagMatch(ctx, tenantID, req.ImageTag, req.Env)
    if err != nil || !ok {
        return models.GateRuleResult{
            RuleID: "R1", Name: "Branch-Env 匹配",
            Passed: false, Severity: "blocking",
            Detail: fmt.Sprintf("image tag %s 不匹配环境 %s 的分支声明", req.ImageTag, req.Env),
        }
    }
    return models.GateRuleResult{RuleID: "R1", Name: "Branch-Env 匹配", Passed: true, Severity: "blocking"}
}

// ... R2-R6 类似实现
```

### 5.4 路由

```
rg.POST("/pre-deploy-gate/check", auth.RequirePermission("branch-policy", "read"), h.CheckPreDeployGate)
rg.POST("/merge-preview", auth.RequirePermission("branch-policy", "read"), h.CreateMergePreview)
rg.GET("/merge-preview/:id", auth.RequirePermission("branch-policy", "read"), h.GetMergePreview)
rg.GET("/merge-preview", auth.RequirePermission("branch-policy", "read"), h.ListMergePreviews)
```

### 5.5 MergePreview 服务

```go
type MergePreviewService interface {
    // 调用 git merge-tree 或 GitLab/GitHub API 预检
    Preview(ctx context.Context, tenantID string, req models.MergePreviewRequest) (*models.MergePreview, error)
    Get(ctx context.Context, tenantID, id string) (*models.MergePreview, error)
    List(ctx context.Context, tenantID string, limit int) ([]models.MergePreview, error)
}

type MergePreviewRequest struct {
    SourceBranch string `json:"sourceBranch" binding:"required"`
    TargetBranch string `json:"targetBranch" binding:"required"`
    SourceCommit string `json:"sourceCommit"`  // 可选
    TargetCommit string `json:"targetCommit"`  // 可选
}

// 实现思路：
// 1. 调用 CodeMgmt 获取当前分支状态
// 2. 使用 GitLab/GitHub merge request preview API
// 3. 或用本地 git merge-tree 计算冲突
// 4. 分析文件变更分类（added/modified/deleted/conflict）
// 5. 计算 risk level（冲突数 > 10 → critical, > 5 → high, > 2 → medium, else low）
```

### 5.6 CodeMgmt.createMR 集成

```go
// CodeMgmt.createMR handler 中调用 MergePreview：
func (h *CodeMgmtHandler) CreateMergeRequest(c *gin.Context) {
    // ... 现有逻辑
    
    // 新增：自动计算 merge preview
    preview, err := h.mergePreviewSVC.Preview(ctx, tenantID, models.MergePreviewRequest{
        SourceBranch: req.SourceBranch,
        TargetBranch: req.TargetBranch,
    })
    if err == nil {
        response.MergePreview = preview  // 附带冲突预览
    }
}
```

### 5.7 前端页面

**新增**：`orion-frontend/src/pages/BranchPolicy/PreDeployGate.tsx`（约 300 行）

```
- 部署前检查面板：展示 6 条规则的通过/失败状态
- 阻断规则高亮：红色 + 详情 tooltip
- 警告规则高亮：黄色 + 详情 tooltip
- 一键复制 GateResult JSON（便于调试）
```

**新增**：`orion-frontend/src/pages/BranchPolicy/MergePreview.tsx`（约 400 行）

```
- 合并预检查表单：选择源分支 + 目标分支
- 冲突文件列表：按目录分组 + 严重度标记
- 变更统计：新增/修改/删除文件数
- 风险等级徽章：low/medium/high/critical
- 预览 diff：点击文件可看 git diff
```

### 5.8 测试用例

- `TestPreDeployGate_R1_BranchEnvMatch_Pass`：匹配通过
- `TestPreDeployGate_R1_BranchEnvMatch_Fail`：不匹配阻断
- `TestPreDeployGate_R2_DigestSignature_Invalid`：签名无效阻断
- `TestPreDeployGate_R3_Approval_Missing`：无审批阻断
- `TestPreDeployGate_R4_Branch_Archived`：归档分支阻断
- `TestPreDeployGate_R5_Pipeline_NotAllowed`：pipeline 不在 allowedPipelines 阻断
- `TestPreDeployGate_R6_Migration_Downgrade`：DB migration 回退阻断
- `TestPreDeployGate_AllPass`：所有规则通过
- `TestMergePreview_GeneratesConflictList`：生成冲突文件列表
- `TestMergePreview_RiskLevel_Calculated`：风险等级计算

### 5.9 验收标准

- [ ] `models.PreDeployGateResult` + `GateRuleResult` 完整
- [ ] `models.MergePreview` 完整
- [ ] DB 表 `merge_previews`
- [ ] 4 条路由完整
- [ ] PreDeployGate 6 条规则全部实现
- [ ] CodeMgmt.createMR 集成 MergePreview
- [ ] 前端 2 个页面（Gate + MergePreview）
- [ ] 10 个测试覆盖所有规则

### 5.10 工时分解

| 子任务 | 工时 |
|-------|-----|
| 数据模型 + DB 迁移 | 0.5d |
| PreDeployGate 6 规则实现 | 2d |
| MergePreview 服务 | 1d |
| Handler 路由 + wiring | 0.5d |
| CodeMgmt 集成 | 0.5d |
| 前端 2 页面 | 1d |
| 单元测试 | 0.5d |
| **合计** | **6d** |

---

## 6. 5 Phase 汇总

| Phase | 主要产出 | 工时 | 前置依赖 |
|-------|--------|-----|---------|
| P0-MB Phase 1 | BranchProfile + BuildArtifact（6 大模型前 2 个） | 5d | 无 |
| P0-MB Phase 2 | NamespaceBinding（L2）+ BranchEnvGuard 中间件 | 4d | Phase 1 |
| P0-MB Phase 3 | SyncPolicy + SyncRunLog + 调度器 | 6d | Phase 1 |
| P0-MB Phase 4 | DeployEvent + 部署 API 集成 + 一键回滚 | 5d | Phase 1 + 2 |
| P0-MB Phase 5 | PreDeployGate R1-R6 + MergePreview | 6d | Phase 1 + 2 + 3 + 4 |
| **合计** | **6 大模型 + 20 路由 + 4 前端页面 + 部署 API 强校验** | **26d** | — |

### 6.1 累计产出

| 类型 | 数量 |
|------|------|
| Go 数据模型（新增） | 6 |
| DB 表（新增） | 5 |
| 服务接口 | 6 |
| API 路由（新增） | 40 |
| 前端页面（新增） | 6 |
| 单元测试 | 40+ |
| 代码量估算 | ~3500 行 Go + ~2500 行 TS/React |

### 6.2 与 branch-policy 现状差距

| 维度 | 现状 | 目标 | 差距 |
|-----|-----|-----|-----|
| models 行数 | 23 | ~600 | +577 |
| service 行数 | 273 | ~2000 | +1727 |
| handler 行数 | 779 | ~1500 | +721 |
| repository 行数 | 47 | ~800 | +753 |
| 前端页面数 | 0（CodeMgmt 下非本模块） | 6 新页面 | +6 |
| 路由数 | 20（骨架通用） | 40+ 精确 | +20 |

---

## 7. 与 v3.7 Phase 301-306 关系

| Phase 300 差距扩展 | 与 P0-MB 的关系 |
|-------------------|--------------|
| Phase 301（T-QUOTA 命名规范） | 独立，无依赖 |
| Phase 302（T-CONFIG-LEVEL Level 字段） | 独立，无依赖 |
| Phase 303（T-SPI BuiltinPoint 枚举） | 独立，无依赖 |
| Phase 304（T-AUDIT 新合规框架） | 独立，无依赖 |
| Phase 305（T-AUDIT Dashboard） | 独立，无依赖 |
| Phase 306（T-QUOTA 软/硬限） | 独立，无依赖 |

**结论**：Phase 301-306 与 P0-MB Phase 1-5 完全独立，可并行实施。合计 **32d**（6 + 26）。

---

## 8. 授权阻塞状态

| 任务组 | 工时 | 涉及目录 | 授权状态 |
|-------|-----|---------|---------|
| Phase 301-306 | 6d | `orion-platform-svc-go/internal/{tenant-quota,distributed-config,extension-point,audit}/` | ⚠️ FORBIDDEN |
| P0-MB Phase 1-5 | 26d | `orion-platform-svc-go/internal/branch-policy/` + 前端 `orion-frontend/src/pages/BranchPolicy/` | ⚠️ FORBIDDEN |
| **合计** | **32d** | — | **需用户明确授权** |

---

## 9. 建议下一步

### 9.1 立即执行（纯文档）

- ✅ 本文档（P0-MB Phase 1-5 详细设计）生成
- ✅ 更新 `docs/multi-branch-strategy-design.md` 关联到本文档
- ✅ 更新 `docs/ALL_TODOS.md` 引用本文档
- ✅ 更新 `docs/flagship-review-v3.7-delta-impl-2026-09-08.md` §7 引用本文档

### 9.2 等待授权后执行（代码）

- Phase 301-306（6d）：差距扩展
- P0-MB Phase 1-5（26d）：多分支并行策略

**总工期估算**：32d（可并行，实际 20-24 天）

---

**设计日期**：2026-09-08
**设计人**：SenseNova 6.8 Flash Lite
**方法**：`grep` + `find` + `wc -l` 全库核实 + 详细 API/模型/服务/前端/测试设计
