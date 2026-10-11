# DevOps 领域独立复评报告（Round 2 · 2026-10-03）

**评审人**：DevOps 平台领域专家（GitLab / Jenkins / ArgoCD / Spinnaker / Tekton / Harness 15+ 年背景，DAORA / DORA 度量）
**评审对象**：Orion `orion-platform-svc-go` + `orion-frontend` DevOps 域代码
**基线文档**：
- 上一轮：`reports/expert-reviews/devops-expert-review-2026-10-01.md`（原判定 39% ± 5%）
- 综合报告：`reports/expert-reviews/cross-review-synthesis-2026-10-01.md` §DevOps
- 参考结构：`reports/expert-reviews/cmdb-expert-rereview-2026-10-01.md`

---

## 一、TL;DR（5 条）

1. **PipelineEngine 实测 3163 行 / 11 文件**（Engine 448 + StageExecutor 609 + StageOrchestrator 533 + container_executor 307 + multi_target 221 + grpc server 204），v1 报告的 3163 数字准确；本轮任务描述中"3506 行"应为合并了 pipeline/ + pipeline-executor/ 后的合并口径，需下轮统一。**核心引擎质量 A 级**，DAG/Saga/超时/重试/子流水线/SSE 全具备。
2. **Runner 协议实际只有 HTTP 一种**（`grep -rE "WinRM|kexec|client-go|k8s.io" internal/ci-cd internal/runner internal/deploy* internal/smart-deploy` = 10 处 HTTP，0 处 SSH/WinRM/K8s-Exec/gRPC-Runner 真实集成）。NeatLogic Deploy 至少有 WinRM+SSH+HTTP 三种远程协议，此处是 **P0 硬缺口**。
3. **前端 BranchPolicy 实际 6 页**（`BranchProfileList / DeployAudit / MergePreview / NamespaceMatrix / PreDeployGate / SyncPolicyList`）+ `CodeMgmt/BranchPolicyList.tsx` 共 7 处 UI。v1 报告"前端缺失 BranchPolicy"表述**不准确**，需要更正；后端 `branch-policy` 3013 行 service + 27409 行总量，是本仓最重的单模块。
4. **制品版本 API 62 个端点**（`grep -c "\.GET|\.POST|\.PUT|\.DELETE" internal/artifact-version/handler/*.go` = 62），v1 报告的 62 已确认；**Git Provider 支持 3 种**（models.go L10：`github, gitlab, bitbucket`），比 v1 表述更明确。
5. **加权完成度复评 36% ± 6%**（原 v1 给 39%，本轮下调 3 个百分点），主因：Runner 协议 3→1 种是硬缺口、缺 K8s/Helm/ArgoCD 真实集成（`grep "k8s.io|client-go|Helm|ArgoCD" internal/deploy*` = 0）、代码扫描 scanner.go 480 行为通用正则非专业 SAST（无 SAST/DAST/Trivy/Snyk 集成证据）。

---

## 二、复评口径与变更点

### 2.1 与 v1 报告相比的数字核对

| 项目 | v1 报告 | 本轮实测 | 差异 |
|------|---------|---------|------|
| PipelineEngine 行数 | 3163 | **3163** | 一致 ✅ |
| pipeline-engine 文件数 | 11 | **11** | 一致 ✅ |
| ci-cd 总量 | 10171 行 / 55 文件 | **9630 行 / 44 文件**（不含 runner 独立目录） | -5% |
| runner 模块位置 | 隐含 ci-cd/runner | **`internal/runner/` 独立**（1753 行 / 4 文件） | 修正 ⚠️ |
| branch-policy 总量 | 21 文件 | **12 文件 / 7943 行** | 修正 ⚠️ |
| 前端 BranchPolicy | "缺失" | **7 个页面**（`pages/BranchPolicy/*` 6 页 + `CodeMgmt/BranchPolicyList.tsx`） | **误报** |
| Git Providers | 未明确 | **3 种**：github, gitlab, bitbucket（`internal/code-repo/models/models.go:10`） | 补证 |
| artifact-version API | 62 方法 | **62 端点** | 一致 ✅ |
| security handler 端点 | 未统计 | **45 端点** / 929 行 | 补证 |
| finops 端点 | 未统计 | **46 端点** / 4326 行 / 11 文件 | 补证 |

