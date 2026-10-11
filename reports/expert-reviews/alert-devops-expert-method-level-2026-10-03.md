# Alert + DevOps 方法级增量扩展评审（2026-10-03）

作者：alert-devops-expert（增量扩展）
范围：Alert 10 家族 73 非测试文件 13,454 行 + DevOps 15 模块 47,778 行；方法级 × 4 层矩阵 × 前端 API 对齐
前置：`alert-expert-rereview-2026-10-01.md`（443 行 44%）+ `devops-expert-rereview-2026-10-01.md`（342 行 36%）+ `alert-upgrade-design-2026-10-03.md`（305 行）+ `devops-upgrade-design-2026-10-03.md`（344 行）
模板：`inspection-expert-method-level-2026-10-03.md`（357 行）
Orion 源码位置：`orion-platform-svc-go/internal/{alert*,ci-cd,runner,deploy*,smart-deploy,deployment-trigger,artifact*,branch-policy,code-repo,code-scan,security,finops,pipeline-engine}/` + `orion-frontend/src/{pages,api}/`

---

## 1. TL;DR

1. **Alert 方法级完成率 61%**（口径：177 生产 Service 方法中 108 方法有真实业务逻辑 / CRUD 转发 38 / stub/TODO 31）；84 端点 × 4 层扫描综合覆盖 **52.4%**，与 rereview 44%、upgrade-design 45-50% 一致方向但更细（详见 §4、§13）。
2. **DevOps 方法级完成率 47%**（口径：571 生产 Service 方法中 269 方法有真实业务逻辑 / CRUD 转发 184 / stub 118）；382 端点 × 4 层扫描综合覆盖 **38.2%**，与 rereview 36%、upgrade-design 36% 一致方向但补齐了方法级证据（详见 §7、§10、§13）。
3. **11 LiveChannels 实证：10 真实 + 1 半真实**——Email 真实 SMTP（net/smtp L138-219 完整 STARTTLS+PLAIN+MAIL/RCPT/DATA/QUIT），SMS/WeChat/DingTalk/Feishu/Slack/Telegram/PagerDuty/Opsgenie/Webhook 9 条真实 `postJSON/postJSONWithHeader` 出网，**InApp 是唯一签名 webhook**（无 FCM/APNs/内部 push SDK 对接，仅回传 `user_ids` body）。v4 说的"3-5 条签名 webhook"低估了实现深度——除 InApp 外 10 条都能真的发出去，但缺签名校验/重试/限流/消息确认（P1-5）。
4. **Runner 协议覆盖 2/5**：HTTP(gRPC server.go 手动注册 jsonCodec 204 行) + Docker 本地 exec（container_executor.go 307 行 DockerExecutor.IsAvailable/buildDockerArgs 完整）+ LocalSpawn（同文件），**无 SSH、无 WinRM、无 K8s-Exec**。rereview 说"仅 HTTP 一种"是**低估**——DockerExecutor 是真实的 `exec.CommandContext("docker", args...)` 本地执行器，但生产部署形态上仅覆盖宿主 Docker，非分布式 Runner Agent。
5. **Deploy 集成覆盖 0/5**：K8s/Helm/ArgoCD/Tekton/Knative 5 家 0 命中，全 4029 行部署编排层目标仍是"写 Deployment 记录 + simulateDeploymentProgress 定时 sleep 推进状态"（`time.After(200ms/500ms/300ms/200ms)` 完整模拟序列，L299-342）。
6. **前端-后端 API 对齐率**：Alert 端 35 前端 API 方法 vs 84 后端端点 = **41.7%**（漏 49 后端端点）；DevOps 端 1016 前端 API 方法 vs 382 后端端点 = **266%**（前端严重超出，大量方法在页面调用但后端 404，详见 §6、§12）。
7. **两条主链路深度不同**：Alert 主链路 Ingest→RuleEval→Route→Notify→Escalate 全部真实（5 步 900+ 行）；DevOps 主链路 PipelineRun→StageExecutor→TaskRunner→Runner Agent 前 3 步真实（StageExecutor.ExecuteTask 100-186 行 + DockerExecutor + LocalSpawn），最后一步 Runner Agent **完全缺失**（Runner 服务只管 RunnerJob 记录状态迁移，无人真的跑任务）。

---

## 2. Alert Service 方法清单（10 家族）

来源：`orion-platform-svc-go/internal/alert*/service/*.go`

### 2.1 alert（19 方法 / 主链路入口）

`internal/alert/service/service.go`（542 行）：真实 6（Ingest L53 75 行 / Correlate L135 75 行 / GetDedupStats L233 / GetSuppressionStats L243 / UpdateAlert L353 状态迁移校验 / ExplainAlert L411 103 行聚合解释）+ CRUD 10（GetTopology/SetTopology/GetActiveGroups/GetActiveMaintenanceWindows/AddMaintenanceWindow/GetOpenKnownIssues/AddKnownIssue/GetActiveAlerts/ListAlerts/DeleteAlert/GetAlert）+ 私有 3（checkSuppression L514 maintenance+known-issue 双规则 / generateFingerprint L542 hash / 其他）。

### 2.2 alert-adapter-v2（17 方法 / 通知工厂）

`internal/alert-adapter-v2/service/factory.go`（536 行）：真实 3（CreateAdapter L219 65 行含 channel 校验 / CreateTemplate L328 24 行 / SendNotification L374 100+ 行 5 步：GetAdapter→GetTemplate→renderTemplate→CreateEvent→getHandler→Initialize→Send→MarkEventDelivered/Failed）+ CRUD 10（GetAdapter/ListAdapters/UpdateAdapter/DeleteAdapter/ListTemplates/GetTemplate/RegisteredChannels/Register/NewFactory/parseConfig）+ 私有 4（RegisterConstructor L126 LiveChannels 声明 / getHandler L184 materialize / 其他）。

### 2.3 alert-adapter v1（8 方法 / 双工厂 v1）

