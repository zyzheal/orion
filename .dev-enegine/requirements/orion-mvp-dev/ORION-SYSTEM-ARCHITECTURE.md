# Orion 系统架构与功能流程文档

**日期:** 2026-04-14
**版本:** 1.0

---

## 一、系统总体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            前端应用层 (Frontend)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Dashboard │ Pipeline │ Ticket │ Alert │ FinOps │ Plugin │ Deployment  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API 网关层 (Fastify)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/v1/pipelines  │ /api/v1/tickets │ /api/v1/monitoring │ /plugins  │
│  /api/v1/cmdb       │ /api/v1/deploy  │ /api/v1/finops     │ /build    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 服务调用 / 事件总线
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           服务层 (Services)                               │
├─────────────┬─────────────┬──────────────┬──────────────┬─────────────┤
│ Pipeline    │ Ticketing   │ Monitoring   │ FinOps       │ Plugin      │
│ Service     │ Service     │ Service      │ Service      │ Service     │
├─────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ CMDB        │ Deploy      │ SelfHealing  │ Build        │ AI Review   │
│ Service     │ Service     │ Service      │ Service      │ Service     │
└─────────────┴─────────────┴──────────────┴──────────────┴─────────────┘
                                    │
                                    │ 事件驱动 (EventBus/NATS)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          引擎层 (Engines)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Pipeline Engine │ Stage Executor │ Task Runner │ SelfHealing Engine   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 数据持久化
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          基础设施层 (Infrastructure)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL │ Redis │ NATS │ Kubernetes │ S3 │ GitLab │ Prometheus    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心模块详细功能

### 1. Pipeline 流水线引擎模块

**路由前缀:** `/api/v1/pipelines`, `/api/v1/pipeline-runs`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建 Pipeline | POST /pipelines | 创建新的流水线定义 |
| 获取 Pipeline 列表 | GET /pipelines | 返回流水线列表 |
| 获取 Pipeline 详情 | GET /pipelines/:id | 返回单条流水线详细信息 |
| 获取版本列表 | GET /pipelines/:id/versions | 获取流水线所有版本 |
| 更新 Pipeline | PUT /pipelines/:id | 更新流水线配置 |
| 删除 Pipeline | DELETE /pipelines/:id | 删除流水线 |
| 验证 YAML | POST /pipelines/validate | 验证流水线 YAML 格式 |
| 触发执行 | POST /pipelines/:id/runs | 手动触发流水线执行 |
| 获取执行列表 | GET /pipeline-runs | 获取执行记录列表 |
| 获取执行详情 | GET /pipeline-runs/:id | 获取单次执行详情 |
| 取消执行 | POST /pipeline-runs/:id/cancel | 取消正在运行的执行 |
| 获取 Stages | GET /pipeline-runs/:id/stages | 获取执行的所有阶段 |
| 获取 Tasks | GET /pipeline-runs/:id/tasks | 获取执行的所有任务 |
| 获取 Stage 详情 | GET /stages/:id | 获取阶段详情 |
| 获取 Stage 的 Tasks | GET /stages/:id/tasks | 获取阶段下的任务 |
| 重试 Stage | POST /stages/:id/retry | 重试失败的阶段 |
| 获取 Task 详情 | GET /tasks/:id | 获取任务详情 |
| 获取 Task 日志 | GET /tasks/:id/log | 获取任务执行日志 |
| 重试 Task | POST /tasks/:id/retry | 重试失败的任务 |

#### 核心组件

```
PipelineController ─┬──> PipelineService ──> Pipeline (模型)
                    │
                    └──> PipelineEngine ──┬──> StageExecutor ──> TaskRunner
                                          │
                                          └──> PipelineEventPublisher
```

#### 执行流程

```
1. 用户触发 Pipeline
   │
   ▼
2. PipelineEngine.execute()
   │
   ├──> 解析 YAML 定义
   │
   ├──> 创建 PipelineRun
   │
   ├──> 初始化 Stages (按依赖关系排序)
   │
   └──> 初始化 Tasks (每个 Stage 内)
       │
       ▼
4. StageExecutor 执行 Stage
   │
   ├──> 检查依赖 Stage 是否完成
   │
   ├──> 并行执行 Tasks
   │
   └──> 发布 Stage 事件
       │
       ▼
5. 所有 Stage 完成后发布 PipelineRun 完成事件
```

---

### 2. 智能工单模块 (Smart Ticketing)

**路由前缀:** `/api/v1/tickets`, `/api/v1/ticketing`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建工单 | POST /tickets | 创建新工单 |
| 从告警创建 | POST /tickets/from-alert | 基于告警自动生成工单 |
| 从事件创建 | POST /tickets/from-incident | 基于事件自动生成工单 |
| 获取工单列表 | GET /tickets | 获取工单列表（支持筛选） |
| 获取工单详情 | GET /tickets/:id | 获取工单详细信息 |
| 状态流转 | POST /tickets/:id/transition | 工单状态转换 |
| 指派工单 | POST /tickets/:id/assign | 指派工单给工程师 |
| 升级工单 | POST /tickets/:id/escalate | 升级工单到上级 |
| 解决工单 | POST /tickets/:id/resolve | 标记工单已解决 |
| 关闭工单 | POST /tickets/:id/close | 关闭工单 |
| 添加评论 | POST /tickets/:id/comments | 添加工单评论 |
| 获取 SLA 状态 | GET /tickets/:id/sla | 获取工单 SLA 状态 |
| 获取关联关系 | GET /tickets/:id/relations | 获取关联的告警/事件 |
| 工单报告 | GET /reports/summary | 获取工单汇总报告 |
| 获取分派队列 | GET /dispatch-queues | 获取待分派队列 |

#### 工单状态机

```
open ──assign──> assigned ──accept──> in-progress ──resolve──> resolved
  │                   │                    │                      │
  │                   │                    │                      │
  ▼                   ▼                    ▼                      ▼
closed            returned           escalated              closed
```

#### 核心组件