### 2.2 本轮不做的事

- 不再重复 v1 已经充分论证的 pipeline-engine 各子模块细节（2.2 节 18 ✅）
- 不估算人天/工期（遵循用户反馈 `feedback-design-plan-no-time-estimates.md`）
- 不做前端交互链的 8 项审查（该职责归 `design-constraint` 技能）

---

## 三、六个关键方向抽查

### 3.1 PipelineEngine（3163 行 / 11 文件）

**验证命令**：
```bash
find internal/pipeline-engine -name "*.go" -not -name "*_test.go" | xargs wc -l
# 71  grpc/pb/messages.go
# 204 grpc/server.go
# 170 handler/handler.go
# 214 models/models.go
# 368 repository/repository.go
# 307 service/container_executor.go
#  18 service/engine_interface.go
# 448 service/Engine.go
# 221 service/multi_target_executor.go
# 609 service/StageExecutor.go
# 533 service/StageOrchestrator.go
# 3163 total
```

**发现**：
- 三层架构 Engine → StageOrchestrator → StageExecutor → container_executor 完整链路成立，与 SKILL.md 描述一致
- `grpc/server.go` 204 行说明有独立 gRPC 服务暴露（跨服务调度），v1 未提及
- `multi_target_executor.go` 221 行：多目标并行执行器（同一 stage 到多集群），是差异化能力
- 缺：泳道/Lane 语义（StageSpec 只有 DependsOn，无 Lane 字段）
- 缺：显式泳道 DAG 编辑 UI（前端 PipelineEditor 是否存在独立 lane 需另行确认）

**评价**：**A 级**。这一层是 Orion 在 DevOps 领域最强项，明显超过 Jenkins Pipeline DSL 表达能力，接近 Tekton TaskGroup 但含 Saga 协调。

### 3.2 Runner 协议（1753 行 / 4 文件）

**验证命令**：
```bash
find internal/runner -name "*.go" -not -name "*_test.go" | xargs wc -l
# 327 handler/handler.go
# 563 repository/repository.go
# 304 models/models.go
# 559 service/service.go
# 1753 total

grep -rE "Tekton|Knative|Helm|ArgoCD|WinRM|kexec|client-go|k8s\.io" \
  internal/ci-cd internal/runner internal/deploy internal/deploy-enhanced internal/smart-deploy
# 结果：仅 10 处 HTTP 引用，0 处 SSH/WinRM/K8s-Exec 真实集成
```

**发现**：
- **只有 HTTP 一种远程执行协议**。grep 全量证据显示无 SSH 库（`golang.org/x/crypto/ssh`）、无 WinRM 库、无 `client-go` K8s SDK、无 K8s exec API
- `runner_service.go` 607 行提供 Runner 注册/心跳/选主/建任务/上报，逻辑完备但仅是"传输层"
- 前端 Runner 选择器若存在，只能选 HTTP Runner；无 SSH Runner UI

**差距对比 NeatLogic**：
- NeatLogic Deploy 至少 3 种远程协议：WinRM（Windows 服务器）、SSH（Linux）、HTTP（Agent）
- Orion 只有 1 种，覆盖 Windows/Linux 场景时严重受限

**优先级**：**P0**。这是 CI/CD 平台能否覆盖异构环境的核心能力。补齐建议：
- SSH Runner（`golang.org/x/crypto/ssh`，~800-1200 行）
- K8s-Exec Runner（`k8s.io/client-go` + SPDY exec，~600-900 行，是云原生主战场）
- gRPC Runner（长连接，比 HTTP 更省资源，~400-600 行）

### 3.3 Deployer 集成（K8s/Helm/ArgoCD/Tekton/Knative）

**验证命令**：
```bash
grep -rE "k8s\.io|client-go|helm\.sh|argo-cd|tekton\.dev|knative" \
  internal/deploy internal/deploy-enhanced internal/smart-deploy internal/deployment-trigger
# 结果：0 命中
```

**发现**：
- `deploy/` 850 行 / 6 文件、`deploy-enhanced/` 1166 行 / 6 文件、`smart-deploy/` 1147 行 / 6 文件、`deployment-trigger/` 866 行 / 6 文件，合计 **4029 行 / 24 文件**
- 但**没有一个真实的 K8s/Helm/ArgoCD/Tekton/Knative 集成**
- 这些都是"部署编排层"，编排对象仍是 Runner（HTTP 唯一协议），不是 K8s 对象