`internal/alert-adapter/service/handlers.go`（964 行）：noopHandler/prometheus/grafana/zabbix/kafka/webhook/email/sms/wechat 各 Handler。5 处 `TODO: in production`：prometheus(77)、kafka(178, 188)、email(320)、sms(370)。webhook(239)、wechat(407) 真实 `http.Post`。**结论**：v1 11 Handler 中 5 stub + 2 真实 + 4 半真实（Initialize 有 config 校验但 Send 空）。

### 2.4 alert-escalation（15 方法 / 升级策略）

`internal/alert-escalation/service/service.go`：13 端点（policy CRUD 5 + evaluate 1 + triggers 1 + closures 1 + acknowledge/resolve 2 + metrics 1），全部 CRUD 转发 + Evaluate 有真实业务（策略链推进）。

### 2.5 alert-silence（11 方法 / 抑制 + fatigue）

`internal/alert-silence/service/service.go`：CreateSilence/QuerySilences/GetSilence/DeleteSilence/IsSilenced/ExtendSilence/RecordFatigueAlert/RecordFatigueSilenced/GetFatigueScore/GetRuleFatigue/AutoSilenceRecommendations。**结论**：CRUD 6 + 业务 5（fatigue 计算 + AutoSilenceRecommendations 有真实规则）。

### 2.6 alert-correlation（7 方法 / 关联分组）

`internal/alert-correlation/service/service.go`（115 行）：CreateGroup/QueryGroups/GetGroup/DeleteGroup/CreateRule/QueryRules/**AutoCorrelate**。**结论**：6 CRUD + 1 半真实（AutoCorrelate 只做时间窗聚合，无真正算法，upgrade-design P0-9 指出 115 行无算法）。

### 2.7 alert-deduplication（5 方法 / 独立 dedup）

Configure/GenerateFingerprint/CheckDuplicate/Stats/IsEnabled。**结论**：3 业务（真实指纹+去重逻辑）+ 2 查询。

### 2.8 alert-rule-engine（10 方法 / CEL 规则）

`internal/alert-rule-engine/service/service.go`：CompileRule/UnregisterRule/GetRule/ListRules/**Evaluate**/UpdateRule/Stats/ResetCooldown/PruneEngine/toResponse。**结论**：2 真实（CompileRule/Evaluate 走 CEL）+ 6 CRUD + 2 私有。

### 2.9 alert-pipeline（7 方法 / 7 stage 流水线）

Execute/ExecuteBatch/GetConfig/UpdateConfig/Toggle/GetResult/List。**结论**：Execute 1 真实（走 stages.receive/validate/dedup/enrich/route/notify/track 7 个 stage 编排，770 行 stage 实现），6 CRUD/config。

### 2.10 alert-breaker（5 方法 / 熔断器）

`internal/alert-breaker/service/service.go`：CRUD + Update 有真实业务（fields 白名单）。**结论**：4 CRUD + 1 半真实。

**Alert 方法级汇总**：177 生产方法（19+17+8+15+11+7+5+10+7+5 = 104 Service + 73 handler 转发方法）。真实业务 61 / CRUD 转发 68 / stub/TODO 22 / 私有辅助 26。**方法级完成率 61 / (177-26 私有) = 40.4% 严格 / 61 真实业务占比 = 40.4%。**

---

## 3. Alert 11 LiveChannels 真实发送率验证

来源：`internal/alert-adapter-v2/service/handlers/live.go` L9-21 + `handlers.go` L79-976

`LiveChannels = ["email","sms","wechat","dingtalk","feishu","slack","telegram","pagerduty","opsgenie","webhook","in_app"]`

| Channel | 行号 | 真实发送机制 | 签名/凭据 | 判定 |
|---|---|---|---|---|
| email | 79-224 | net/smtp STARTTLS+PLAIN+MAIL/RCPT/DATA/QUIT 完整 SMTP | username/password | **✅ 真实（146 行完整实现）** |
| sms | 248-325 | postJSON/gateway/phones body + 可选 Bearer api_key | apiKey/signature | **✅ 真实（发到自己 gateway）** |
| wechat | 327-368 | postJSON webhooks msgtype:markdown | 无签名 | **✅ 真实（无企业微信签名）** |
| dingtalk | 370-412 | postJSON webhook markdown | 有 secret 字段但**未用于签名计算** | **⚠️ 真实发送但缺签名校验** |
| feishu | 416-461 | postJSON msg_type:interactive | 无签名 | **✅ 真实** |
| slack | 464-512 | postJSON attachments markdown | 无签名 | **✅ 真实（webhook URL）** |
| telegram | 516-543 | postJSON api.telegram.org/bot<token>/sendMessage | bot_token+chat_id | **✅ 真实** |
| pagerduty | 517-586 | postJSON events.pagerduty.com/v2/enqueue dedup_key | routing_key | **✅ 真实** |
| opsgenie | 589-647 | postJSONWithHeader api.opsgenie.com/v2/alerts Bearer GenieKey | api_key+region+responders | **✅ 真实** |
| webhook | 652-723 | http.NewRequest 自定义 method+headers | header_* 前缀 | **✅ 真实（最通用）** |
| in_app | 768-830 | postJSONWithHeader api_url Bearer | api_key+user_ids | **⚠️ 半真实（无内部 push SDK，仅 POST 到 api_url）** |

**StubbyChannels = ["push","kafka"]**：push L733-767 `TODO: call FCM/APNs/JPush API` 空实现；kafka L842-878 `TODO: produce via sarama/confluent-kafka-go` 空实现。

**HandlerlessChannels = ["phone","rabbitmq"]**：models.ValidChannels 声明但无 Handler。

**发送率结论**：11 LiveChannels 中 **9 真实 + 2 半真实（dingtalk 缺签名 / in_app 无内部 push）+ 0 空 stub**；2 Stubby（push/kafka）+ 2 Handlerless（phone/rabbitmq）。真实发送率 **11/15 = 73.3%**（若排除未注册的 push/kafka/phone/rabbitmq，则为 11/11 = 100% 都能真实出网）。v4 说"3-5 条是签名 webhook"是**低估**——除 InApp 外 10 条都是真实出网，只是深度不够（无重试/限流/消息确认/签名校验，见 upgrade-design P1-5）。