```
TicketingController ──> TicketingService ──┬──> Ticket (模型)
                                           │
                                           ├──> WorkflowEngine
                                           │
                                           └──> SLATracker
```

---

### 3. 监控告警模块 (Monitoring & Alerting)

**路由前缀:** `/api/v1/monitoring`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 服务启动 | POST /start | 启动监控服务 |
| 服务停止 | POST /stop | 停止监控服务 |
| 健康检查 | GET /health | 服务健康检查 |
| 采集指标 | POST /collect | 手动采集系统指标 |
| 获取指标列表 | GET /metrics | 获取已注册的指标 |
| 记录指标 | POST /metrics | 记录新的指标数据 |
| 注册指标 | POST /metrics/register | 注册自定义指标 |
| 获取时序数据 | GET /metrics/:name/series | 获取指标时间序列 |
| 获取指标摘要 | GET /metrics/:name/summary | 获取指标统计摘要 |
| 创建告警规则 | POST /rules | 创建新的告警规则 |
| 获取规则列表 | GET /rules | 获取所有规则 |
| 获取规则详情 | GET /rules/:id | 获取单条规则详情 |
| 更新规则 | PUT /rules/:id | 更新规则配置 |
| 删除规则 | DELETE /rules/:id | 删除规则 |
| 触发告警 | POST /alerts/trigger | 手动触发告警 |
| 获取告警列表 | GET /alerts | 获取告警列表 |
| 确认告警 | POST /alerts/:id/acknowledge | 确认告警 |
| 关闭告警 | POST /alerts/:id/close | 关闭告警 |
| 获取通知渠道 | GET /notification-channels | 获取通知渠道列表 |
| 创建渠道 | POST /notification-channels | 创建通知渠道 |
| 获取升级策略 | GET /escalation-policies | 获取升级策略列表 |
| 获取仪表盘数据 | GET /dashboard/data | 获取仪表盘展示数据 |

#### 告警处理流程

```
1. 指标采集 ──> 2. 规则匹配 ──> 3. 告警触发
                                      │
                                      ▼
                              ┌───────┴───────┐
                              │               │
                              ▼               ▼
                        通知渠道          升级策略
                              │               │
                              ▼               ▼
                        发送邮件/短信     通知上级
```

---

### 4. FinOps 成本管理模块

**路由前缀:** `/api/v1/finops`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 记录项目成本 | POST /track/project | 记录项目花费 |
| 记录租户成本 | POST /track/tenant | 记录租户花费 |
| 记录团队成本 | POST /track/team | 记录团队花费 |
| 获取实体成本 | GET /track/:entityType/:entityId | 获取按实体汇总成本 |
| 获取成本趋势 | GET /track/:entityType/:entityId/trend | 获取成本趋势 |
| 获取分摊报告 | GET /chargeback | 获取成本分摊报告 |
| 计算 ROI | POST /roi/calculate | 计算投资回报率 |
| 分析自动化节省 | POST /roi/automation | 分析自动化节省成本 |
| 对比周期成本 | POST /roi/compare | 对比不同周期成本 |
| 获取 ROI 历史 | GET /roi/history | 获取 ROI 历史记录 |
| 获取 ROI 摘要 | GET /roi/summary | 获取 ROI 汇总数据 |
| 创建预算 | POST /budget | 创建新预算 |
| 获取预算列表 | GET /budget | 获取预算列表 |
| 更新预算 | PUT /budget/:id | 更新预算配置 |
| 删除预算 | DELETE /budget/:id | 删除预算 |
| 更新花费 | POST /budget/:id/spend | 更新预算实际花费 |
| 检查预算告警 | POST /budget/check-alerts | 检查是否触发预算告警 |

#### 成本追踪流程

```
资源使用数据 ──> 成本计算 ──> 分摊到实体 ──> 预算对比 ──> 告警/报告
```

---

### 5. CMDB 配置管理模块

**路由前缀:** `/api/v1/cmdb`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建配置项 | POST /cis | 创建新的 CI |
| 获取配置项列表 | GET /cis | 获取 CI 列表 |
| 获取配置项详情 | GET /cis/:id | 获取 CI 详细信息 |
| 更新配置项 | PUT /cis/:id | 更新 CI |
| 删除配置项 | DELETE /cis/:id | 删除 CI |
| 获取关联关系 | GET /cis/:id/relations | 获取 CI 的关联关系 |
| 获取版本历史 | GET /cis/:id/versions | 获取 CI 变更历史 |
| 创建关联关系 | POST /relations | 创建 CI 间关联 |
| 删除关联关系 | DELETE /relations/:id | 删除关联关系 |
| 获取主机列表 | GET /hosts | 获取主机资源 |
| 获取主机详情 | GET /hosts/:ciId | 获取主机详情 |
| 获取 K8s 资源 | GET /k8s | 获取 K8s 资源列表 |
| 获取 CI/CD 资源 | GET /cicd | 获取 CI/CD 资源 |

#### 核心组件

```
CmdbController ──> CmdbService ──┬──> CI (模型)
                                 │
                                 ├──> CmdbEventPublisher
                                 │
                                 └──> CmdbIntegrationService
```

---

### 6. 智能部署模块 (Smart Deploy)

**路由前缀:** `/api/v1/deploy`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建部署 | POST /deploy | 创建并执行部署 |
| 获取部署状态 | GET /deploy/:id | 获取部署状态 |
| 获取部署历史 | GET /deploy/history | 获取部署历史 |
| 获取部署指标 | GET /deploy/metrics | 获取部署指标 |
| 获取审计追踪 | GET /deploy/:id/audit | 获取部署审计记录 |
| 触发回滚 | POST /deploy/:id/rollback | 触发部署回滚 |
| 获取回滚历史 | GET /deploy/:id/rollbacks | 获取回滚历史 |
| 取消部署 | POST /deploy/:id/cancel | 取消正在进行的部署 |

#### 部署流程

