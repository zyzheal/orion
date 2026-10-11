# 自动化升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/{pipeline-engine,pipeline,auto-exec,orchestration,runner,pipeline-executor,execution-mode-engine,auto-recovery,autonomous-pipeline,data-pipeline,alert-pipeline,test-execution-engine}` + 26 自动化相关模块
**基线数据**：`reports/expert-reviews/automation-expert-rereview-2026-10-01.md`（313 行独立复评 28-32%）
**相关报告**：`reports/expert-reviews/automation-expert-review-2026-09-30.md`（v1 25-30%）+ `automation-expert-supplement-2026-10-01.md`（v2 25%）

---

## 1. TL;DR

- **当前完成度**：30%（rereview 中值 28-32%）
- **目标完成度**：62-68%（补齐 StageExecutor artifact handoff + 扩 TaskRunner 到 6 种 + 补 5 硬缺失子域 + 收敛模块拆分）
- **关键改动**：
  1. **P0-1**：StageExecutor 上游 artifact 跨 stage 传播（当前 L503-511 注释自证缺失）
  2. **P0-2**：TaskRunner 从 3 种（shell/docker/sub-pipeline）扩展到 6 种（+ SSH/WinRM/K8s-Exec）
  3. **P0-3**：新增 5 个 API 子域（catalog/combop/customtemplate/profile/scenario）
  4. **P1-1**：模块合并（pipeline-template 与 pipeline-templates 重复、pipeline-version 与 pipeline-versions 重复）
- **不动的部分**：PipelineEngine 3163 行 A 级引擎 + gRPC server + MultiTargetExecutor + Checkpoint/Retry/Parallel 3 层能力

---

## 2. 当前状态（代码实证）

### 2.1 Orion 侧 26 模块（核心 12 个）

| 模块 | 行数 | 备注 |
|------|------|------|
| pipeline-engine | 3163 / 11 文件 | ✅ 核心引擎 A 级 |
| pipeline | 203 | 主模块 |
| runner | 559 | Runner Agent（仅 HTTP） |
| auto-exec | 104 | 自动执行 |
| auto-recovery | 183 | 自动恢复 |
| autonomous-pipeline | 427 | 自治管道 |
| alert-pipeline | 382 | 告警管道 |
| data-pipeline | 125 | 数据管道 |
| pipeline-executor | 312 | 执行器 |
| test-execution-engine | 108 | 测试执行 |
| execution-mode-engine | — | 执行模式引擎 |
| saga | — | Saga 编排 |
| **合计 12 模块** | **6964 行 / 107 endpoints** | — |

### 2.2 关键实证

- StageExecutor L503-511 注释："Upstream task outputs are not yet propagated to dependent stages"
- TaskRunner switch 分支只有 3 种：`executeShellTask` / `executeDockerTask` / `executeSubPipelineTask`
- `container_executor.go` 307 行（LocalSpawn + Docker 双策略）
- `multi_target_executor.go` 221 行（fan-out 多目标）
- `grpc/server.go` 204 行（跨服务调度）
- `retry.go` 190 + `checkpoint.go` 125 + `parallel_stage.go` 163 = 478 行

### 2.3 NeatLogic 侧对照

- NeatLogic autoexec：380 + 388 = 768 Java 文件
- API 子域 15 个（catalog/combop/customtemplate/global/job/operation/process/profile/risk/scenario/schedule/script/service/tool/type）
- Orion 硬缺失 5 个：catalog/combop/customtemplate/profile/scenario
- Orion 弱覆盖 3 个：operation(5)/risk(1)/tool(3)
- Orion 相对覆盖 2 个：script(30)/type(72)

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | StageExecutor 上游 artifact 传播 | **G0** | L503-511 自证缺失 |
| G0-2 | TaskRunner 只有 3 种 | **G0** | 缺 SSH/WinRM/K8s-Exec |
| G0-3 | catalog 子域（服务目录） | **G0** | NeatLogic 有，Orion 全 0 命中 |
| G0-4 | scenario 子域（场景管理） | **G0** | 全 0 命中 |
| G0-5 | profile 子域（配置模板） | **G0** | 全 0 命中 |
| G0-6 | combop / customtemplate 子域 | **G0** | 全 0 命中 |
| G1-1 | Runner Agent 仅 Linux/Node.js | **G1** | 缺 Windows/AIX |
| G1-2 | pipeline-engine handler 只有 6 endpoints | **G1** | 对比 15 子域 |
| G2-1 | 模块拆分重复 | **G2** | pipeline-template vs templates, pipeline-version vs versions |
| G2-2 | 弱覆盖子域（operation/risk/tool） | **G2** | 零星变量名非子域 |
| G3-1 | 安全审批（变更单/双人复核） | **G3** | 未发现实证代码 |

---

## 4. 升级目标