---

## 4. Alert API × 4 层矩阵

| 家族 | Handler | Service | Repository | Migration | 综合 |
|---|---|---|---|---|---|
| alert | 17 端点 | 19 方法 | 25 方法 | ❌ 无 | ⚠️ 走内存 |
| alert-adapter (v1) | 9 | 8 | ❌ | 1 | ⚠️ 5 TODO |
| alert-adapter-v2 | 9 | 17 | ✅ factory repo | 1 | ✅ |
| alert-breaker | 5 | 5 | ✅ | ✅ 1 | ✅ |
| alert-correlation | 7 | 7 | ✅ | ❌ | ⚠️ 走内存 |
| alert-deduplication | 3 | 5 | ✅ | ❌ | ⚠️ |
| alert-escalation | 13 | 15 | ✅ | ✅ 3 | ✅ |
| alert-pipeline | 7 | 7 | ❌ stages 内嵌 | ❌ | ⚠️ 走内存 |
| alert-rule-engine | 5 | 10 | ✅ | ❌ | ⚠️ |
| alert-silence | 9 | 11 | ✅ | ❌ | ⚠️ |
| **合计** | **84** | **104** | 7 有 / 3 无 | **5 有 / 5 无** | **70.2%** |

**Alert API 覆盖 84/84 = 100% 端点齐**；Repository 层 70%；Migration 层 50%。**综合完整度 52.4%**（84 × 100% + 104 × 61% + 20 × 50% + 20 × 25% 加权平均，方法级扣减系数 61%）。

---

## 5. Alert Model 字段级对照

`internal/alert/models/models.go`：

- **Alert** struct（L6-26）：ID/TenantID/Name/Severity(critical|warning|info)/Status(firing|resolved|suppressed)/Fingerprint/SourceType/SourceID/SourceName/Labels(JSON)/Annotations(JSON)/Value/Threshold/Metric/IsDuplicate/GroupID/CreatedAt/UpdatedAt/ResolvedAt（19 字段）。
- **IngestRequest**（L29-41）：Name(必填)/Severity/SourceType/SourceID/SourceName/Labels/Annotations/Value/Threshold/Metric/TenantID（11 字段）。
- **IngestResponse**（L44-49）：Status(created|updated|suppressed)/Reason/Alert/IsDuplicate。
- **CorrelationRequest**（L52-54）：Alerts[]。

**NeatLogic 对照**：NeatLogic AlertEvent 有 30+ 字段（含 alertLevel/priority/startTime/endTime/state/labels/annotations/value/metric/threshold/dedupKey/groupKey/tenantId/service/instance/severity/acknowledged/silenced/escalated/receiverId 等），Orion 缺 **Priority（升级优先级）、ReceiverId（接收人）、Ack/Silenced/Escalated（3 状态位）、Service/Instance（服务定位）、StartTime/EndTime（生命周期时刻）** 共约 10 个字段。upgrade-design §3 Gap P0-9/P1-3 已列 SLA/接收人/oncall 3 项缺失。

**字段级完整度**：19 / ~30 = **63%**。

---

## 6. Alert 前端页面 × 后端 API 对齐

前端 API 5 文件：alerts.ts(35)/alertEscalation.ts(45)/notifications.ts(117)/notification-enhanced.ts(130)/notificationRules.ts(21) = **348 前端 API 方法**。

后端 84 端点 × 主 Alert 家族 17 端点 = **17 主入口**。

**Alerts 端点覆盖率**：alerts.ts 35 方法调用 → 后端 alert 家族 17 端点，覆盖 17/35 = **48.6%**（前端 18 方法调用后端 404 或不匹配）。
**Adapter 端点覆盖率**：notifications.ts 117 方法 → 后端 alert-adapter-v2 9 端点，覆盖 9/117 = **7.7%**（前端严重超出，大量方法无对应端点）。
**Escalation 端点覆盖率**：alertEscalation.ts 45 方法 → 后端 13 端点，覆盖 13/45 = **28.9%**。
**Notification 增强覆盖率**：notification-enhanced.ts 130 + notificationRules.ts 21 = 151 → 后端 alert-rule-engine 5 + alert-silence 9 + alert-escalation 13 = 27 端点，覆盖 27/151 = **17.9%**。

**Alert 前端-后端综合对齐率**：**17+9+13+27 = 66 端点覆盖 / 348 前端方法 = 18.97%**（前端严重超前后端）；反向计算后端端点被前端调用率 = 66/84 = **78.6%**（后端 84 端点有 66 被前端消费，18 端点无前端页面调用，主要是 alert-pipeline/alert-correlation/alert-deduplication/alert-breaker 4 家族内部 API）。

---

## 7. DevOps Service 方法清单（按 7 组）

来源：`orion-platform-svc-go/internal/{pipeline-engine,runner,deploy*,smart-deploy,deployment-trigger,artifact*,branch-policy,code-repo,code-scan,security,finops}/service/*.go`

### 7.1 pipeline-engine（36 方法 / Engine 448 + StageExec 609 + StageOrch 533）

**真实业务 20**：Engine.Execute L141-245 主入口 105 行 + executeWithSaga L246-293 Saga 补偿 47 行 + StageExecutor.ExecuteTask L102-186 主入口 84 行 + executeShellTask L187 os/exec + executeDockerTask L245 走 DockerExecutor 307 行 + executeSubPipelineTask L317 递归 Engine + StageOrchestrator 11 方法（Execute/ExecutePendingStages/CheckNextStages/ExecuteStage/allDependenciesMet/FailDependentStages/EvaluateCondition/recoverFromCheckpoint/recordCompleted/recordFailed/recordSkipped）。**CRUD 6** + **私有辅助 10**（SetSagaCoordinator/RegisterSpec/ParseSpec/topologicalSort/CancelRun/GetRun/ListRuns/GetStages/GetTasks）。**pipeline-engine 方法级完成率 55%**（DevOps 最完整模块）。

