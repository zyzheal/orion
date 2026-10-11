# DevOps 升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/{ci-cd,runner,deploy,deploy-enhanced,smart-deploy,deployment-trigger,artifact,artifact-version,artifact-lifecycle,artifact-ops,branch-policy,code-repo,code-scan,security,finops,appconfig?,apppipeline?}` + `orion-frontend/src/pages/{BranchPolicy,CodeMgmt,PipelineEditor}`
**基线数据**：`reports/expert-reviews/devops-expert-rereview-2026-10-01.md`（342 行独立复评 36%）
**相关报告**：`reports/expert-reviews/devops-expert-review-2026-09-30.md`（v1 39%）

---

## 1. TL;DR

- **当前完成度**：36%（复评中值 ±6%，v1 39% 略高）
- **目标完成度**：62-68%（补 Runner 多协议 + K8s/Helm/ArgoCD 集成 + AppConfig + apppipeline 绑定 + SAST 深度）
- **关键改动**：
  1. **P0-D1**：Runner 协议扩展（当前仅 HTTP 一种 → 补 SSH + K8s-Exec + gRPC 共 4 种）
  2. **P0-D2**：K8s/Helm/ArgoCD/Tekton/Knative 真实集成（当前 0 家）
  3. **P0-D3**：AppConfig 三层配置体系（env/module/system 53 API）
  4. **P0-D4**：AppPipeline 应用-流水线绑定（Pipeline 与 App 无外键）
  5. **P1-D1**：Deployer 无 K8s/Helm/ArgoCD 适配器（4029 行部署编排层但目标仍为 HTTP Runner）
  6. **P1-D2**：SAST/DAST 集成（scanner.go 480 行通用正则，非专业 SAST）
  7. **P1-D3**：Git Provider 深度集成（3 家模型字段但无 Webhook 真实调用）
  8. **P1-D4**：制品供应链安全三件套（SBOM/签名/Harbor 集成）
  9. **P1-D5**：前端 PipelineEditor 泳道 Lane 语义
- **不动的部分**：PipelineEngine 3163 行 A 级（DAG/Saga/超时/重试/子流水线/SSE 全具备）+ BranchPolicy 7943 行 7 页 UI + 制品 API 62 端点 + Finops 4326 行 46 端点

---

## 2. 当前状态（代码实证）

### 2.1 Orion 侧关键模块

| 模块 | 行数 | 状态 | 备注 |
|------|------|------|------|
| pipeline-engine | 3163 / 11 文件 | ✅ A 级 | Engine 448 + StageExec 609 + StageOrch 533 + container_exec 307 + multi_target 221 + gRPC 204 |
| ci-cd | 9630 / 44 文件 | ✅ | 55 文件 → 44 文件（不含 runner） |
| runner | 1753 / 4 文件 | ⚠️ | 仅 HTTP 一种协议 |
| branch-policy | 7943 / 12 文件 | ✅ A 级 | 3013 行 service + 7 前端页面 |
| deploy + deploy-enhanced + smart-deploy + deployment-trigger | 4029 / 24 文件 | ⚠️ | 编排层完整但无 K8s/Helm 集成 |
| artifact 家族（5 模块） | 5470 / 29 文件 | ⚠️ | artifact-version 62 端点，但缺 SBOM/签名/Harbor |
| code-scan | 480 + 229 | ⚠️ | 通用正则，非专业 SAST |
| security | 929 + 724 / 45 端点 | ✅ | 安全治理层完整 |
| finops | 4326 / 46 端点 | ✅ | 成本分析 |
| code-repo | 6 家模型字段 | ⚠️ | 无真实 Webhook 调用 |
| appconfig | 0 | ❌ | P0-D3 完全缺失 |
| apppipeline | 0 | ❌ | P0-D4 完全缺失 |

### 2.2 关键实证