```
1. 创建部署请求 ──> 2. 预检查 (环境/配置)
                         │
                         ▼
                    3. 执行部署
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
          金丝雀     蓝绿部署    滚动更新
              │          │          │
              └──────────┼──────────┘
                         │
                         ▼
                    4. 健康检查
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
           成功 ──> 完成        失败 ──> 自动回滚
```

---

### 7. 自愈引擎模块 (Self-Healing Engine)

**路由前缀:** `/api/v1/self-healing`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建事件 | POST /incidents | 手动触发自愈事件 |
| 获取事件详情 | GET /incidents/:id | 获取自愈事件详情 |
| 获取历史 | GET /history | 获取自愈历史 |
| 获取效果指标 | GET /effectiveness | 获取自愈效果指标 |
| 获取策略列表 | GET /strategies | 获取自愈策略 |
| 获取策略详情 | GET /strategies/:id | 获取策略详情 |
| 注册策略 | POST /strategies | 注册自定义自愈策略 |
| 更新策略 | PUT /strategies/:id | 更新策略 |
| 删除策略 | DELETE /strategies/:id | 删除策略 |
| 获取审批流程 | GET /approvals/:id | 获取审批工作流 |
| 审批通过 | POST /approvals/:id/approve | 审批通过 |
| 审批拒绝 | POST /approvals/:id/reject | 审批拒绝 |

#### 自愈流程

```
1. 事件触发 ──> 2. 策略匹配 ──> 3. 审批流程 (可选)
                                         │
                                         ▼
                                 4. 执行修复动作
                                         │
                                         ▼
                                 5. 验证修复结果
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                           成功 ──> 记录        失败 ──> 升级
```

---

### 8. 构建环境管理模块

**路由前缀:** `/api/v1/build`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| **Builder 镜像管理** |
| 注册镜像 | POST /build-images | 注册新的构建镜像 |
| 镜像列表 | GET /build-images | 获取镜像列表 |
| 预置镜像 | GET /build-images/presets | 获取预置镜像 |
| 可用镜像 | GET /build-images/available | 获取可用镜像 |
| 按类型获取 | GET /build-images/type/:type | 按类型获取镜像 |
| 镜像详情 | GET /build-images/:id | 获取镜像详情 |
| 更新镜像 | PUT /build-images/:id | 更新镜像配置 |
| 弃用镜像 | POST /build-images/:id/deprecate | 弃用镜像 |
| 恢复镜像 | POST /build-images/:id/restore | 恢复已弃用镜像 |
| 删除镜像 | DELETE /build-images/:id | 删除镜像 |
| **构建缓存管理** |
| 创建缓存配置 | POST /build-cache/configs | 创建缓存配置 |
| 缓存配置列表 | GET /build-cache/configs | 获取缓存配置列表 |
| 缓存配置详情 | GET /build-cache/configs/:id | 获取配置详情 |
| 更新缓存配置 | PUT /build-cache/configs/:id | 更新配置 |
| 删除缓存配置 | DELETE /build-cache/configs/:id | 删除配置 |
| 生效配置 | GET /build-cache/effective | 获取生效的缓存配置 |
| 检查缓存启用 | GET /build-cache/enabled | 检查缓存是否启用 |
| 创建缓存条目 | POST /build-cache/entries | 创建缓存条目 |
| 缓存条目列表 | GET /build-cache/entries | 获取缓存条目 |
| 删除缓存条目 | DELETE /build-cache/entries/:id | 删除条目 |
| 清理过期缓存 | POST /build-cache/cleanup/expired | 清理过期缓存 |
| LRU 清理 | POST /build-cache/cleanup/lru | 基于 LRU 清理 |
| 清空配置缓存 | POST /build-cache/clear/:configId | 清空配置缓存 |
| **K8s 构建执行** |
| 创建 Pod | POST /build-pods | 创建构建 Pod |
| Pod 列表 | GET /build-pods | 获取 Pod 列表 |
| Pod 状态 | GET /build-pods/:id | 获取 Pod 状态 |
| Pod 日志 | GET /build-pods/:id/logs | 获取 Pod 日志 |
| 取消构建 | POST /build-pods/:id/cancel | 取消构建 |
| 清理 Pod | POST /build-pods/cleanup | 清理完成的 Pod |
| **构建日志管理** |
| 创建日志 | POST /build-logs | 创建日志记录 |
| 查询日志 | GET /build-logs | 查询日志 |
| 日志详情 | GET /build-logs/:id | 获取日志详情 |
| 格式化文本 | GET /build-logs/:id/text | 获取格式化文本 |
| 追加日志 | POST /build-logs/:id/entries | 追加日志条目 |
| 批量追加 | POST /build-logs/:id/entries/batch | 批量追加日志 |
| 导入日志 | POST /build-logs/:id/import | 导入原始日志 |
| 标记完成 | POST /build-logs/:id/complete | 标记日志完成 |
| SSE 流 | GET /build-logs/:id/stream | SSE 日志流 |
| **构建产物管理** |
| 创建产物 | POST /artifacts | 上传构建产物 |
| 产物列表 | GET /artifacts | 获取产物列表 |
| 产物详情 | GET /artifacts/:id | 获取产物详情 |
| 下载产物 | GET /artifacts/:id/download | 下载产物 |
| 删除产物 | DELETE /artifacts/:id | 删除产物 |
| 清理过期 | POST /artifacts/cleanup/expired | 清理过期产物 |
| **Stage 级别缓存/产物** |
| 保存缓存 | POST /pipeline-runs/:runId/stages/:stageId/cache | 保存 Stage 缓存 |
| 恢复缓存 | GET /pipeline-runs/:runId/stages/:stageId/cache | 恢复 Stage 缓存 |
| 上传产物 | POST /pipeline-runs/:runId/stages/:stageId/artifacts | 上传 Stage 产物 |
| 产物列表 | GET /pipeline-runs/:runId/stages/:stageId/artifacts | 获取 Stage 产物列表 |

---

### 9. 代码仓库管理模块

