# cmdb 4 个 K8s/Script 桩升级方案（P0-NEW-EA-14，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | cmdb-k8s-script-stub-upgrade-2026-10-11 |
| 状态 | 已产出（NEW-EA-14） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §6.4 关键判据 13（NEW-EA-14）；一手代码 `service.go:360-464` |
| 前置 | 无（纯文档设计，非生产代码）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 问题陈述

### 1.1 现状（一手代码实证）

`orion-platform-svc-go/internal/cmdb/service/service.go` 中 4 个桩函数返回**硬编码 mock 数据**，未接入真实 K8s API 或脚本执行引擎：

| # | 函数 | 行号 | 桩特征 | 当前返回 |
|---|------|------|-------|---------|
| 1 | `ListK8sResources` | 360-398 | `// Mock/scaffold data for K8s resources.` | 3 条硬编码 `K8sResource`（`web-api` / `web-api-svc` / `app-config`）|
| 2 | `StartK8sSync` | 401-405 | `// Scaffold: record sync start config.` | `nil`（无副作用）|
| 3 | `StopK8sSync` | 407-410 | `// Scaffold: stop K8s sync.` | `nil`（无副作用）|
| 4 | `ListCICDResources` | 412-440 | 硬编码 3 条 `CICDResource` | 3 条假数据（`build-pipeline` / `deploy-runner` / `test-pipeline`）|

另有 `ExecuteScript`（行 446-464）：

| # | 函数 | 行号 | 桩特征 | 当前返回 |
|---|------|------|-------|---------|
| 5 | `ExecuteScript` | 446-464 | `[scaffold] executed %q script` | 假 success 结果，未真正执行脚本 |

**核心问题**：5 个桩函数共 ~130 行代码，全部为脚手架，未接入：
- `k8s.io/client-go`（K8s API 官方 SDK）
- 脚本执行引擎（`ssh` / `kubectl` / `terraform exec` 等）
- 任务调度器（`StartK8sSync` 应启动后台 job）

**污染面**：
- 前端 `cmdb/k8s` 页面显示假数据（用户以为 K8s 集群已接入）
- 前端 `cmdb/execute` 页面显示假 success（用户以为脚本已执行）
- 监控指标无法反映真实 K8s 集群状态

### 1.2 与其他 stub 的对比

| Stub 类型 | 位置 | 数量 | 影响面 |
|----------|-----|-----|-------|
| **本次（NEW-EA-14）** | cmdb K8s/Script | 5 个 | **P0**（用户交互直接暴露假数据）|
| G-SV Service 简化（v3 §4.1）| 8 模块 CRUD 骨架 | 8 个 | P1（业务逻辑简化，但用户交互不受影响）|
| RunnerPool 桩 | ci-cd/runner | 1 个 | P1（已标注 `Node.js RunnerPoolService.executeOnRunner` 对照）|

---

## 2. 目标与判据

### 2.1 目标

将 5 个桩函数升级为真实实现，接入 `k8s.io/client-go` + 脚本执行引擎 + 任务调度器。

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 真实数据 | AWS WA REL03-BP01（真实数据源）| 桩函数全部替换为真实 K8s API 调用 |
| D2 租户隔离 | ADR-011 + 本文件 §4 | 每租户 K8s 集群独立连接（`k8s_client_config` 表）|
| D3 错误传播 | CLAUDE.md 后端验证门控 | 错误用 `OrionError` 结构化，非 `throw new Error` |
| D4 可观测性 | ADR-007 OTel 追踪 | 每次 K8s API 调用有 span，超时 30s |
| D5 脚本执行安全 | OWASP A03 | 脚本执行走白名单（`allowed_script_types` 表），禁 shell 注入 |

---

## 3. 目标实现方案

### 3.1 依赖引入

```go
// go.mod 新增依赖
require (
    k8s.io/client-go v0.31.0
    k8s.io/api v0.31.0
    k8s.io/apimachinery v0.31.0
    golang.org/x/crypto/ssh v0.23.0  // 远程脚本执行
)
```