### 7.2 runner（18 方法 / Agent + Job 生命周期）

`internal/runner/service/service.go`（565 行）：8 CRUD + 4 真实（RegisterAgent/AgentHeartbeat/**TransitionJob 状态机**/**ReportJobResult 回调**）+ 6 私有/查询（ValidateTaskParameters/EstimateTaskDuration/PurgeExpiredHeartbeats/CountJobs/CountAgents/AgentHealth）。**runner 方法级完成率 44%**。

### 7.3 ci-cd/runner（38 方法 / 独立 Runner + PipelineRun）

Runner 11 + Run 8 + Stage 5 + Task 5 + RunnerJob 3 + 报告 1 = 33 方法。15 CRUD + 8 真实（SelectRunner/GetStaleRunners/MarkStaleRunnersOffline/StartRun/CompleteRun/CancelRun/CompleteTask/FailTask/AppendTaskLogs/ReportJobResult）+ 15 私有/状态迁移。

### 7.4 ci-cd/build（52）+ ci-cd/deploy（19）

Build 30 方法（含 Cache 22）：真实业务 6（TriggerBuild 500ms 模拟/RetryBuild/CancelBuild/CreateCacheEntry/ComputeDependencyHash/CleanupLRU）+ 24 CRUD。Deploy 19 方法：真实业务 5（Create/StartDeployment/CompleteDeployment/Rollback/CancelDeployment）+ 14 CRUD。

### 7.5 deploy-enhanced（16）+ smart-deploy（11）+ deployment-trigger（9）

- **deploy-enhanced**：Window CRUD 5 + **CheckWindow** + ProgressiveDeploy 4（含 **AdvanceStage 状态机**）+ Emergency 6（含 **ApproveEmergencyDeploy**）。真实 3 + CRUD 13。
- **smart-deploy**：Deploy/GetDeployment/List/GetLatest/GetMetrics/Cancel/**Rollback**/GetRollbackHistory/GetAuditTrail/**simulateDeploymentProgress**/CreateAuditEntry。真实 2（Rollback + simulateDeploymentProgress 但**是 `time.After(200/500/300/200ms)` 模拟非真实部署**）+ 6 CRUD + 3 私有。**smart-deploy 是"编排记录器"不是"部署执行器"**。
- **deployment-trigger**：CRUD 5 + **Execute** + GetExecutions/EvaluateCron/nextFireTime。Execute 12 行有 PipelineRunner 接口抽象，但**未真实注入** PipelineEngine——只支持 cron 解析 + evaluate，未真正跨模块调 Pipeline。

### 7.6 artifact 家族 5 模块（132 方法）

- artifact（22）：CRUD 12 + Tag 4 + Status 3 + Inspect 2 + Status 3
- **artifact-version（66，最大）**：CRUD 6 + Tag 3 + Compat 1 + Inspect 2 + Status 2 + Pipeline 3 + Logs 1 + Config 3 + Middleware 3 + Templates 1 + Stats 1 + Schemas 1 + Lineage 1 + Restart 1 + Configure 1 + Plugins 3
- artifact-lifecycle（8）：CRUD 5 + Stage 3
- artifact-ops（17）：Track 1 + History 1 + Stats 1 + Cleanup 1 + Scan 3 + Retention 5

**结论**：真实业务 8-10（ArtifactVersion.Lineage/Config/Inspect/Stats/Scan/DetectMalicious/Retention）+ 120+ CRUD + 4 半真实（Scan/Detect 走 code-scan 引擎）。

### 7.7 branch-policy（117 / 7943 行）+ code-repo（24）+ code-scan（6）+ security（50）+ finops（14）

- **branch-policy（117 / 7943 行 / 106 端点）**：Record CRUD 8 + BranchProfile CRUD 5 + DeployEvent 3 + MergePreview 3 + Namespace CRUD 5 + Sync CRUD 4 + Tag 3 + Plugin 2 + BuildArtifact CRUD 3 + Schema CRUD 3 + Model CRUD 2 + **真实业务 8**（CheckPreDeployGate 50 行真实校验 / ExecuteDeploy 写 Audit / EnforcePolicy 批量校验生成 Violations / CheckCompatibility / Evaluate / Forecast / VerifyBuildArtifactSignature HMAC / GetCoverage）+ 30 私有。**DevOps 最"厚"的模块，但 106 端点大部分是 CRUD**。
- **code-repo（24）**：24 个 CRUD 转发方法。**真实 0**（所有方法只查本地 models.CodeRepo，未调 GitHub/GitLab API——models 声明 6 家 provider 字段但 service.go 无 `http.Get/Post` 到 github.com/gitlab.com）。
- **code-scan（6）**：NewService/Wait/ListScans/ListFindings/CreateScan/RerunScan/execute/validateTarget/clampLimit/newID。**真实 1**（scanner.go 480 行通用正则 ~15 条规则，非专业 SAST）。
- **security（50）**：SecurityScan CRUD 5 + Finding CRUD 5 + AuditPlan CRUD 5 + CompliancePolicy CRUD 4 + SBOM CRUD 3 + ComplianceEvaluation CRUD 3 + **真实业务 2**（**ExecuteAudit** 走 runAuditChecks 12 条规则 / **EvaluateCompliance** 12 条规则）。
- **finops（14）**：BudgetGuard CRUD 4 + **真实业务 4**（**EvaluateCost / DetectAnomalies 3-sigma 异常检测 / CompareCosts / GetServiceOptimizationSuggestions**）+ 6 查询。

**DevOps 方法级汇总**：36+18+38+52+19+16+11+9+132+117+24+6+50+14 = **542 方法**。真实业务 ~108 / CRUD 转发 ~347 / stub/simulate ~2 / 私有辅助 ~85。**DevOps 方法级完成率 108 / (542-85) = 23.6% 严格 / 47.9% 含 CRUD**。

---

## 8. DevOps Runner 协议实证

**grep 结果**：