**路由前缀:** `/api/v1/code-repo`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 获取适配器列表 | GET /adapters | 获取已支持的代码适配器 |
| 仓库列表 | GET /:adapterId/repositories | 获取仓库列表 |
| 仓库详情 | GET /:adapterId/repository | 获取仓库详情 |
| 分支列表 | GET /:adapterId/:repoId/branches | 获取分支列表 |
| 分支详情 | GET /:adapterId/:repoId/branches/:branchName | 获取分支详情 |
| 创建分支 | POST /:adapterId/:repoId/branches | 创建新分支 |
| 删除分支 | DELETE /:adapterId/:repoId/branches/:branchName | 删除分支 |
| PR/MR 列表 | GET /:adapterId/:repoId/pull-requests | 获取 PR/MR 列表 |
| PR/MR 详情 | GET /:adapterId/:repoId/pull-requests/:prId | 获取 PR/MR 详情 |
| 创建 PR/MR | POST /:adapterId/:repoId/pull-requests | 创建 PR/MR |
| 合并 PR/MR | POST /:adapterId/:repoId/pull-requests/:prId/merge | 合并 PR/MR |
| 关闭 PR/MR | POST /:adapterId/:repoId/pull-requests/:prId/close | 关闭 PR/MR |
| Reviews 列表 | GET /:adapterId/:repoId/pull-requests/:prId/reviews | 获取评论列表 |
| 添加 Review | POST /:adapterId/:repoId/pull-requests/:prId/reviews | 添加 Review |
| 创建保护策略 | POST /branch-policies | 创建分支保护策略 |
| 获取保护策略 | GET /branch-policies | 获取保护策略列表 |
| 更新保护策略 | PUT /branch-policies/:id | 更新保护策略 |
| 删除保护策略 | DELETE /branch-policies/:id | 删除保护策略 |
| Webhook 处理 | POST /webhooks/:provider | 处理代码平台 Webhook |

---

### 10. 插件管理模块

**路由前缀:** `/api/v1/plugins`, `/api/v1/plugins-spi`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 可用插件列表 | GET /plugins/available | 获取可安装的插件 |
| 已安装插件 | GET /plugins/installed | 获取已安装插件 |
| 插件详情 | GET /plugins/:pluginId | 获取插件详情 |
| 安装插件 | POST /plugins/:pluginId/install | 安装插件 |
| 卸载插件 | POST /plugins/:pluginId/uninstall | 卸载插件 |
| 激活插件 | POST /plugins/:pluginId/activate | 激活插件 |
| 停用插件 | POST /plugins/:pluginId/deactivate | 停用插件 |
| 配置插件 | POST /plugins/:pluginId/configure | 配置插件参数 |
| 执行任务 | POST /plugins/:pluginId/execute | 执行插件任务 |
| SPI 调用 | POST /plugins-spi/:pluginId/invoke | SPI 方式调用插件 |

#### 插件安全机制

```
┌─────────────────┐
│   Plugin CLI    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Plugin Sandbox │ <─── 资源配额限制
└────────┬────────┘     输入验证
         │              输出脱敏
         ▼
┌─────────────────┐
│  Plugin Runtime │ <─── WASM/容器/进程
└─────────────────┘
```

---

### 11. AI Code Review 模块

**路由前缀:** `/api/v1/ai-review`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建 Review | POST /reviews | 创建代码评审请求 |
| 获取 Review | GET /reviews/:id | 获取评审详情 |
| 获取评审历史 | GET /reviews/history | 获取评审历史 |
| 配置规则 | POST /rules | 配置 AI 评审规则 |
| 获取规则 | GET /rules | 获取评审规则列表 |

---

### 12. 诊断 Agent 模块

**路由前缀:** `/api/v1/diagnostic`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建诊断 | POST /diagnostics | 创建诊断请求 |
| 获取诊断结果 | GET /diagnostics/:id | 获取诊断结果 |
| 获取诊断历史 | GET /diagnostics/history | 获取诊断历史 |

---

### 13. 智能测试选择器模块

**路由前缀:** `/api/v1/test-selector`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 分析变更 | POST /analyze | 分析代码变更 |
| 推荐测试 | POST /recommend | 推荐需要运行的测试 |
| 获取测试用例 | GET /tests | 获取可用测试用例列表 |

---

### 14. 备份恢复模块

**路由前缀:** `/api/v1/backup`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 创建备份计划 | POST /plans | 创建备份计划 |
| 获取备份计划 | GET /plans | 获取备份计划列表 |
| 执行备份 | POST /plans/:id/execute | 手动执行备份 |
| 恢复数据 | POST /restore | 恢复数据 |
| 获取备份历史 | GET /history | 获取备份历史 |

---

### 15. AI 安全加固模块

**路由前缀:** `/api/v1/ai-security`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 输入验证 | POST /validate | 验证 AI 输入 |
| 输出过滤 | POST /filter | 过滤 AI 输出 |
| 会话审计 | GET /sessions/:id/audit | 获取会话审计日志 |
| 安全配置 | GET /config | 获取安全配置 |
| 更新配置 | PUT /config | 更新安全配置 |

---

### 16. 租户管理模块 (Tenant Management)

**路由前缀:** `/api/v1/tenant`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 租户上下文管理 | GET /context | 获取当前租户上下文 |
| 租户配额查询 | GET /quota | 获取租户配额状态 |
| 租户配额更新 | PUT /quota | 更新租户配额 |
| Namespace 分配 | POST /namespace/allocate | 从 Namespace 池分配 |
| Namespace 释放 | POST /namespace/release | 释放 Namespace 到池中 |
| Namespace 池状态 | GET /namespace/pool | 获取 Namespace 池状态 |
| 租户中间件配置 | GET /middleware/config | 获取中间件配置 |
| 租户中间件更新 | PUT /middleware/config | 更新中间件配置 |

#### 核心组件

```
TenantMiddleware ──> TenantContext ──> TenantInfo
                          │
                          ├──> TenantQuotaService
                          │
                          └──> NamespacePoolService
```

#### 租户隔离流程