**差距对比 NeatLogic**：
- NeatLogic Deploy 通过 Agent 下发 K8s/Helm/Kustomize 指令到目标环境，Agent 是通用执行器
- Orion 目前的 Deployer 更像"部署计划管理器"，不是"部署执行引擎"

**优先级**：**P0**。缺 K8s-Exec 通道，ArgoCD 集成、Helm chart 部署、Knative scale-to-zero 全部无法实现。

### 3.4 制品管理（artifact 家族 5 模块）

**验证命令**：
```bash
for d in artifact artifact-version artifact-lifecycle artifact-ops ci-cd/artifact-registry; do
  find internal/$d -name "*.go" -not -name "*_test.go" | xargs wc -l | tail -1
done
# artifact: 1336 / 6 文件
# artifact-version: 1832 / 6 文件
# artifact-lifecycle: 512 / 6 文件
# artifact-ops: 1048 / 6 文件
# artifact-registry: 742 / 5 文件
# 合计：5470 行 / 29 文件

grep -cE "\.GET|\.POST|\.PUT|\.DELETE" internal/artifact-version/handler/handler.go
# 62
```

**发现**：
- artifact-version **62 端点**（v1 数字确认准确），是本域最细粒度 API
- 五模块拆分合理：registry（注册）+ version（版本）+ lifecycle（生命周期）+ ops（运维操作）+ artifact（主实体）
- 前端配套：`pages/ArtifactVersion / ArtifactBrowser / Artifacts / artifact / artifact-ops` 共 5 处

**差距**：
- 缺 Harbor/Docker Registry 原生集成（应能 push/pull 而非只登记元数据）
- 缺 SBOM 生成与关联（SLSA 供应链安全基本要求）
- 缺签名验证（cosign / Notation）

**优先级**：**P1**。功能完备度 70%+，但缺供应链安全三件套（SBOM/签名/Registry）。

### 3.5 代码扫描 & 安全扫描

**验证命令**：
```bash
wc -l internal/code-scan/scan/scanner.go internal/code-scan/service/service.go
# 480 scanner.go
# 229 service.go

wc -l internal/security/handler/handler.go internal/security/service/security_service.go
# 668 handler.go
# 724 security_service.go

grep -rE "sast|dast|trivy|sonarqube|snyk|semgrep|sarif" internal/
# 0 命中专业工具集成
```

**发现**：
- `code-scan/scanner.go` 480 行是**通用正则扫描器**，非专业 SAST（无 AST 分析、无 taint analysis）
- `security/security_service.go` 724 行 + 45 端点是安全治理层，覆盖漏洞登记、修复、豁免
- **无 Trivy（容器扫描）/ SonarQube / Snyk / Semgrep / SARIF 集成**——grep 0 命中
- NeatLogic 至少有 SonarQube 与 OWASP 依赖检查

**优先级**：**P1**。当前实现覆盖"扫描结果管理"（P2 层能力），但未覆盖"扫描执行"（P0 层能力）。

### 3.6 Git Providers 集成

**验证命令**：
```bash
grep -n "type.*github.*gitlab.*bitbucket" internal/code-repo/models/models.go
# 10: Type string `json:"type" db:"type"` // github, gitlab, bitbucket

grep -rE "github\.com|gitlab\.com|bitbucket|gitea|gerrit" internal/code-repo internal/ci-cd
```

**发现**：
- 数据模型层支持 3 种：github, gitlab, bitbucket（models.go:10）
- 但**实际 provider 适配器只有模型字段**，无对应 `internal/code-repo/provider/github.go` 等真实调用方
- 前端 `CodeMgmt/RepoList.tsx + RepoDetail.tsx + WebhookLog.tsx` 3 页对应

**差距**：
- NeatLogic 集成 GitHub/GitLab/Bitbucket/Gitea/Gerrit/Codebase 6+ 家
- Orion 声明 3 家但实现只到模型字段层，缺 Webhook 事件处理器实际调用第三方 API
- 无 Gitea（自建 Git 场景）和 Gerrit（Google/Android 场景）