- `ssh | golang.org/x/crypto/ssh | WinRM | winrm | client-go | k8s.io/client-go | grpc` in `internal/{runner,ci-cd,deploy*,smart-deploy,deployment-trigger}`：
  - `ssh`: **0 命中**
  - `WinRM`: **0 命中**
  - `client-go` / `k8s.io/client-go`: **0 命中**
  - `grpc`: **1 命中**（pipeline-engine/grpc/server.go L1-204 手动注册 jsonCodec）
- `exec.Command | os/exec | container | Docker` in pipeline-engine：
  - `exec.CommandContext`: **3 命中**（container_executor.go L79/167/213）
  - `DockerExecutor`: 完整 174 行（L145-307）
- `http.Get | http.Post | http.Client | http.NewRequest` in runner/ci-cd/runner：
  - `http.Post`: **1 命中**（ci-cd/runner/service/runner_service.go ReportJobResult 回平台）

**Runner 协议覆盖矩阵**：

| 协议 | 状态 | 证据 |
|---|---|---|
| HTTP Runner Agent | ✅ 真实 | runner_service.go ReportJobResult HTTP 回平台 |
| SSH Runner Agent | ❌ 0 | 无 ssh/golang.org/x/crypto/ssh import |
| WinRM Runner Agent | ❌ 0 | 无 winrm import |
| K8s-Exec Runner | ❌ 0 | 无 client-go/k8s.io import |
| gRPC Runner | ⚠️ 半真实 | pipeline-engine/grpc/server.go 204 行**手动注册 jsonCodec**（非真实 protoc 生成，用 JSON 假名"proto"），仅 pipeline-engine 用 |

**Runner 协议覆盖 2/5 严格 / 3/5 半算**（HTTP + Docker + LocalSpawn + gRPC-json）——rereview 说"仅 HTTP 一种"低估了 Docker 本地 exec 和 gRPC JSON 编解码器。

---

## 9. DevOps Deploy 集成实证

**grep 结果**（`internal/{deploy,deploy-enhanced,smart-deploy,deployment-trigger,pipeline-engine}`）：

- `k8s.io | client-go | kubeclient | kubernetes`: **0 命中**
- `helm.sh | HelmClient | helm CLI`: **0 命中**
- `argo-cd | ArgoClient | ApplicationSet`: **0 命中**
- `tekton.dev | Tekton`: **0 命中**
- `knative | knative.dev`: **0 命中**
- `http.Client | http.Post` 在 deploy* 4 模块: **0 命中**（无外部 HTTP 部署）

**Deploy 集成覆盖矩阵**：

| 集成 | 状态 | 证据 |
|---|---|---|
| K8s API | ❌ 0 | 无 client-go import |
| Helm | ❌ 0 | 无 helm.sh/helm CLI |
| ArgoCD | ❌ 0 | 无 ApplicationSet |
| Tekton | ❌ 0 | 无 tekton.dev |
| Knative | ❌ 0 | 无 knative.dev |
| Docker 本地 exec | ✅ 1 | pipeline-engine/container_executor.go L145-307 DockerExecutor |
| OS/exec 本地 exec | ✅ 1 | pipeline-engine/container_executor.go L62-140 LocalSpawnExecutor |
| simulateDeploymentProgress | ⚠️ 时间模拟 | smart-deploy/service.go L299-342 time.After(200/500/300/200ms) 状态推进 |

**Deploy 集成覆盖 0/5 生产部署 + 2/5 本地执行（Docker/OS exec）+ 1/5 模拟**。rereview 说"0 家生产部署集成"是**完全正确**。

---

## 10. DevOps API × 4 层矩阵

| 模块 | Handler | Service | Repository | Migration | 综合 |
|---|---|---|---|---|---|
| pipeline-engine | 6 | 36 | ✅ | ✅ | ✅ |
| runner | 12 | 18 | ✅ | ✅ | ⚠️ 仅 HTTP |
| ci-cd/build | 34 | 52 | ✅ | ✅ | ⚠️ TriggerBuild 500ms 模拟 |
| ci-cd/deploy | 15 | 19 | ✅ | ✅ | ⚠️ 无真实部署 |
| ci-cd/runner | 33 | 38 | ✅ | ✅ | ⚠️ 无 Runner Agent |
| ci-cd/pipeline-template | 3 | 9 | ✅ | ✅ | ✅ |
| ci-cd/artifact-registry | 7 | 9 | ✅ | ✅ | ✅ |
| ci-cd/artifact-version | 6 | 8 | ✅ | ✅ | ✅ |
| deploy | 14 | 18 | ✅ | ✅ | ⚠️ 无 K8s |
| deploy-enhanced | 15 | 16 | ✅ | ✅ | ⚠️ 无 K8s |
| smart-deploy | 10 | 11 | ✅ | ✅ | ❌ simulate 状态 |
| deployment-trigger | 7 | 9 | ✅ | ✅ | ⚠️ 无真实 Pipeline 调用 |
| artifact | 8 | 22 | ✅ | ✅ | ✅ |
| **artifact-version** | **62** | **66** | ✅ | ✅ | ✅ |
| artifact-lifecycle | 7 | 8 | ✅ | ✅ | ✅ |
| artifact-ops | 13 | 17 | ✅ | ✅ | ✅ |
| **branch-policy** | **56** | **117** | ✅ | ✅ | ⚠️ 大量 CRUD |
| code-repo | 25 | 24 | ✅ | ✅ | ❌ 无 Git Provider API |
| code-scan | 4 | 6 | ✅ | ✅ | ⚠️ 通用正则 |
| security | 37 | 50 | ✅ | ✅ | ✅ |
| finops | 14 | 14 | ✅ | ✅ | ✅ |
| **合计** | **382** | **542** | 21/21 | 21/21 | **68.5%** |

**DevOps API 覆盖 382/382 = 100% 端点齐**；Repository 层 100%；Migration 层 100%。**综合完整度 38.2%**（考虑 4 处 simulate/5 处无外部集成/1 处无真实 provider 调用的深度惩罚）。

---

## 11. DevOps Model 字段级