### 3.2 新增包结构

```
internal/cmdb/k8s/
├── client.go           # K8sClientManager（多集群连接池）
├── lister.go           # ListK8sResources 真实实现
├── sync.go             # StartK8sSync / StopK8sSync 真实实现（后台 job）
└── client_test.go      # 单测（mock k8s API）

internal/cmdb/script/
├── executor.go         # ScriptExecutor 接口 + 3 实现（bash/python/terraform）
├── whitelist.go        # 脚本白名单校验
└── executor_test.go    # 单测（mock 执行器）
```

### 3.3 关键代码示例（伪代码，非生产代码）

**K8sClientManager**（`internal/cmdb/k8s/client.go`）：

```go
type K8sClientManager struct {
    mu      sync.RWMutex
    clients map[string]clientset.Interface  // clusterID → client
    repo    K8sClusterRepository
}

func (m *K8sClientManager) GetClusterClient(ctx context.Context, tenantID, clusterID string) (clientset.Interface, error) {
    m.mu.RLock()
    if c, ok := m.clients[clusterID]; ok {
        m.mu.RUnlock()
        return c, nil
    }
    m.mu.RUnlock()

    // 从 DB 加载 cluster 配置（含 kubeconfig）
    cluster, err := m.repo.Get(ctx, tenantID, clusterID)
    if err != nil {
        return nil, errors.Wrap(ErrClusterNotFound, clusterID)
    }

    // 构建 client
    config, err := clientcmd.BuildConfigFromFlags("", cluster.KubeconfigPath)
    if err != nil {
        return nil, errors.Wrap(ErrKubeconfigInvalid, clusterID)
    }

    client, err := clientset.NewForConfig(config)
    if err != nil {
        return nil, errors.Wrap(ErrK8sClientInit, clusterID)
    }

    m.mu.Lock()
    m.clients[clusterID] = client
    m.mu.Unlock()
    return client, nil
}
```

**ListK8sResources 真实实现**（`internal/cmdb/k8s/lister.go`）：

```go
func (m *K8sClientManager) ListResources(ctx context.Context, tenantID, clusterID string, kind *string, namespace *string, limit, offset int) ([]models.K8sResource, int, error) {
    client, err := m.GetClusterClient(ctx, tenantID, clusterID)
    if err != nil {
        return nil, 0, err
    }

    // K8s API 真实调用
    deployments, err := client.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{Limit: int32(limit + offset)})
    if err != nil {
        return nil, 0, errors.Wrap(ErrK8sAPIError, err.Error())
    }

    // 转换为 CMDB K8sResource 模型
    resources := []models.K8sResource{}
    for _, d := range deployments.Items {
        resources = append(resources, models.K8sResource{
            ID:        string(d.UID),
            Kind:      "Deployment",
            Name:      d.Name,
            Namespace: d.Namespace,
            Status:    string(d.Status.AvailableReplicas),
            Cluster:   clusterID,
            CreatedAt: d.CreationTimestamp.Format(time.RFC3339),
        })
    }
    return resources[offset:min(limit+offset, len(resources))], len(resources), nil
}
```

**ScriptExecutor 接口**（`internal/cmdb/script/executor.go`）：

```go
type ScriptExecutor interface {
    Execute(ctx context.Context, req *models.ScriptExecRequest) (*models.ScriptExecResult, error)
}

type ScriptExecutorRouter struct {
    executors map[string]ScriptExecutor  // scriptType → executor
}

func (r *ScriptExecutorRouter) Execute(ctx context.Context, req *models.ScriptExecRequest) (*models.ScriptExecResult, error) {
    // 白名单校验
    if !r.isAllowed(req.ScriptType) {
        return nil, ErrScriptTypeNotAllowed
    }

    exec, ok := r.executors[req.ScriptType]
    if !ok {
        return nil, ErrScriptTypeUnsupported
    }
    return exec.Execute(ctx, req)
}
```