### 4.1 架构层

- **StageExecutor artifact 传播**：
  - 新增 `pipeline_tasks.result` 表列持久化 task 输出
  - StageExecutor 依赖任务 outputs 反查前驱 stage 的 task result
  - 引入 `ArtifactBus`（内部总线）解耦上下游
- **TaskRunner 扩展**：
  - 新增 `executeSSHTask`（`golang.org/x/crypto/ssh`）
  - 新增 `executeWinRMTask`（`github.com/masterzen/winrm`）
  - 新增 `executeK8sExecTask`（`k8s.io/client-go` + SPDY exec）
  - 保留现有 shell/docker/sub-pipeline 3 种
- **5 新子域新增**：
  - `internal/automation-catalog/`：服务目录（服务条目 + 分类）
  - `internal/automation-scenario/`：场景管理（可组合的自动化场景模板）
  - `internal/automation-profile/`：配置模板（可复用变量集）
  - `internal/automation-combop/`：组合操作（多 pipeline 组合）
  - `internal/automation-customtemplate/`：用户自定义模板

### 4.2 数据模型层

新增 Migration 721-728：
- `721_automation_task_results.sql`：task result 表（stage_id/task_id/result_json）
- `722_automation_catalog.sql`：服务目录
- `723_automation_scenarios.sql`：场景模板
- `724_automation_profiles.sql`：配置模板
- `725_automation_combops.sql`：组合操作
- `726_automation_custom_templates.sql`：自定义模板
- `727_automation_runner_types.sql`：Runner 类型注册
- `728_automation_artifact_bus.sql`：Artifact 总线存储

### 4.3 API 层

- `/api/v1/automation/catalog/*`：6 端点
- `/api/v1/automation/scenarios/*`：5 端点
- `/api/v1/automation/profiles/*`：4 端点
- `/api/v1/automation/combops/*`：4 端点
- `/api/v1/automation/custom-templates/*`：4 端点
- pipeline-engine handler 从 6 endpoints 扩展到 12+ endpoints

---

## 5. 依赖链

### 5.1 前置模块

- **Runner Agent**：TaskRunner 扩展依赖 SSH/WinRM/K8s-Exec 库
- **CMDB**：Runner 目标机器关联 CI（见 cmdb-upgrade-design）
- **DevOps**：Pipeline 与 App 绑定（见 devops-upgrade-design）
- **Alert**：告警触发自愈（`alert-pipeline` 已就绪）

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/saga/` | Saga 编排 |
| `internal/queue/` | 任务队列 |
| `internal/audit/` | Pipeline 运行审计 |
| `internal/pipeline-audit-log/` | 已有审计日志 |
| `github.com/masterzen/winrm` | WinRM 库（新引入） |
| `golang.org/x/crypto/ssh` | SSH 库（新引入） |
| `k8s.io/client-go` | K8s SDK（新引入） |

### 5.3 下游消费者

- **DevOps**：CI/CD Pipeline 复用 pipeline-engine
- **Inspection**：巡检触发自愈 Pipeline
- **Alert**：告警自愈通过 autonomous-pipeline

---

## 6. 实施步骤

### 阶段 1：StageExecutor Artifact 传播（G0-1，最高优先级）

1. Migration 721 创建 `pipeline_task_results` 表
2. StageExecutor `executeTask` 完成后写入 result_json
3. `resolveTaskParameters` 462 行增强：从依赖 stage 的 task result 读取变量
4. ArtifactBus：内部 channel 或 PG 表做跨 stage 传递
5. 单元测试：3 stage 流水线，stage1 输出 var1=hello，stage2 引用 `tasks.stage1.var1`

### 阶段 2：TaskRunner 扩展（G0-2）

1. `go.mod` 引入 3 库：`golang.org/x/crypto/ssh`、`github.com/masterzen/winrm`、`k8s.io/client-go`
2. `StageExecutor.go` switch 分支扩展：
   ```go
   case "ssh": return s.executeSSHTask(ctx, task)
   case "winrm": return s.executeWinRMTask(ctx, task)
   case "k8s-exec": return s.executeK8sExecTask(ctx, task)
   ```
3. 3 新 TaskRunner 实现（每种约 200-400 行）
4. Runner 类型注册到 `automation_runner_types` 表

### 阶段 3：5 新 API 子域（G0-3/4/5/6）

按依赖顺序：
1. **automation-catalog**（无前置）
   - Model：CatalogItem/Category
   - Service：CRUD + Search + BindToService
   - Handler：6 端点
2. **automation-profile**（无前置）
   - Model：Profile/Variable/Environment
   - Service：CRUD + Render + Apply
   - Handler：4 端点
3. **automation-scenario**（依赖 profile）
   - Model：Scenario/PipelineRef/ParameterBinding
   - Service：Compose + Execute + SaveAsTemplate
   - Handler：5 端点
4. **automation-combop**（依赖 scenario）
   - Model：CombOp/Sequence/Parallel
   - Service：Build + Execute
   - Handler：4 端点
5. **automation-customtemplate**（无前置）
   - Model：CustomTemplate/TemplateBody
   - Service：CRUD + Validate
   - Handler：4 端点

### 阶段 4：模块合并（G2-1）

1. 分析 `pipeline-template` vs `pipeline-templates` 重复
2. 保留 `pipeline-templates`（复数），合并 `pipeline-template` 独有逻辑
3. 保留 `pipeline-versions`（复数），合并 `pipeline-version` 独有逻辑
4. 迁移脚本：`pipeline-template` 表数据同步到 `pipeline-templates`
5. 删除旧目录（保留 git 历史）

### 阶段 5：Runner Agent 跨平台（G1-1）

1. Runner 二进制：Windows AMD64 + AIX ppc64 交叉编译
2. Runner Agent 服务：Windows 服务化（NSSM 或 sc.exe）
3. Runner 心跳协议：Windows 兼容

### 阶段 6：pipeline-engine handler 扩展（G1-2）

- 从 6 endpoints 扩展到 12+ endpoints：
  - Run/Cancel/Retry/Resume/Suspend
  - GetStages/GetTasks/GetArtifacts
  - Export/Import（模板）
  - Test（试运行）

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# StageExecutor artifact 传播
grep -n "pipeline_task_results\|ArtifactBus\|resolveTaskParameters" internal/pipeline-engine/service/StageExecutor.go

# TaskRunner 6 种
grep -n "executeSSHTask\|executeWinRMTask\|executeK8sExecTask" internal/pipeline-engine/service/StageExecutor.go

# 5 新子域存在
ls internal/automation-catalog/ internal/automation-scenario/ internal/automation-profile/ internal/automation-combop/ internal/automation-customtemplate/

# 依赖库引入
grep -E "winrm|client-go|crypto/ssh" go.mod
```