- Runner 协议 grep：`WinRM|kexec|client-go|k8s.io` → 10 处 HTTP，0 处 SSH/WinRM/K8s-Exec/gRPC
- Deploy 集成 grep：`k8s.io|client-go|helm.sh|argo-cd|tekton.dev|knative` → 0 命中
- Git Providers：`github.com|gitlab.com|bitbucket|gitea|gerrit` → 模型字段仅声明 github/gitlab/bitbucket
- SAST 集成：`sast|dast|trivy|sonarqube|snyk|semgrep|sarif` → 0 命中
- 前端 BranchPolicy 7 页：BranchProfileList / DeployAudit / MergePreview / NamespaceMatrix / PreDeployGate / SyncPolicyList + CodeMgmt/BranchPolicyList.tsx
- Finops 46 端点 4326 行

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | Runner 协议只有 HTTP | **G0** | 缺 SSH/WinRM/K8s-Exec/gRPC |
| G0-2 | Deployer 无 K8s/Helm/ArgoCD 集成 | **G0** | 4029 行编排层但目标仍为 HTTP |
| G0-3 | AppConfig 三层配置体系 | **G0** | env/module/system 53 API 全缺 |
| G0-4 | AppPipeline 应用-流水线绑定 | **G0** | Pipeline 与 App 无外键 |
| G1-1 | SAST/DAST 专业工具集成 | **G1** | scanner.go 通用正则 |
| G1-2 | Git Provider Webhook 真实调用 | **G1** | 3 家模型字段，无 Webhook 处理器 |
| G1-3 | 制品 SBOM/签名/Harbor | **G1** | 供应链安全三件套缺失 |
| G1-4 | 前端 PipelineEditor 泳道 Lane 语义 | **G1** | StageSpec 只有 DependsOn，无 Lane 字段 |
| G1-5 | 应用授权矩阵 | **G1** | NeatLogic 有 SaveAuthority/SearchAuthority |
| G2-1 | Gitea/Gerrit 支持 | **G2** | 自建 Git 场景缺失 |
| G2-2 | 泳道 DAG 编辑 UI | **G2** | 复杂 DAG 编辑受限 |

---

## 4. 升级目标

### 4.1 架构层

- **Runner 多协议支持**：
  - SSH Runner：`golang.org/x/crypto/ssh`（Linux/Windows 通用）
  - K8s-Exec Runner：`k8s.io/client-go` + SPDY exec（云原生主战场）
  - WinRM Runner：`github.com/masterzen/winrm`（Windows 专用）
  - gRPC Runner：长连接（比 HTTP 更省资源）
- **K8s/Helm/ArgoCD 集成**：
  - `internal/k8s-client/` 新模块：封装 client-go
  - `internal/helm-client/` 新模块：封装 helm SDK
  - `internal/argocd-client/` 新模块：封装 ArgoCD REST API
  - `internal/tekton-client/` 新模块：Tekton Pipeline CRD
  - `internal/knative-client/` 新模块：Knative Service CRD
- **AppConfig 三层体系**：
  - env 层：环境级配置（dev/staging/prod）
  - module 层：模块级配置
  - system 层：系统级配置
  - 三层配置覆盖与合并规则
- **AppPipeline 绑定**：
  - `internal/apppipeline/` 新模块
  - Application 表增加 pipeline_id 外键
  - Pipeline 表增加 application_id 外键
  - 双向关联 + 触发条件

### 4.2 数据模型层（Migration 755-765）

- `755_devops_runner_types.sql`：Runner 类型注册表
- `756_devops_runner_credentials.sql`：Runner 凭据（加密存储）
- `757_devops_appconfig.sql`：AppConfig 三层配置主表
- `758_devops_appconfig_env.sql`：环境配置
- `759_devops_appconfig_module.sql`：模块配置
- `760_devops_appconfig_system.sql`：系统配置
- `761_devops_apppipeline.sql`：App-Pipeline 绑定表
- `762_devops_pipeline_applications.sql`：Pipeline-App 反向关联
- `763_devops_artifact_sbom.sql`：SBOM 元数据
- `764_devops_artifact_signatures.sql`：制品签名
- `765_devops_git_providers.sql`：Git Provider 扩展（含 Webhook secret）

### 4.3 API 层

- `/api/v1/runner/types/*`：Runner 类型管理 3 端点
- `/api/v1/runner/credentials/*`：Runner 凭据 CRUD 5 端点
- `/api/v1/appconfig/envs/*`：环境配置 CRUD 6 端点
- `/api/v1/appconfig/modules/*`：模块配置 CRUD 5 端点
- `/api/v1/appconfig/system/*`：系统配置 CRUD 4 端点
- `/api/v1/appconfig/merge/*`：配置合并预览 2 端点
- `/api/v1/apppipeline/*`：App-Pipeline 绑定 CRUD 6 端点
- `/api/v1/apppipeline/trigger/*`：触发条件配置 3 端点
- `/api/v1/artifacts/{id}/sbom`：SBOM 生成 + 查询
- `/api/v1/artifacts/{id}/signature`：签名生成 + 验证

---

## 5. 依赖链

### 5.1 前置模块