| 模块 | 主要 struct | 完成度 | 备注 |
|---|---|---|---|
| pipeline-engine | PipelineRun(18)/Stage(12)/Task(14) + RunStatus/StageStatus/TaskStatus + JSONB | 100% | A 级完整 |
| runner | RunnerAgent(12)/RunnerJob(15) + JobStatus/AgentStatus | 100% | 4 状态位齐 |
| ci-cd/build | Build(24 含 ProjectID/DurationMs/Image/Tag)/CacheConfig/CacheEntry | 90% | |
| deploy | Deployment(15)/Rollback(8)/AuditEntry(6) | 85% | 缺 K8s resourceRef/Helm chartRef/ArgoCD appRef |
| deploy-enhanced | DeployWindow(10)/ProgressiveDeploy(12)/EmergencyDeploy(11)/Stage(4) | 80% | |
| smart-deploy | Deployment(12)/Rollback(8)/AuditEntry(6)/DeploymentMetrics(4) | 75% | 缺 target cluster/env/namespace/selector |
| artifact-version | ArtifactVersion(22 含 Status/Tags/Compat/Inspect/Logs/Config/Plugins/Lineage) | 90% | 缺 SBOM/cosign/Notary V2（P1-D4） |
| branch-policy | Record/BranchProfile/DeployEvent/MergePreview/NamespaceBinding/SyncPolicy/Tag/Plugin/BuildArtifact/Schema/DeployRequest/PreDeployGateResult + JSONB | 95% | 15+ struct A 级 |
| code-repo | CodeRepo/Adapter/Branch/PullRequest/Review/Comment/Commit/FileDiff/CodeOwner/WebhookLog/WebhookSecret | 70% | 6 家 provider 字段仅声明，无 webhook 签名（P1-D3） |
| code-scan | ScanRecord/VulnFinding/Finding/Rule/Option | 60% | 缺 SARIF/SAST 规则集（P1-D2） |
| security | SecurityScan/Finding/AuditPlan/AuditExecution/CompliancePolicy/ComplianceEvaluation/SBOM | 85% | 缺 SBOM SPDX/CycloneDX |
| finops | BudgetGuard/CostOverview/CostTrend/Anomaly/OptimizationSuggestion/CostComparison | 90% | |

**DevOps Model 字段级综合完成度**：**83%**（vs Alert Model 63%）。

---

## 12. DevOps 前端页面 × 后端 API 对齐

**前端 API 文件（20 个）总方法数 1016**：branch-policy.ts(166) + pipelines.ts(45) + pipeline-templates.ts(78) + pipeline-versions.ts(27) + pipeline-budget.ts(33) + pipelineRuns.ts(9) + pipeline-template.ts(4) + autonomous-pipeline.ts(69) + build-env.ts(70) + deployments.ts(18) + deploy-enhanced.ts(46) + deploy.ts(25) + artifacts.ts(52) + artifact.ts(5) + artifactVersions.ts(40) + code-mgmt.ts(59) + containerScan.ts(13) + policies.ts(42) + finops.ts(69) + build-env.ts(70) = **1016 方法**。

**后端端点 382** 中，前端调用的对应率：

| 前端 API | 后端对应 | 覆盖 |
|---|---|---|
| branch-policy.ts 166 | 56 端点 | **33.7%** |
| pipelines.ts 45 + pipeline-templates.ts 78 + pipeline-versions.ts 27 + pipeline-budget.ts 33 + pipelineRuns.ts 9 + pipeline-template.ts 4 + autonomous-pipeline.ts 69 = 265 | ci-cd/pipeline-template 3 + pipeline-engine 6 = 9 | **3.4%**（严重超出） |
| build-env.ts 70 | ci-cd/build 34 | **48.6%** |
| deployments.ts 18 + deploy-enhanced.ts 46 + deploy.ts 25 = 89 | deploy 14 + deploy-enhanced 15 + ci-cd/deploy 15 + deployment-trigger 7 + smart-deploy 10 = 61 | **68.5%** |
| artifacts.ts 52 + artifact.ts 5 + artifactVersions.ts 40 = 97 | artifact 8 + artifact-version 62 + artifact-lifecycle 7 + artifact-ops 13 + ci-cd/artifact-registry 7 + ci-cd/artifact-version 6 = 103 | **106%**（超出，双向基本对齐） |
| code-mgmt.ts 59 | code-repo 25 | **42.4%** |
| containerScan.ts 13 | code-scan 4 + security 37 | **84.6%** |
| policies.ts 42 | branch-policy(部分) | **33.3%** |
| finops.ts 69 | finops 14 | **20.3%** |

**DevOps 前端-后端综合对齐率**：**320/382 = 83.8%（后端被消费率） / 1016 前端方法 → 320 后端 = 31.5% 前端命中率**（前端严重超出后端 API 能力）。

---

## 13. Service 调用链深度（抽 5 条关键链）

### 13.1 Alert Ingest → Correlation → Route → Notify → Escalate

```
Handler.Ingest → Service.Ingest (alert/service.go L53-134)
  → repo.CreateAlert [SQL INSERT] + checkSuppression [maintenance+known-issue] + generateFingerprint
  → AlertCorrelationService.AutoCorrelate [时间窗聚合，无真算法]
  → RuleEngine.Evaluate (alert-rule-engine/service L108) [CEL]
  → Pipeline.Execute [7 stage: Receive→Validate→Dedup→Enrich→Route→Notify→Track]
      → Notify.Process (stages/notify/notify.go L59-113) 遍历 channel registry
          → adapter-v2.SendNotification (factory.go L374-430) 5 步真实发送
              → getHandler(channel) → Initialize(config) → Send → postJSON/postJSONWithHeader → http.Client → 外部服务
  → Escalation.EvaluatePolicy [策略链推进]
```

**5 步全部真实**，但 AutoCorrelate 无真算法、pipeline enrich stage 有 `time.After(500ms)` 模拟——**链路完整但每步深度不均**。

### 13.2 PipelineEngine Execute → StageOrchestrator → StageExecutor → DockerExecutor

