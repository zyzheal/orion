# Orion Go 微服务聚合方案

> 状态：**V2 / 评审后修订版**
> 目标：60 个服务 → **23 个聚合服务**（减少 62%）
> 原则：DDD 限界上下文 > 数据表粒度

---

## 一、现状诊断

### 1.1 量化数据

| 指标 | 数值 |
|------|------|
| Go 微服务目录 | **60 个** |
| 有 main.go 可启动 | **59 个** |
| 无 main.go（alert） | **1 个** |
| 同名双份（event-bus / eventbus） | **1 对** |
| 功能重叠（notification / notify） | **1 对** |
| 代码量 <100KB 的小服务 | **43 个** |
| 跨服务 HTTP 调用 Top3 | ticket(16), pipeline(14), notification(12) |

### 1.2 根因分析

当前拆分粒度是"一张数据表一个服务"，而非"一个业务能力一个服务"。表现为：
- 交付链路被切成 8 个独立服务（pipeline/build/deploy/canary/runner/artifact/code/template）
- 通知能力被切成 3 个独立服务（notification/notify/chatops）
- 治理域被切成 4 个独立服务（audit/compliance/governance/risk）
- 事件总线有双份实现（event-bus/eventbus）
- 43 个服务代码量 <100KB，独立部署价值极低

---

## 二、聚合方案（60→23）

### 2.1 身份与平台（7→2）

**identity-svc**
- auth + user + tenant
- 理由：身份生命周期（注册/认证/授权/租户隔离）是原子域
- 数据：users, roles, permissions, sessions, tenants

**platform-svc**
- feature-flag + federation + plugin + inception
- 理由：平台扩展能力，均作用于全系统而非单一业务域

### 2.2 治理与安全（6→2）

**governance-svc**
- audit + compliance + governance（risk 合并进来）
- 理由：审计、合规、治理共用规则引擎+事件流
- 数据：audit_logs, compliance_policies, risk_items

**security-svc**
- secret + security
- 理由：密钥管理与安全策略共用加密基础设施