```
1. 请求进入 ──> 2. TenantMiddleware 提取租户 ID
                    │
                    ▼
3. TenantContext 加载租户信息
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
4. 配额检查              5. Namespace 绑定
         │                     │
         ▼                     ▼
    通过 ──> 继续处理     已绑定 ──> 执行操作
         │                     │
         ▼                     ▼
    超限 ──> 拒绝请求     未绑定 ──> 分配 Namespace
```

---

### 17. AI 网关模块 (AI Gateway)

**路由前缀:** `/api/v1/ai-gateway`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| AI 请求路由 | POST /route | AI 请求路由到模型 |
| 降级路由 | POST /degrade | 降级模式下的路由处理 |
| 规则管理 | GET /rules | 获取路由规则列表 |
| 规则创建 | POST /rules | 创建新的路由规则 |
| 规则更新 | PUT /rules/:id | 更新路由规则 |
| 规则删除 | DELETE /rules/:id | 删除路由规则 |
| 规则引擎状态 | GET /engine/status | 获取规则引擎状态 |
| 网关配置 | GET /config | 获取网关配置 |
| 网关更新 | PUT /config | 更新网关配置 |

#### 核心组件

```
AIGateway ──> RuleEngine ──> AIDegradationRouter
                  │
                  └──> ModelRouter
```

#### AI 请求路由流程

```
1. 客户端请求 ──> 2. AIGateway 接收
                        │
                        ▼
3. RuleEngine 规则匹配
                        │
              ┌─────────┴─────────┐
              │                   │
              ▼                   ▼
         规则匹配            无匹配规则
              │                   │
              ▼                   ▼
         执行动作            默认路由
              │                   │
              └─────────┬─────────┘
                        │
                        ▼
4. AIDegradationRouter 处理降级
                        │
                        ▼
5. 模型路由 ──> 6. 响应返回
```

---

### 18. 告警管理模块 (Alert Management)

**路由前缀:** `/api/v1/alert`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 告警关联 | GET /correlation | 获取告警关联关系 |
| 关联规则创建 | POST /correlation/rules | 创建关联规则 |
| 告警去重 | POST /deduplication/check | 检查告警是否重复 |
| 去重配置 | GET /deduplication/config | 获取去重配置 |
| 告警抑制 | GET /suppression | 获取抑制窗口列表 |
| 抑制创建 | POST /suppression | 创建抑制窗口 |
| 抑制删除 | DELETE /suppression/:id | 删除抑制窗口 |
| 告警类型管理 | GET /types | 获取告警类型列表 |
| 告警类型创建 | POST /types | 创建告警类型 |

#### 核心组件

```
AlertCorrelationService ──> AlertDeduplication
                                   │
                                   └──> AlertSuppressionService
```

#### 告警处理流程

```
1. 告警输入 ──> 2. 去重检查
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    重复告警 ──> 合并     新告警 ──> 关联分析
                                      │
                                      ▼
                                3. 抑制检查
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                            ▼                   ▼
                       抑制中 ──> 丢弃     正常 ──> 输出
```

---

### 19. 审计模块 (Audit)

**路由前缀:** `/api/v1/audit`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| 审计日志写入 | POST /logs | 写入审计日志 |
| 审计日志查询 | GET /logs | 查询审计日志 |
| 链验证 | POST /chain/verify | 验证审计链完整性 |
| 验证报告 | GET /chain/report | 获取链验证报告 |
| 完整性检查 | POST /integrity/check | 执行完整性检查 |
| 完整性报告 | GET /integrity/report | 获取完整性报告 |
| 不可逆存储配置 | GET /storage/config | 获取存储配置 |
| 存储状态 | GET /storage/status | 获取存储状态 |

#### 核心组件

```
AuditLogChain ──> ImmutableAuditStorage
                          │
                          └──> AuditIntegrityVerifier
```

#### 审计链流程

```
1. 事件发生 ──> 2. 创建审计日志
                      │
                      ▼
3. 计算哈希 ──> 4. 链接到前一条日志
                      │
                      ▼
5. 写入不可逆存储 ──> 6. 验证链完整性
                      │
                      ▼
7. 定期完整性检查 ──> 8. 告警异常
```

---

### 20. 配置管理模块 (Configuration Management)

**路由前缀:** `/api/v1/config`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| **配置 CRUD** |
| 创建配置 | POST /configs | 创建配置项 |
| 获取配置列表 | GET /configs | 获取配置列表 |
| 获取配置详情 | GET /configs/:configId | 获取配置详情 |
| 更新配置 | PUT /configs/:configId | 更新配置 |
| 删除配置 | DELETE /configs/:configId | 删除配置（软删除） |
| 获取版本历史 | GET /configs/:configId/versions | 获取版本历史 |
| 版本回滚 | POST /configs/:configId/rollback | 回滚到指定版本 |
| 配置克隆 | POST /configs/:configId/clone | 克隆配置到其他环境 |
| **GitOps** |
| 启用 GitOps | POST /gitops | 启用 GitOps 同步 |
| GitOps 列表 | GET /gitops | 获取 GitOps 配置列表 |
| 手动同步 | POST /gitops/:gitOpsConfigId/sync | 触发手动同步 |
| 禁用 GitOps | POST /gitops/:gitOpsConfigId/disable | 禁用 GitOps |
| 检测漂移 | GET /gitops/drift | 检测配置漂移 |
| 同步状态 | GET /gitops/sync-status | 获取同步状态历史 |
| **审批工作流** |
| 创建变更请求 | POST /change-requests | 创建配置变更请求 |
| 变更请求列表 | GET /change-requests | 获取变更请求列表 |
| 变更请求详情 | GET /change-requests/:changeRequestId | 获取变更请求详情 |
| 审批通过 | POST /change-requests/:changeRequestId/approve | 审批通过 |
| 审批拒绝 | POST /change-requests/:changeRequestId/reject | 审批拒绝 |
| 审计追踪 | GET /configs/:configId/audit | 获取配置审计追踪 |
| **差异比较** |
| 环境对比 | GET /diff/:sourceEnv/:targetEnv | 对比环境配置 |
| 版本对比 | GET /configs/:configId/versions/diff | 对比配置版本 |
| 差异报告 | GET /diff/report | 生成综合差异报告 |