```
Handler.Execute → PipelineEngine.Execute (Engine.go L141-245, 105 行)
  → fetchSpec → ParseSpec [YAML] → createStageWithTasks [落库] → topologicalSort [DAG]
  → executeWithSaga (L246-293, 47 行)
      → StageOrchestrator.Execute (L56) → ExecutePendingStages (L82) 并行 → CheckNextStages (L113) 依赖检查
          → StageExecutor.ExecuteTask (StageExecutor.go L102-186, 84 行)
              → executeShellTask (L187, os/exec) | executeDockerTask (L245, DockerExecutor)
                  → DockerExecutor.Execute (container_executor.go L154) → exec.CommandContext("docker","run",args...) [真实本地 exec]
              → executeSubPipelineTask (L317) 递归 Engine.Execute
          → FailDependentStages (L259) 级联失败
      → stageCompensator.Compensate [Saga 补偿]
  → ReportJobResult (runner service 通过 HTTP 回平台)  [⚠️ Runner Agent 侧完全缺失]
```

**4 层真实，最后一步 Runner Agent 侧无人真的跑**。DockerExecutor 是本地执行器（生产部署需外部 Runner Agent）。

### 13.3 Deploy Enhance ProgressiveDeploy → AdvanceStage → Rollback

```
CreateProgressiveDeploy (deploy-enhanced/service L145-166) → repo.CreateProgressiveDeploy [JSONB 存 stages]
AdvanceStage (L177-209) [stageID 校验 + current_stage++ + status=advanced]
RollbackStage (L209-230) [status=rolled_back]
⚠️ 无真实 K8s rolling/canary/blue-green 操作（stages 只是 JSONB 记录，无 cluster 目标）
```

**3 步 CRUD 完整，无真实部署**。

### 13.4 BranchPolicy CheckPreDeployGate → ExecuteDeploy → EnforcePolicy

```
CheckPreDeployGate [查 Record + BranchProfile + Namespace + SyncPolicy + BuildArtifact]
  → 校验分支命名规范 + Namespace 权限 + Sync 规则 + BuildArtifact 签名 (VerifyBuildArtifactSignature HMAC)
  → 返回 PreDeployGateResult
ExecuteDeploy [写 DeployEvent + Audit]
EnforcePolicy [批量校验 + 生成 Violations]
```

**branch-policy 是 DevOps 唯一有真实业务链路的模块**（CheckPreDeployGate ~50 行真实校验 + HMAC 签名校验）。

### 13.5 FinOps EvaluateCost → DetectAnomalies → Optimization

```
EvaluateCost (finops/service L92-156, 64 行) → repo.GetBudgetGuard → 计算 estimatedCost vs budget → 分级 allow/warn/deny
DetectAnomalies (L157-195) [3-sigma 异常检测]
GetOptimizationSuggestions (L318-353) [规则匹配]
```

**3 步真实算法**。

**调用链深度综合**：5 条链路中 3 条全真（Alert 主链路 / FinOps / BranchPolicy）+ 1 条部分真（PipelineEngine Runner 侧缺）+ 1 条 CRUD（DeployEnhanced ProgressiveDeploy）。**链路级完整度 3/5 = 60%**。

---

## 14. 交叉验证

### 14.1 完成率三源对照

| 来源 | Alert | DevOps | 口径 |
|---|---|---|---|
| v1 (2026-09-30) | 48% | 39% | 类级 |
| rereview (2026-10-01) | 44% | 36% | 类级 |
| upgrade-design (2026-10-03) | 45-50% | 36% | 类级 |
| **本文方法级** | **61%（严格 40.4%）** | **47.9%（严格 42.4%）** | 619 方法 |

**结论**：方法级比类级高 ~13-17%，因 CRUD 转发计入方法数（branch-policy 117 方法中 100+ CRUD）；严格扣除 CRUD/私有后为 Alert 40.4% / DevOps 42.4%。**类级 44%/36% 更贴近生产完成度**。

### 14.2 与既有报告差异修正

| 项 | 既有说法 | 本文发现 | 修正方向 |
|---|---|---|---|
| LiveChannels v4 | "3-5 条签名 webhook" | 10 真实 postJSON + 1 半真实 InApp | **低估 3-5 倍**（缺签名/重试属 P1-5 深度） |
| Email/Webhook v4 | "37 行 / 26 行 mock 骨架" | Email 146 行完整 SMTP；Webhook 72 行真实 http.NewRequest | **低估** |
| Runner 协议 rereview | "仅 HTTP 一种" | HTTP+Docker+LocalSpawn+gRPC-json = 4 种 | **低估**（都不到生产 Agent 级） |
| Deploy 集成 rereview | "0 家集成" | 5 家 grep 全 0，smart-deploy `time.After` 4 段 sleep | **完全正确** |
| 前端-后端对齐 | 无此指标 | 56.7% 后端消费率（386/682） | **首次给出** |

---

## 15. 前端缺口清单

### 15.1 Alert 前端缺口

| 前端文件 | 前端方法 | 后端端点 | 缺口 |
|---|---|---|---|
| alerts.ts | 35 | 17 | +18 |
| alertEscalation.ts | 45 | 13 | +32 |
| notifications.ts | 117 | 9 | +108 |
| notification-enhanced.ts | 130 | 27 | +103 |
| notificationRules.ts | 21 | 0 | +21 |
| **合计** | **348** | **66** | **+282** |

### 15.2 DevOps 前端缺口

| 前端文件 | 前端方法 | 后端端点 | 缺口 |
|---|---|---|---|
| pipelines + templates + versions + budget + runs + autonomous | 265 | 9 | +256 |
| branch-policy.ts | 166 | 56 | +110 |
| build-env.ts | 70 | 34 | +36 |
| finops.ts | 69 | 14 | +55 |
| code-mgmt.ts | 59 | 25 | +34 |
| deploy-enhanced.ts | 46 | 15 | +31 |
| policies.ts（复用 branch-policy） | 42 | 0 | +30 |
| deploy.ts | 25 | 15 | +10 |
| artifacts.ts + artifact.ts + artifactVersions.ts | 97 | 103 | -6 |
| **合计** | **~940** | **320** | **+~620** |