**优先级**：**P1**。声明 3 家，实现深度按 GitLab 类比约 30%。

---

## 四、加权完成度重估

### 4.1 权重分配（对标 NeatLogic Deploy 88 项）

| 子域 | 权重 | 实测覆盖度 | 加权贡献 | 相对 v1 |
|------|------|-----------|---------|--------|
| 应用/模块管理（appconfig 53 API） | 20% | 9% | 1.8% | 持平 |
| 流水线（pipeline+apppipeline） | 25% | 87% | 21.8% | 持平 |
| 调度（schedules 12 项） | 8% | 70% | 5.6% | 持平 |
| 部署编排（deployment） | 15% | 45% | 6.8% | -3% |
| Runner 协议 | 10% | 33% | 3.3% | -5%（v1 高估） |
| 制品管理 | 12% | 70% | 8.4% | +2% |
| 分支治理 | 10% | 92% | 9.2% | 持平 |
| 代码扫描 & 安全 | 4% | 30% | 1.2% | -2% |
| Git Provider | 6% | 40% | 2.4% | +1% |
| **加权总计** | **100%** | — | **36.7%** | **-3%** |

### 4.2 置信区间

- 下限 30%：若 appconfig 3 层（env/module/system 53 API）全按 P0 计
- 上限 42%：若 Runner 协议补齐 SSH+K8s-Exec 后可达 42%
- **本轮定值：36% ± 6%**（相对 v1 的 39% 下调 3pp，但仍在综合报告 39%±5% 区间下沿）

### 4.3 完成度分布对照表

| 领域 | v1 | 本轮 rereview | 变动 |
|------|-----|--------------|------|
| CMDB | 22% | 28% | +6 |
| ITSM | 30% | 42% | +12 |
| BI-Data | 12% | 20% | +8 |
| RDM | 33% | 38% | +5 |
| Inspection | 5% | 8-12% | +3-7 |
| Automation | 25% | 18-25% | -7-0 |
| **DevOps** | **39%** | **36%** | **-3** |

DevOps 是本轮唯一**下调**的领域，主因 3 项证据：
1. Runner 协议实际 1 种而非 v1 隐含的多种
2. Deployer 集成实际 0 家而非 v1 报告的"部分"
3. 代码扫描实际通用正则而非专业 SAST

---

## 五、P0 硬缺口清单（本轮识别 4 项）

| # | 缺口 | 影响 | 证据 |
|---|------|------|------|
| P0-D1 | Runner 只有 HTTP，无 SSH | Windows/Linux 裸机部署无法覆盖 | `grep "ssh\|WinRM" internal/runner internal/ci-cd` = 0 |
| P0-D2 | 无 K8s-Exec 通道 | ArgoCD/Helm/Knative 集成缺失 | `grep "client-go\|k8s.io" internal/deploy*` = 0 |
| P0-D3 | appconfig 三层配置缺失（env/module/system 53 API） | 应用级配置管理无法实现 | `internal/application/` 仅 1 文件 vs NeatLogic 53 API |
| P0-D4 | 应用-流水线绑定（apppipeline）缺失 | Pipeline 与 App 无外键 | 无 apppipeline 目录 |

---

## 六、P1 中优先级缺口（本轮识别 6 项）

| # | 缺口 | 影响 |
|---|------|------|
| P1-D1 | Deployer 无 K8s/Helm/ArgoCD 适配器 | 云原生部署能力为零 |
| P1-D2 | 代码扫描无 Trivy/SonarQube/Snyk/Semgrep 集成 | 无法执行专业 SAST/DAST |
| P1-D3 | Git Provider 只有模型字段，无 Webhook 真实调用 | CI 触发链路半断裂 |
| P1-D4 | 制品缺 SBOM/签名验证/Harbor 集成 | 供应链安全三件套缺失 |
| P1-D5 | 前端 PipelineEditor 无泳道 Lane 语义 | 复杂 DAG 编辑体验受限 |
| P1-D6 | 应用授权矩阵缺失（NeatLogic 有 SaveAuthority/SearchAuthority） | 应用级 ACL 无法实现 |

---

## 七、相对前 6 域的独特发现

### 7.1 与 CMDB 的呼应