#### 核心组件

```
ConfigController ──┬──> ConfigService
                   │
                   ├──> GitOpsService
                   │
                   ├──> ConfigApprovalService
                   │
                   └──> ConfigDiffService
```

#### GitOps 同步流程

```
1. Git 仓库变更 ──> 2. GitOpsService 检测
                          │
                          ▼
3. 同步触发 ──> 4. ConfigDiffService 分析差异
                          │
                          ▼
5. 变更请求创建 ──> 6. 审批工作流
                          │
                   ┌──────┴──────┐
                   │             │
                   ▼             ▼
              审批通过     审批拒绝
                   │             │
                   ▼             ▼
7. 应用配置  ──> 8. 记录审计日志
```

---

### 21. 风险评估模块 (Risk Assessment)

**路由前缀:** `/api/v1/risk`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| **风险评估** |
| 部署风险评估 | POST /assess/deployment | 评估部署风险 |
| 变更风险评估 | POST /assess/change | 评估变更风险 |
| **评估历史** |
| 获取评估历史 | GET /assessments | 获取评估历史列表 |
| 获取评估详情 | GET /assessments/:id | 获取评估详情 |
| **评估报告** |
| 生成报告 | POST /reports/generate/:assessmentId | 生成评估报告 |
| 报告历史 | GET /reports | 获取报告历史 |
| 报告详情 | GET /reports/:id | 获取报告详情 |
| **健康检查** |
| 发布前健康检查 | POST /health-check | 运行发布前健康检查 |
| 基础健康检查 | POST /health-check/basic | 运行基础健康检查 |
| **状态** |
| 服务状态 | GET /status | 获取服务状态 |

#### 核心组件

```
RiskAssessmentService ──┬──> RiskScoringEngine
                        │
                        ├──> HealthCheckService
                        │
                        └──> RiskEventSubscriber
```

#### 风险评估流程

```
1. 评估请求 ──> 2. 数据收集
                      │
                      ▼
3. RiskScoringEngine 计算风险分数
                      │
                      ▼
4. HealthCheckService 运行健康检查
                      │
                      ▼
5. 综合评估 ──> 6. 生成风险等级
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
        低风险 ──> 允许     高风险 ──> 阻断/告警
```

---

### 22. 效能分析模块 (Efficiency Analytics)

**路由前缀:** `/api/v1/efficiency`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| DORA 指标查询 | GET /dora/metrics | 获取 DORA 指标数据 |
| DORA 报告生成 | POST /dora/report | 生成 DORA 报告 |
| ClickHouse 同步状态 | GET /clickhouse/status | 获取同步状态 |
| ClickHouse 同步触发 | POST /clickhouse/sync | 触发数据同步 |
| 事件处理 | POST /events | 发送效能事件 |
| 效能仪表盘 | GET /dashboard | 获取效能仪表盘数据 |

#### 核心组件

```
EfficiencyEventHandler ──> DoraMetricsService
                                 │
                                 └──> ClickHouseSync
```

#### DORA 指标收集流程

```
1. Pipeline 事件 ──> 2. EventHandler 接收
                          │
                          ▼
3. 事件存储 ──> 4. DoraMetricsService 聚合
                          │
                          ▼
5. ClickHouseSync 同步 ──> 6. 仪表盘更新
```

---

### 23. 诊断 Agent 模块 (Diagnostic Agent) - 扩展

**路由前缀:** `/api/v1/diagnostic`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| **诊断触发** |
| 触发诊断 | POST /trigger | 触发诊断会话 |
| **诊断会话** |
| 诊断历史 | GET /sessions | 获取诊断历史 |
| 诊断详情 | GET /sessions/:id | 获取诊断详情 |
| 添加症状 | POST /sessions/:id/symptoms | 添加症状到会话 |
| 完成诊断 | POST /sessions/:id/complete | 完成诊断会话 |
| 复杂度评估 | GET /sessions/:id/complexity | 评估修复复杂度 |
| **诊断报告** |
| 报告历史 | GET /reports | 获取报告历史 |
| 报告详情 | GET /reports/:id | 获取报告详情 |
| **知识库** |
| 添加模式 | POST /knowledge/patterns | 添加诊断模式 |
| 模式搜索 | GET /knowledge/patterns | 搜索诊断模式 |
| 模式详情 | GET /knowledge/patterns/:id | 获取模式详情 |
| 知识库统计 | GET /knowledge/stats | 获取知识库统计 |
| 记录结果 | POST /knowledge/outcomes | 记录诊断结果 |
| **状态** |
| 服务状态 | GET /status | 获取诊断服务状态 |

#### 核心组件

```
DiagnosticAgentService ──┬──> DiagnosticEngine
                         │
                         ├──> DiagnosticDecisionTree
                         │
                         └──> DiagnosticKnowledgeBase
```

#### 诊断流程

```
1. 症状输入 ──> 2. DiagnosticEngine 分析
                        │
                        ▼
3. DecisionTree 匹配 ──> 4. KnowledgeBase 查询
                        │
                        ▼
5. 生成诊断结果 ──> 6. 推荐修复方案
                        │
                        ▼
7. 记录结果反馈 ──> 8. 知识库更新
```

---

### 24. 测试选择器模块 (Test Selector) - 扩展

**路由前缀:** `/api/v1/test-selector`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| **测试选择** |
| 选择测试 | POST /select | 为 PR 变更选择测试 |
| **测试计划** |
| 计划详情 | GET /plan/:planId | 获取测试计划详情 |
| **PR 测试结果** |
| PR 测试结果 | GET /pr/:prId | 获取 PR 测试结果 |
| **测试历史** |
| 单个测试历史 | GET /history/:testId | 获取测试历史统计 |
| 全部测试历史 | GET /history | 获取所有测试历史 |
| **测试记录** |
| 记录结果 | POST /record | 记录测试执行结果 |
| **抖动测试** |
| 抖动测试列表 | GET /flaky | 获取抖动测试列表 |
| **覆盖率** |
| 覆盖率统计 | GET /coverage | 获取测试覆盖率 |
| **测试套件** |
| 套件列表 | GET /suites | 获取所有测试套件 |
| 用例列表 | GET /cases | 获取所有测试用例 |
| **重新分析** |
| 重新分析依赖 | POST /reanalyze | 重新分析测试依赖 |