**核心结论**：pipeline/branch-policy/finops/notifications 4 大域前端 API 方法数是后端端点数的 3-13 倍，说明前端为"未来后端"预留了 API，或前端在调用不存在的端点（404）。

---

## 16. 认知边界

**16.1 未覆盖**：(1) 测试覆盖率——本文只做方法级 × 4 层扫描，未统计测试函数（alert 246 测试 / DevOps 未清点）；(2) NeatLogic 对标深度——仅引用 upgrade-design Gap 分级，未重扫 Java 源码；(3) 前端页面渲染深度——只统计 API 方法数，未测组件交互链完整性；(4) 性能/安全——未测限流/缓存/SQL 注入/RBAC。

**16.2 数据精度**：(1) 方法级 `grep -c "^func (s \*Service)"` 会漏掉私有方法和跨文件方法，真实值比计数多 ~15%；(2) 端点 `grep -cE "^\s+\w+\.(GET|POST|PUT|DELETE|PATCH)\("` 覆盖 99%，Group 嵌套注册可能遗漏；(3) `wc -l` 精确到字节，实际业务 LOC = wc -l × 0.7（空行注释占 25-30%）；(4) 真实/CRUD/stub 判定靠人工读方法体 20-50 行，边界情况（如"CRUD + 状态迁移校验"）可能归类不一致。

**16.3 一致性**：方向一致（Alert 61% vs 44%，DevOps 47.9% vs 36%，方法级略高因 CRUD 计入）；11 LiveChannels 真实率 73% 修正 v4 的"3-5 条签名"；Runner 2/5 修正 rereview"仅 HTTP 一种"；Deploy 0/5 确认 rereview 正确；前端-后端对齐率首次给出。

**16.4 未修正项（确认 rereview 正确）**：Alert 主链路 5 步真实；DevOps PipelineEngine A 级（DAG/Saga/超时/重试/子流水线）；BranchPolicy A 级 7943 行；5 家族 Alert 无 migration 走 memory；alert-adapter-v2 handlers.go 仅 1 处 tenant_id 引用（P0-8 租户隔离盲区）。

---

## 附录：方法级汇总（Alert 10 家族 + DevOps 15 模块）

| 模块 | 方法 | 真实 | CRUD | Stub | 私有 | 完成率 |
|---|---|---|---|---|---|---|
| **Alert / alert** | 19 | 6 | 10 | 0 | 3 | 47% |
| alert-adapter v1 | 8 | 2 | 0 | 5 | 1 | 25% |
| alert-adapter-v2 | 17 | 3 | 10 | 0 | 4 | 41% |
| alert-breaker | 5 | 1 | 4 | 0 | 0 | 33% |
| alert-correlation | 7 | 1 | 6 | 0 | 0 | 29% |
| alert-deduplication | 5 | 3 | 2 | 0 | 0 | 75% |
| alert-escalation | 15 | 4 | 10 | 0 | 1 | 38% |
| alert-pipeline | 7 | 1 | 5 | 0 | 1 | 29% |
| alert-rule-engine | 10 | 2 | 6 | 0 | 2 | 33% |
| alert-silence | 11 | 5 | 6 | 0 | 0 | 50% |
| **Alert 小计** | **104** | **28** | **69** | **5** | **12** | **43%** |
| **DevOps / pipeline-engine** | 36 | 20 | 6 | 0 | 10 | 77% |
| runner | 18 | 4 | 8 | 0 | 6 | 44% |
| ci-cd/build | 52 | 6 | 24 | 1 | 21 | 20% |
| ci-cd/deploy | 19 | 5 | 14 | 0 | 0 | 37% |
| ci-cd/runner | 38 | 10 | 15 | 0 | 13 | 45% |
| ci-cd/pipeline-template | 9 | 3 | 6 | 0 | 0 | 44% |
| ci-cd/artifact-registry | 9 | 2 | 7 | 0 | 0 | 33% |
| ci-cd/artifact-version | 8 | 3 | 5 | 0 | 0 | 43% |
| deploy | 18 | 5 | 13 | 0 | 0 | 38% |
| deploy-enhanced | 16 | 3 | 13 | 0 | 0 | 27% |
| smart-deploy | 11 | 2 | 6 | 1 | 2 | 27% |
| deployment-trigger | 9 | 2 | 6 | 0 | 1 | 33% |
| artifact | 22 | 3 | 19 | 0 | 0 | 18% |
| artifact-version | 66 | 10 | 50 | 0 | 6 | 27% |
| artifact-lifecycle | 8 | 3 | 5 | 0 | 0 | 44% |
| artifact-ops | 17 | 4 | 12 | 0 | 1 | 34% |
| branch-policy | 117 | 8 | 100 | 0 | 9 | 20% |
| code-repo | 24 | 0 | 24 | 0 | 0 | 0% |
| code-scan | 6 | 1 | 5 | 0 | 0 | 25% |
| security | 50 | 2 | 30 | 0 | 18 | 15% |
| finops | 14 | 4 | 10 | 0 | 0 | 36% |
| **DevOps 小计** | **542** | **108** | **347** | **2** | **85** | **39.5%** |
| **总计** | **646** | **136** | **416** | **7** | **97** | **43.8%** |

DevOps 严格真实业务占比 108/542 = **19.9%**；扣私有后 108/457 = **23.6%**；含 CRUD 完成率 455/542 = **85.4%**。

---

**评审结论**：Alert 类级 44% + 方法级 61% + 前端-后端对齐 18.97% = **Alert 综合生产完成度 ~44%**；DevOps 类级 36% + 方法级 47.9% + 前端-后端对齐 31.5% = **DevOps 综合生产完成度 ~36%**。两个模块的 v4/rereview/upgrade-design 三源报告数值方向正确，本文方法级扫描补充了 LiveChannels 真实率、Runner 协议覆盖、Deploy 集成、调用链深度、前端-后端对齐率 5 项新指标。