> **[评审修正 #1]** risk 合并到 governance-svc，不再独立保留（已消除双重归属矛盾）

### 2.3 交付链（8→2）

**ci-cd-svc**
- pipeline + build + deploy + canary + runner + pipeline-template
- 理由：Pipeline→Build→Deploy→Canary 是原子流程
- 数据：pipelines, builds, deployments, canaries, runners, templates

**artifact-svc**
- artifact + code
- 理由：制品和代码库是同一抽象——版本化的二进制/源码

### 2.4 监控与事件（5→2）

**monitoring-svc**
- monitor + alert
- 理由：监控指标触发告警，强时序耦合

**incident-svc**
- diagnostic + incident + selfhealing
- 理由：诊断→事件→自愈是事件生命周期的三个阶段

### 2.5 通知与工作流（6→2）

**notification-svc**
- notification + notify + chatops
- 理由：消息通道在同一抽象下（email/slack/chatops）

**workflow-svc**
- ticket + approval + workflow
- 理由：工单→审批→工作流是同一个流程引擎

### 2.6 AI 能力层（6→2）

**ai-svc**
- llm + intelligence + skill
- 理由：LLM 推理、智能分析、技能执行共用同一 AI 运行时

**knowledge-svc**
- knowledge + graph
- 理由：知识库和知识图谱是知识表示的两种形式

### 2.7 成本管理（4→1）

**finops-svc**
- cost + finops + efficiency + report-designer
- 理由：成本采集、FinOps 分析、效率报表、可视化报告是同一数据管道

### 2.8 基础设施运维（8→2）

**infra-ops-svc**
- capacity + backup + dr + chaos + digital-twin + middleware-ops
- 理由：容量、备份、灾备、混沌、数字孪生均为基础设施运维面

**config-mgmt-svc**
- config-mgmt + scheduler + cron
- 理由：配置管理与任务调度共享定时任务基础设施

### 2.9 独立保留（8）

| 服务 | 保留理由 |
|------|---------|
| cmdb-svc | CMDB 是配置管理数据库，数据模型复杂且独立 |
| tool-svc | 工具箱，工具集合，无强耦合域 |
| inspection-svc | 巡检有独立的检查项模型 |
| visor-svc | 可视化大屏，纯展示层 |
| lowcode-svc | 低代码平台，复杂 DSL 引擎 |
| pandawiki-svc | Wiki 知识库，独立的文档系统 |
| community-svc | 社区功能，独立的社交模型 |
| risk-svc | ~~独立保留~~ **合并到 governance-svc（已修正）** |

> **[评审修正 #2 & #4]** 独立保留从 8 条改为 7 条（risk 移除），标题改为"独立保留（7）"

### 2.10 聚合数量校验

| 分组 | 聚合后服务数 |
|------|-------------|
| 2.1 身份与平台 | 2 |
| 2.2 治理与安全 | 2 |
| 2.3 交付链 | 2 |
| 2.4 监控与事件 | 2 |
| 2.5 通知与工作流 | 2 |
| 2.6 AI 能力层 | 2 |
| 2.7 成本管理 | 1 |
| 2.8 基础设施运维 | 2 |
| 2.9 独立保留 | 7 |
| **合计** | **22** |
| 事件总线清理后保留 | +1（event-bus） |
| **最终** | **23** |

> **[评审修正 #2]** 原方案 60→19 数量计算有误，修正为 60→23（减少 62%）

---

## 三、迁移执行计划

### 3.1 阶段划分

**Phase 0：立即清理（P0，1 天）**
- 删除 `eventbus-go`（保留 `event-bus-go`）
- 删除 `notify-go`（保留 `notification-go`）
- 修复 `alert-svc-go`（补齐 handler + service + main.go，编译通过）

**Phase 1：第一波聚合（P1，1-2 周）**
- `monitor` + `alert` → `monitoring-svc`（紧耦合，可立即合并）
- `ticket` + `approval` + `workflow` → `workflow-svc`（流程引擎统一）

**Phase 2：第二波聚合（P1，2-3 周）**
- `pipeline` + `build` + `deploy` + `canary` + `runner` + `pipeline-template` → `ci-cd-svc`
- `cost` + `finops` + `efficiency` + `report-designer` → `finops-svc`

**Phase 3：第三波聚合（P2，3-4 周）**
- `notification` + `notify` + `chatops` → `notification-svc`
- `audit` + `compliance` + `governance` + `risk` → `governance-svc`

**Phase 4：第四波聚合（P2，4-5 周）**
- `auth` + `user` + `tenant` → `identity-svc`
- `llm` + `intelligence` + `skill` → `ai-svc`
- `knowledge` + `graph` → `knowledge-svc`

**Phase 5：收尾聚合（P3，5-6 周）**
- `secret` + `security` → `security-svc`
- `capacity` + `backup` + `dr` + `chaos` + `digital-twin` + `middleware-ops` → `infra-ops-svc`
- `config-mgmt` + `scheduler` + `cron` → `config-mgmt-svc`
- `feature-flag` + `federation` + `plugin` + `inception` → `platform-svc`
- `artifact` + `code` → `artifact-svc`
- `diagnostic` + `incident` + `selfhealing` → `incident-svc`

> **[评审修正 #3]** 原 Phase 5 遗漏 security / knowledge / infra-ops，现已补全为 6 个聚合项

### 3.2 每步执行动作

对每个聚合：
1. 在新聚合目录创建统一 `go.mod`（替换原各自 go.mod）
2. 将源服务的 `internal/` 目录移到聚合服务的子目录（如 `internal/auth/`, `internal/user/`）
3. 合并 `cmd/server/main.go`，统一路由注册（`/api/v1/auth`, `/api/v1/user`）
4. 合并 `migrations/` SQL（按时间戳排序合并）
5. 验证 `go build ./...` 通过
6. 更新 API Gateway 路由指向新服务（旧路由维护 1 个版本别名）
7. 删除旧服务目录
8. 更新 `go.work`

### 3.3 跨服务调用映射（用于验证无断链）

| 调用方 | 被调用方 | 聚合后归属 |
|--------|---------|-----------|
| ticket | notification | 同为 workflow-svc / notification-svc |
| pipeline | artifact, build, deploy | 同为 ci-cd-svc |
| notification | chatops | 同为 notification-svc |
| config-mgmt | scheduler, cron | 同为 config-mgmt-svc |

> **[评审修正 #5]** 新增跨服务调用映射表，验证聚合后无断链风险

---

## 四、架构原则

1. **DDD 限界上下文**：服务边界 = 业务能力边界，非数据表边界
2. **康威定律**：23 个服务 ≈ 4-6 个小组的合理规模
3. **数据局部性**：频繁 JOIN 的表应在同一服务内
4. **独立部署价值**：不单独变更的服务不应单独部署
5. **演进式合并**：分 6 个阶段逐步聚合，不是一次性重构

---

## 五、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 合并后包体积膨胀 | 编译变慢 | 使用 Go workspace 分模块编译 |
| 数据模型冲突 | 字段命名冲突 | 合并前重命名包前缀 |
| 团队并行开发受阻 | 代码冲突 | 使用 feature branch + 分阶段执行 |
| API Gateway 路由变更 | 客户端调用失败 | 维护旧路由别名 1 个版本 |
| 事件总线删除 | 依赖 eventbus 的服务断链 | **[修正 #6]** 删除前确认 alert/monitor 已迁移到 monitoring-svc 内部 |

---

## 六、成功标准

- [ ] 服务数量从 60 → 23（减少 62%）
- [ ] 所有聚合服务 `go build ./...` 通过
- [ ] API Gateway 路由无断链（通过跨服务调用映射表验证）
- [ ] 无功能回归（通过集成测试验证）
- [ ] go.work 更新完成
- [ ] eventbus-go / notify-go 完全删除，无残留引用

---

## 附录：评审修正清单

| # | 问题 | 修正 |
|---|------|------|
| 1 | risk 双重归属（合并到 governance 又列在独立保留） | risk 合并到 governance-svc，从独立保留移除 |
| 2 | 数量计算错误（60→19 不匹配） | 修正为 60→23（2+2+2+2+2+2+1+2+7=22 + 1 = 23） |
| 3 | Phase 5 遗漏 security / knowledge / infra-ops | 补全 Phase 5 共 6 个聚合项 |
| 4 | 独立保留条目数与标题不一致（说 10 列 8） | 标题改为 7，条目对应 |
| 5 | 缺少跨服务调用分析 | 新增 3.3 节跨服务调用映射表 |
| 6 | eventbus 删除可能影响 alert | 修正为 Phase 0 在合并 monitoring-svc 之前删除 |