#### 核心组件

```
TestSelectorService ──┬──> TestImpactAnalyzer
                      │
                      ├──> TestFailurePredictor
                      │
                      └──> TestDependencyAnalyzer
```

#### 测试选择流程

```
1. PR 变更 ──> 2. TestImpactAnalyzer 分析影响
                        │
                        ▼
3. TestDependencyAnalyzer 查找依赖测试
                        │
                        ▼
4. TestFailurePredictor 预测失败风险
                        │
                        ▼
5. 生成测试计划 ──> 6. 执行测试
                        │
                        ▼
7. 记录结果 ──> 8. 更新历史数据
```

---

### 25. 备份恢复模块 (Backup & Recovery) - 扩展

**路由前缀:** `/api/v1/backup`

#### 功能列表

| 功能 | API 端点 | 描述 |
|------|---------|------|
| **服务控制** |
| 启动服务 | POST /start | 启动备份服务 |
| 停止服务 | POST /stop | 停止备份服务 |
| 健康检查 | GET /health | 服务健康检查 |
| **备份计划** |
| 创建计划 | POST /plans | 创建备份计划 |
| 计划列表 | GET /plans | 获取备份计划列表 |
| 计划详情 | GET /plans/:id | 获取计划详情 |
| 更新计划 | PUT /plans/:id | 更新备份计划 |
| 删除计划 | DELETE /plans/:id | 删除备份计划 |
| 切换计划 | PATCH /plans/:id/toggle | 切换计划状态 |
| **备份执行** |
| 触发备份 | POST /trigger | 触发手动备份 |
| **备份记录** |
| 备份列表 | GET /backups | 获取备份列表 |
| 备份详情 | GET /backups/:id | 获取备份详情 |
| 删除备份 | DELETE /backups/:id | 删除备份 |
| **验证** |
| 验证备份 | POST /backups/:id/verify | 验证备份完整性 |
| 测试恢复 | POST /backups/:id/test-restore | 测试恢复备份 |
| 验证历史 | GET /backups/:id/verifications | 获取验证历史 |
| **恢复计划** |
| 创建恢复计划 | POST /recovery-plans | 创建恢复计划 |
| 恢复计划列表 | GET /recovery-plans | 获取恢复计划列表 |
| 恢复计划详情 | GET /recovery-plans/:id | 获取恢复计划详情 |
| 更新恢复计划 | PUT /recovery-plans/:id | 更新恢复计划 |
| 删除恢复计划 | DELETE /recovery-plans/:id | 删除恢复计划 |
| **恢复执行** |
| 启动恢复 | POST /recovery/:planId/initiate | 启动恢复流程 |
| 执行恢复 | POST /recovery/:executionId/execute | 执行恢复 |
| 时间点恢复 | POST /recovery/:planId/point-in-time | 时间点恢复 |
| 执行列表 | GET /recovery/executions | 获取恢复执行列表 |
| RTO/RPO 统计 | GET /recovery/rto-rpo-stats | 获取 RTO/RPO 统计 |
| **健康监控** |
| 备份状态 | GET /status | 获取备份状态摘要 |
| 存储使用 | GET /storage | 获取存储使用情况 |
| 健康报告 | GET /health-report | 生成健康报告 |
| 执行保留策略 | POST /retention/enforce | 执行保留策略 |

#### 核心组件

```
BackupService ──┬──> BackupScheduler
                │
                ├──> BackupVerifier
                │
                └──> RecoveryService
```

#### 备份恢复流程

```
1. 定时触发/手动触发 ──> 2. BackupService 执行备份
                              │
                              ▼
3. 数据导出 ──> 4. 压缩加密 ──> 5. 存储到 S3
                              │
                              ▼
6. BackupVerifier 验证 ──> 7. 记录元数据

--- 恢复流程 ---

8. 恢复请求 ──> 9. RecoveryService 加载计划
                              │
                              ▼
10. 数据下载 ──> 11. 解密解压 ──> 12. 数据恢复
                              │
                              ▼
13. 验证恢复 ──> 14. 更新状态
```

---

## 三、模块间交互关系

### 3.1 核心交互流程图

```
┌─────────────┐
│   用户操作   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│              API 网关层                   │
└──────┬──────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┬────────────────┐
       ▼                 ▼                 ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Pipeline   │  │  Ticketing  │  │  Monitoring │  │    CMDB     │
│   Engine    │  │   Service   │  │   Service   │  │   Service   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                 │                │
       │                │                 │                │
       ▼                ▼                 ▼                ▼
┌────────────────────────────────────────────────────────────────┐
│                    Event Bus (NATS)                             │
│                                                                 │
│  pipeline.started    ticket.created    alert.triggered         │
│  pipeline.completed  ticket.assigned   metric.updated          │
│  stage.failed        ticket.resolved   incident.detected       │
└────────────────────────────────────────────────────────────────┘
       │                │                 │                │
       │                │                 │                │
       ▼                ▼                 ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│SelfHealing  │  │    FinOps   │  │    Deploy   │  │  Plugin     │
│   Engine    │  │   Service   │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### 3.2 典型业务场景交互

#### 场景 1: 告警触发自愈流程

```
1. Monitoring 检测到异常指标
   │
   ▼
2. 触发 alert.triggered 事件
   │
   ├──────────────┐
   ▼              ▼
3. Ticketing   4. SelfHealing
   创建工单       匹配自愈策略
   │              │
   ▼              ▼
5. 通知工程师    6. 执行修复动作
                  │
                  ▼
                7. 验证修复
                  │
                  ▼
                8. 更新工单状态
```

#### 场景 2: Pipeline 执行流程

```
1. 用户触发 Pipeline
   │
   ▼