### 7.2 单元测试

- StageExecutor artifact 跨 stage：5 用例（正常/错误路径/缺失依赖/循环依赖/超时）
- executeSSHTask：4 用例（成功/认证失败/命令超时/权限拒绝）
- executeK8sExecTask：4 用例（成功/namespace 缺失/secret 缺失/命令退出码）
- 5 新子域 CRUD：各 4 用例
- 模块合并：pipeline-templates 数据一致性测试

### 7.3 e2e 验证

1. 定义 3 stage pipeline：stage1 shell 输出 `version=v1.0`，stage2 引用 `$version` 触发 docker 部署
2. 通过 SSH Runner 在一台 Linux 服务器执行 `echo hi`
3. 通过 K8s-Exec 在集群内 pod 执行 `kubectl get pods`
4. 创建 Scenario "部署前检查" 组合 3 个 pipeline
5. 执行 Scenario → 全部成功 → 结果写入 pipeline_task_results

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| StageExecutor artifact 传播破坏现有 pipeline | 中 | 高 | 保留原逻辑，新增 artifact bus 可选路径 |
| SSH/WinRM/K8s-Exec 依赖引入 CVE | 中 | 中 | 版本锁定 + gosec 扫描 |
| 5 新子域过度设计 | 中 | 中 | 从最小可用集开始（catalog+scenario 优先） |
| 模块合并破坏引用方 | 中 | 高 | 双写期 + 灰度切读 |
| Runner 跨平台编译复杂度 | 中 | 中 | CGO 隔离，Windows 用 CGO_ENABLED=0 |

### 8.2 回滚策略

- **Artifact 传播回滚**：ArtifactBus 关闭，StageExecutor 回到原始逻辑
- **TaskRunner 扩展回滚**：3 新 runner 从 switch 移除，保留原有 3 种
- **5 新子域回滚**：删除 `internal/automation-*/` 目录 + `migrate down 728`
- **模块合并回滚**：恢复 `pipeline-template`/`pipeline-version` 目录（保留迁移前快照）

### 8.3 认知边界

- 未量化 StageExecutor 注释中提到的"pipeline_tasks.result"表当前是否已存在（估计已有但列可能不匹配）
- 未验证 WinRM 库在 Windows 服务模式下的行为
- 未评估 5 新子域与现有 pipeline 生态的兼容度
- 未评估模块合并的具体冲突点（重复代码行数需现场分析）

---

**文档编号**：`automation-upgrade-design-2026-10-03.md`
**关联报告**：`automation-expert-rereview-2026-10-01.md` / `cross-review-synthesis-2026-10-03-v4.md`（当前权威）
**交叉依赖**：DevOps（Runner/K8s） / CMDB（目标机器） / Alert（告警自愈） / Inspection（自愈触发）