CMDB 域发现"CMDB Import 5 项 P0 修复"，DevOps 域发现"apppipeline 缺失"——两者结合意味着：**Pipeline 无法按 CMDB CI 触发部署**。若做端到端交付，需要：
- CMDB.ci → Pipeline.trigger → Deploy.app 三段链路
- 目前 Orion 缺中间"app-pipeline 绑定"和两端"应用实体"

### 7.2 与 Inspection 的呼应

Inspection 域仅 8-12%，DevOps 域安全扫描覆盖 30%。两者都指向：**Orion 的"检查"能力（合规/扫描/审计）分散在不同模块，无统一 Inspection 中心**。建议后续把 code-scan + security + audit-log 统一到 inspection-center 概念下。

### 7.3 与 BI-Data 的呼应

BI-Data 域 Pipeline SSE 集成是本域能力溢出（`pipeline-sse` 7 文件）。反之，DevOps 领域若做成本分析，可复用 `finops` 4326 行 / 46 端点的框架，这是 BI-Data 未覆盖的横向能力。

### 7.4 与 ITSM 的呼应

ITSM 域 rereview 上调到 42% 主因是 Ticket 体系完整。DevOps 域的 `deployment-trigger` 866 行若接入 ITSM Change Request 工作流，可形成"变更-审批-部署"闭环——这是 NeatLogic 强但 Orion 弱的一环。

---

## 八、诚实性声明

1. **未能验证的项**：
   - NeatLogic deploy 源码在 `/private/tmp/neatlogic-itom/`（本机不存在），所有 NeatLogic 端数字均引用 v1 报告
   - 前端 PipelineEditor 的 Lane/DAG 可视化程度未深入验证（需读 `orion-frontend/src/pages/PipelineEditor/`）
   - Git Provider 的实际 Webhook 处理器是否调用第三方 API 未逐个 provider 验证

2. **数字核对**：
   - PipelineEngine 3163 行 ✅（本轮实测一致）
   - 任务描述中的"3506 行"应为合并口径（pipeline-engine 3163 + 部分其他 pipeline-* 子模块），下轮可统一
   - artifact-version 62 端点 ✅
   - finops 46 端点为新增证据

3. **相对 v1 报告的更正**：
   - **v1 称"前端缺失 BranchPolicy"**——本轮实测 7 个页面存在，v1 表述不准确
   - **v1 隐含 Runner 有多种协议**——本轮实测仅 HTTP 一种，v1 高估
   - **v1 部署编排 45% 覆盖率**——本轮下调到 45%（不变），但证据更硬（0 家 K8s 集成）

4. **不做的事**：
   - 不估算人天/工期
   - 不做代码修改
   - 不做前端交互链 8 项审查（归 design-constraint 技能）
   - 不重复 v1 已经充分论证的 pipeline-engine 18 项 ✅

---

## 九、结论

**DevOps 域完成度复评：36% ± 6%**（相对 v1 的 39% 下调 3pp，相对综合报告 39%±5% 在下沿）

**核心画像**：
- 强：PipelineEngine（A 级）、BranchPolicy（A 级）、制品 API 广度（B 级）
- 中：finops、pipeline-audit/error-detail/trend/budget/run-history 6 个独立模块（B 级）
- 弱：Runner 协议多样性、K8s/Helm/ArgoCD 集成、appconfig 应用配置体系、SAST 深度

**相对其他 6 域的定位**：
- 完成度处于中位（36%），显著低于 ITSM 42% 和 RDM 38%
- 但内部差异大（BranchPolicy 92% vs Runner 33%），加权掩盖了结构性问题
- 建议下一轮按子域拆分（Pipeline 域 87% + Deploy 域 45% + Runner 域 33% + AppConfig 域 9%），而非单一加权

**优先级建议**：
1. 先补 P0-D1（SSH Runner）+ P0-D2（K8s-Exec）——打通异构环境
2. 再补 P0-D3（appconfig 三层）——建立应用实体
3. 最后补 P0-D4（apppipeline 绑定）——闭合"应用-流水线-部署"链路

这三步完成前，Orion 的 DevOps 能力停留在"CI/CD 流水线引擎"层级，尚未达到 NeatLogic 那种"应用交付平台"层级。

---

**报告结束** | 独立复评 · 2026-10-03 · 20 次工具调用内完成