2. Pipeline Engine 创建 Run
   │
   ├─> Stage 1 (Build)
   │     │
   │     ├─> Task 1.1: 代码拉取
   │     ├─> Task 1.2: 编译构建
   │     └─> Task 1.3: 单元测试
   │
   ├─> Stage 2 (Test) [依赖 Stage 1]
   │     │
   │     ├─> Task 2.1: 集成测试
   │     └─> Task 2.2: 性能测试
   │
   └─> Stage 3 (Deploy) [依赖 Stage 2]
         │
         ├─> Task 3.1: 部署到测试环境
         └─> Task 3.2: 健康检查
```

#### 场景 3: 成本优化流程

```
1. FinOps 收集资源使用数据
   │
   ▼
2. 计算各实体成本
   │
   ▼
3. 对比预算
   │
   ├─────────────┐
   │             │
   ▼             ▼
4. 正常范围    5. 超预算
                 │
                 ▼
               6. 触发告警
                 │
                 ▼
               7. 创建优化工单
```

---

## 四、前端页面架构

### 4.1 页面列表

| 页面 | 路由 | 功能描述 |
|------|------|----------|
| Dashboard | `/dashboard` | 系统总览仪表盘 |
| PipelineList | `/pipelines` | 流水线列表 |
| PipelineEditor | `/pipelines/:id/edit` | 流水线可视化编辑器 |
| PipelineDetail | `/pipelines/:id` | 流水线详情和执行历史 |
| AlertList | `/alerts` | 告警列表 |
| TicketList | `/tickets` | 工单列表 |
| TicketDetail | `/tickets/:id` | 工单详情 |
| DeploymentList | `/deployments` | 部署列表 |
| DeploymentDetail | `/deployments/:id` | 部署详情 |
| FinOpsDashboard | `/finops` | FinOps 成本仪表盘 |
| PluginManagement | `/plugins` | 插件管理 |

### 4.2 前端 API 集成

```
前端组件 ──> API Client (Axios) ──> 后端 API
                │
                ├── 请求拦截器 (Token 注入)
                │
                └── 响应拦截器 (错误处理)
```

---

## 五、技术栈总结

### 后端技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Fastify |
| 语言 | TypeScript |
| 事件总线 | NATS |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 容器编排 | Kubernetes |
| 对象存储 | S3 |
| 代码托管 | GitLab |
| 监控 | Prometheus |

### 前端技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 |
| 语言 | TypeScript |
| UI 库 | Ant Design |
| 构建工具 | Vite |
| 拖拽库 | @dnd-kit |
| 状态管理 | React Context |
| HTTP 客户端 | Axios |

---

## 六、部署架构

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  Pod 1   │  │  Pod 2   │  │  Pod N   │
       │ Fastify  │  │ Fastify  │  │ Fastify  │
       └────┬─────┘  └────┬─────┘  └────┬─────┘
            │             │             │
            └─────────────┼─────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │PostgreSQL│ │  Redis   │ │   NATS   │
       └──────────┘ └──────────┘ └──────────┘
```

---

## 七、API 端点汇总

| 模块 | 端点数量 | 前缀 |
|------|---------|------|
| Pipeline | 17 | `/api/v1/pipelines` |
| Ticketing | 13 | `/api/v1/tickets` |
| Monitoring | 20+ | `/api/v1/monitoring` |
| FinOps | 25+ | `/api/v1/finops` |
| CMDB | 15+ | `/api/v1/cmdb` |
| Deploy | 10 | `/api/v1/deploy` |
| SelfHealing | 12 | `/api/v1/self-healing` |
| Build | 40+ | `/api/v1/build` |
| CodeRepo | 20+ | `/api/v1/code-repo` |
| Plugin | 10 | `/api/v1/plugins` |
| AI Review | 5 | `/api/v1/ai-review` |
| Diagnostic | 15+ | `/api/v1/diagnostic` |
| Test Selector | 15+ | `/api/v1/test-selector` |
| Backup | 30+ | `/api/v1/backup` |
| AI Security | 5 | `/api/v1/ai-security` |
| Tenant | 8+ | `/api/v1/tenant` |
| AI Gateway | 9+ | `/api/v1/ai-gateway` |
| Alert Management | 9+ | `/api/v1/alert` |
| Audit | 8+ | `/api/v1/audit` |
| Config Management | 25+ | `/api/v1/config` |
| Risk Assessment | 10+ | `/api/v1/risk` |
| Efficiency Analytics | 6+ | `/api/v1/efficiency` |

**总计 API 端点:** 350+

---

## 八、总结

Orion 系统是一个**企业级 DevOps 自动化平台**,包含以下核心能力:

1. **CI/CD 流水线** - 可视化编排、多阶段执行、缓存/产物管理
2. **智能运维** - 监控告警、自愈引擎、工单流转
3. **成本管理** - FinOps 成本追踪、预算控制、ROI 分析
4. **配置管理** - CMDB 配置项、关联关系、资源发现
5. **智能部署** - 金丝雀、蓝绿、滚动更新
6. **代码管理** - Git 集成、分支保护、代码评审
7. **插件扩展** - 插件市场、安全沙箱、SPI 调用
8. **租户管理** - 多租户隔离、配额管理、Namespace 池
9. **AI 网关** - AI 模型路由、降级处理、规则引擎
10. **告警管理** - 告警关联、去重、抑制窗口
11. **审计日志** - 不可逆审计链、完整性验证
12. **配置管理** - GitOps 工作流、变更审批、差异分析
13. **风险评估** - 风险评分、健康检查、风险事件订阅
14. **效能分析** - DORA 指标收集、ClickHouse 分析
15. **诊断 Agent** - AI 诊断、决策树、知识库
16. **测试选择器** - 测试影响分析、失败预测、测试优化
17. **备份恢复** - 备份调度、恢复验证、RTO/RPO 管理

系统采用**事件驱动架构**,通过 NATS 事件总线实现模块解耦，支持水平扩展和高可用部署。