- **CMDB**：Runner 目标机器关联 CI（见 cmdb-upgrade-design）
- **Automation**：TaskRunner 扩展（见 automation-upgrade-design，SSH/K8s-Exec 复用）
- **ITSM**：Deployment-Trigger 触发 ITSM Change Request

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/pipeline-engine/` | 流水线执行（A 级保留） |
| `internal/runner/` | Runner Agent 改造为多协议 |
| `internal/security/` (929+724) | 安全治理层 |
| `internal/audit/` | 变更审计 |
| `internal/approval/` | 部署审批 |
| `internal/finops/` (4326) | 成本分析复用 |
| `golang.org/x/crypto/ssh` | SSH 库（新引入） |
| `k8s.io/client-go` | K8s SDK（新引入） |
| `helm.sh/helm/v3/pkg/chart` | Helm SDK（新引入） |
| `github.com/spf13/viper` | 配置管理（新引入或替换） |
| `github.com/aquasecurity/trivy` | 容器扫描（可选引入） |

### 5.3 下游消费者

- **ITSM**：Deployment-Trigger → Change Request
- **Automation**：TaskRunner 复用 SSH/K8s-Exec
- **Alert**：部署告警
- **BI**：部署成功率报表

---

## 6. 实施步骤

### 阶段 1：Runner 多协议（P0-D1，最高优先级）

1. Migration 755-756
2. Runner 类型注册表：`{http, ssh, k8s-exec, winrm, grpc}`
3. Runner Agent 二进制：多平台交叉编译
4. `runner/service/` 增加：
   - `CreateSSHRunner` / `CreateK8sExecRunner` / `CreateWinRMRunner` / `CreateGRPCRunner`
5. 与 `internal/pipeline-engine/service/StageExecutor.go` 集成（复用 automation-upgrade-design 的 TaskRunner 扩展）
6. 单元测试：4 种 Runner 各 3 用例

### 阶段 2：K8s/Helm/ArgoCD 集成（P0-D2）

1. `go.mod` 引入 5 库
2. 新建 5 个 client 模块：
   - `internal/k8s-client/`：封装 client-go，暴露 List/Create/Delete/Patch Pod/Deployment
   - `internal/helm-client/`：封装 helm SDK，Install/Upgrade/Rollback
   - `internal/argocd-client/`：ArgoCD REST API，AppCreate/Sync/Rollback
   - `internal/tekton-client/`：Tekton Pipeline CRD，Create/Run/GetStatus
   - `internal/knative-client/`：Knative Service CRD
3. `deploy/service/` 增加 Adapter 层：
   - `Adapter` 接口：`Apply(ctx, target, manifest) (status, error)`
   - K8sAdapter / HelmAdapter / ArgoCDAdapter / TektonAdapter / KnativeAdapter
4. `smart-deploy/service/` 改造：根据 target.Type 分派到对应 Adapter

### 阶段 3：AppConfig 三层体系（P0-D3）

1. Migration 757-760
2. `internal/appconfig/` 新建：
   - Models：EnvConfig / ModuleConfig / SystemConfig / MergeResult
   - Service：EnvService / ModuleService / SystemService / MergeService
   - Handler：17 端点
3. 配置合并规则：env > module > system
4. 与 `pipeline-engine` 集成：Pipeline 运行时读取 AppConfig 值
5. 与 `deployment-trigger` 集成：部署前配置校验

### 阶段 4：AppPipeline 绑定（P0-D4）

1. Migration 761-762
2. `internal/apppipeline/` 新建：
   - Models：AppPipelineBinding / TriggerCondition
   - Service：Bind/Unbind/GetByApp/GetByPipeline/ConfigureTrigger
   - Handler：9 端点
3. 与 `pipeline-engine` 集成：Pipeline 启动前查绑定关系
4. 与 `deployment-trigger` 集成：Git Push → 触发绑定 Pipeline

### 阶段 5：SAST/DAST 集成（P1-D2）

1. `go.mod` 引入 `github.com/aquasecurity/trivy` + `github.com/stackrox/rox`（SARIF 解析）
2. `code-scan/scanner.go` 480 行保留（作为 fallback）
3. 新增 `code-scan/sast/`：
   - SemgrepAdapter / SnykAdapter / SonarQubeAdapter
   - 统一 SARIF 格式
4. Handler 新增 `/scan/sast` `/scan/dast` 端点
5. 与 `security/security_service.go` 集成：SAST 结果入漏洞登记

### 阶段 6：Git Provider 深度集成（P1-D3）

1. Migration 765：Git Providers 表扩展（含 Webhook secret + endpoint 配置）
2. `internal/code-repo/provider/` 新建：
   - `github.go`：GitHub API 客户端
   - `gitlab.go`：GitLab API 客户端
   - `bitbucket.go`：Bitbucket API 客户端
   - `gitea.go`：Gitea（自建 Git 场景）
   - `gerrit.go`：Gerrit（Google/Android 场景）
3. Webhook 处理器：
   - `internal/code-repo/webhook/`
   - Push/MR/PR/Review 事件处理
4. 与 `deployment-trigger` 集成：Webhook 触发 Pipeline

### 阶段 7：制品供应链安全（P1-D4）

1. Migration 763-764
2. SBOM 生成：
   - `internal/artifact/sbom/`：syft 库集成（软件物料清单）
   - 支持 SPDX 与 CycloneDX 两种格式
3. 签名验证：
   - `internal/artifact/signature/`：cosign 集成
   - 支持 Notation 签名格式
4. Harbor 集成：
   - `internal/artifact-registry/harbor/`：Harbor REST API 客户端
   - push/pull/scan 操作
5. Handler 新增 SBOM/签名/Harbor 端点

### 阶段 8：前端 PipelineEditor 泳道（P1-D5）

1. `StageSpec` 增加 `Lane string` 字段
2. Migration 修改现有 pipeline stages 表
3. 前端 `PipelineEditor`：
   - 引入 `reactflow` 或 `jointjs` 泳道编辑
   - Stage 支持拖入不同 Lane
   - Lane 内 Stage 顺序执行，Lane 间并行执行

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# Runner 多协议
grep -rn "CreateSSHRunner\|CreateK8sExecRunner\|CreateWinRMRunner\|CreateGRPCRunner" internal/runner/
# 期望：>10 命中

# K8s/Helm 集成
grep -E "client-go|helm\.sh" go.mod
ls internal/k8s-client/ internal/helm-client/ internal/argocd-client/

# AppConfig 模块存在
ls internal/appconfig/
grep -rn "internal/appconfig" main.go cmd/server/main.go
# 期望：>3 命中

# AppPipeline 模块
ls internal/apppipeline/

# SAST 集成
grep -E "trivy|semgrep|sarif" go.mod
ls internal/code-scan/sast/
```