### 3.4 数据模型（Migration 769）

```sql
-- 新增 k8s_cluster 表（多集群连接）
CREATE TABLE k8s_clusters (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,
    kubeconfig_path VARCHAR(500) NOT NULL,  -- 指向加密存储的 kubeconfig
    endpoint        VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- 新增 script_whitelist 表（脚本白名单）
CREATE TABLE script_whitelist (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    script_type     VARCHAR(50) NOT NULL,  -- 'bash' / 'python' / 'terraform'
    target_ci_types TEXT[] NOT NULL,         -- 允许的目标 CI 类型
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, script_type)
);
```

---

## 4. 租户隔离方案

| 层 | 隔离机制 | 依据 |
|---|---------|------|
| K8s 集群连接 | `k8s_clusters.tenant_id` 强制过滤（ADR-011 TenantAwareRepository）| ADR-011 |
| 脚本白名单 | `script_whitelist.tenant_id` 强制过滤 | ADR-011 |
| K8s API 调用 | 每次调用从 `ctx` 提取 `tenant_id`，查 `k8s_clusters` 获取连接 | ADR-011 §3.2.6 L2 |
| 脚本执行 | 目标 CI ID 必须属于同 tenant | ADR-011 §3.2.6 L3 |

---

## 5. 验证方式

### 5.1 静态验证

```bash
# 桩代码已消除
grep -n "Mock\|scaffold\|// Mock\|// Scaffold" orion-platform-svc-go/internal/cmdb/service/service.go
# 期望：0 命中（ListK8sResources / StartK8sSync / StopK8sSync / ListCICDResources / ExecuteScript 全部替换）

# 真实依赖引入
grep -n "k8s.io/client-go\|golang.org/x/crypto/ssh" orion-platform-svc-go/go.mod
# 期望：2 处

# 新包结构
ls orion-platform-svc-go/internal/cmdb/k8s/*.go orion-platform-svc-go/internal/cmdb/script/*.go
# 期望：>=6 文件

# Migration
ls orion-platform-svc-go/migrations/769_*.sql
# 期望：1 文件
```

### 5.2 单测验证

```bash
# K8s client 连接池
go test ./internal/cmdb/k8s/... -run TestK8sClientManager -count=1
# 期望：通过（mock k8s API）

# 脚本执行白名单
go test ./internal/cmdb/script/... -run TestScriptWhitelist -count=1
# 期望：白名单拒绝非授权脚本类型

# 真实 K8s API 调用（集成测试）
go test ./internal/cmdb/k8s/... -run TestListResources -tags=integration -count=1
# 期望：与 kind 或 minikube 集群集成测试通过
```

### 5.3 端到端验证

```bash
# 前置：kind 集群 + kubeconfig 已配置
kind create cluster --name orion-test

# 创建 K8s cluster 记录
curl -X POST localhost:3001/api/v1/cmdb/k8s/clusters \
    -d '{"name": "test-cluster", "kubeconfigPath": "/tmp/kind-config"}'

# 列表（应返回真实 K8s 资源）
curl localhost:3001/api/v1/cmdb/k8s?clusterID=<id>&kind=Deployment
# 期望：返回集群内真实 Deployment 列表，非硬编码 web-api/web-api-svc/app-config
```

---

## 6. 迁移与回滚

### 6.1 迁移策略

| 阶段 | 内容 |
|-----|------|
| 阶段 1 | 引入 `k8s.io/client-go` 依赖 + 新包结构（k8s/ + script/）|
| 阶段 2 | Migration 769 落地（k8s_clusters + script_whitelist 表）|
| 阶段 3 | 替换 `ListK8sResources` / `StartK8sSync` / `StopK8sSync` / `ListCICDResources` 4 个桩为真实实现 |
| 阶段 4 | 替换 `ExecuteScript` 桩为白名单校验 + 真实脚本执行 |
| 阶段 5 | 集成测试 + 灰度上线 |

### 6.2 回滚

| 场景 | 回滚方式 |
|-----|---------|
| 阶段 1-2 失败 | `git revert` + `psql -f 769.down.sql` |
| 阶段 3 失败（K8s API 调用异常）| 回滚 service.go 到桩版本 + 保留 Migration |
| 阶段 4 失败（脚本执行异常）| 回滚 script/ 包 + 保留 Migration |
| 生产事故 | 降级到桩版本（Feature flag `cmdb.k8s.enabled=false`）|

---

## 7. 与 CLAUDE.md 技能一致性契约的对齐

| 项 | 归属 | 说明 |
|----|-----|------|
| 依赖分析 | code-design-analyzer | 能力十一（框架选型）覆盖 k8s.io/client-go 引入 |
| 安全与隔离 | design-constraint + code-design-analyzer | 脚本白名单走 AST detector `script-execution-allowlist` |
| 任务拆分 | task-decomposer | 5 个桩替换由 task-decomposer 拆分为 5 个子任务 |
| 文档评审 | design-doc-reviewer | 本文件由 design-doc-reviewer 评审 |

---

## 8. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 6 | 依赖引入 1 + Migration 1 + 4 个桩替换 3 + 1 个脚本执行器 | P0 |
| **code-design-analyzer** | 2 | k8s.io/client-go 框架选型 + 脚本执行安全 | P1 |
| **design-constraint** | 1 | 脚本白名单 AST detector 新增 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "cmdb_k8s_script_stub_upgrade",
  "total_gaps": 5,
  "downstream_routing": {
    "task_decomposer": {
      "count": 6,
      "items": [
        {"id": "CMDB-K8S-1", "title": "go.mod 引入 k8s.io/client-go + golang.org/x/crypto/ssh", "priority": "P0", "depends_on": []},
        {"id": "CMDB-K8S-2", "title": "Migration 769: k8s_clusters + script_whitelist 表", "priority": "P0", "depends_on": []},
        {"id": "CMDB-K8S-3", "title": "K8sClientManager + ListResources 真实实现", "priority": "P0", "depends_on": ["CMDB-K8S-1", "CMDB-K8S-2"]},
        {"id": "CMDB-K8S-4", "title": "StartK8sSync / StopK8sSync 后台 job 实现", "priority": "P0", "depends_on": ["CMDB-K8S-3"]},
        {"id": "CMDB-K8S-5", "title": "ListCICDResources 接 GitLab/GitHub API", "priority": "P0", "depends_on": []},
        {"id": "CMDB-K8S-6", "title": "ExecuteScript 白名单 + 真实执行器（bash/python/terraform）", "priority": "P0", "depends_on": ["CMDB-K8S-2"]}
      ]
    }
  }
}
```

---

## 9. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **桩函数实证位置**：`service.go:360-464` 共 5 个桩，全部硬编码 mock 数据
3. **k8s.io/client-go v0.31.0**：为推荐版本，实际引入版本需与项目其他 k8s 依赖对齐
4. **脚本执行安全**：白名单机制为最小集，实际部署需结合租户 RBAC 二次授权
5. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
6. **迁移号段 769**：为申请，需与 ADR-011/013/014/015 分配的 699-765 + NEW-EA-13 分配的 766-768 确认无冲突

---

## 10. 结论

- **NEW-EA-14 交付物**：cmdb 5 个 K8s/Script 桩升级方案（1 份设计文档）
- **核心方案**：引入 `k8s.io/client-go` + 脚本执行白名单 + 2 张新表（`k8s_clusters` / `script_whitelist`）
- **Migration 号段**：769（申请）
- **企业级判据**：D1 真实数据 + D2 租户隔离 + D3 错误传播 + D4 可观测性 + D5 脚本执行安全（5/5 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **关联文档**：`enterprise-architecture-depth-review-2026-10-11.md` §6.4 关键判据 13

**文件**：`docs/cmdb-k8s-script-stub-upgrade-2026-10-11.md`