### 7.2 单元测试

- SSH Runner：4 用例
- K8s-Exec Runner：4 用例
- WinRM Runner：3 用例
- AppConfig 合并规则：5 用例
- AppPipeline 绑定：4 用例
- K8s Adapter Apply：4 用例
- SBOM 生成：3 用例
- Webhook 事件处理：4 用例

### 7.3 e2e 验证

1. 创建 AppConfig（env=prod, module=web, system=base）
2. 创建 Pipeline "deploy-web"
3. 创建 App "web-service"，绑定到 deploy-web Pipeline
4. Git Push → Webhook → 触发 deploy-web
5. Pipeline 读取 AppConfig（合并后的配置）
6. 部署目标：K8s 集群 → 应用 Helm chart
7. 部署完成后生成 SBOM + 签名
8. 推送到 Harbor Registry

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Runner 多协议依赖库 CVE 多 | 高 | 中 | 版本锁定 + gosec 扫描 + 依赖审计 |
| K8s/Helm/ArgoCD 集成测试复杂 | 高 | 高 | Kind + Minikube 集成测试环境 |
| AppConfig 三层合并逻辑复杂 | 中 | 高 | 明确合并规则文档 + 单测覆盖 |
| AppPipeline 与现有 Pipeline 数据不兼容 | 中 | 中 | 新增外键可空，历史数据不迁移 |
| SAST 工具集成后性能下降 | 中 | 中 | 异步扫描 + 结果缓存 |
| 前端 PipelineEditor 泳道 UI 复杂 | 中 | 中 | 分阶段：先显示后编辑 |
| 5 家 Git Provider 维护成本 | 中 | 低 | Adapter 接口统一，新增 provider 只需实现接口 |

### 8.2 回滚策略

- **Runner 多协议回滚**：新 Runner 类型从 Registry 移除，保留 HTTP 默认
- **K8s/Helm 集成回滚**：Adapter 层可切换为 HTTP 模式（保留降级）
- **AppConfig 回滚**：新表保留但代码不读，Pipeline 用旧配置
- **AppPipeline 回滚**：绑定关系可空，删除绑定表不影响 Pipeline 运行
- **SAST 集成回滚**：sast/ 目录删除，scanner.go 保留 fallback
- **Git Provider 深度回滚**：Webhook 处理器禁用，保留模型字段

### 8.3 认知边界

- 未量化 K8s/Helm/ArgoCD/Tekton/Knative 5 家的具体集成成本
- 未评估 AppConfig 三层体系与现有部署配置的兼容性
- 未验证 SBOM 生成工具（syft）的中文路径兼容性
- 未评估 5 家 Git Provider Webhook 事件的具体字段
- 未评估前端 PipelineEditor 泳道 UI 的具体交互（本设计仅覆盖后端与最小前端需求）

---

**文档编号**：`devops-upgrade-design-2026-10-03.md`
**关联报告**：`devops-expert-rereview-2026-10-01.md` / `cross-review-synthesis-2026-10-03-v4.md`（当前权威）
**交叉依赖**：Automation（TaskRunner 复用） / CMDB（Runner 目标机器） / ITSM（Change Request） / Alert（部署告警）
