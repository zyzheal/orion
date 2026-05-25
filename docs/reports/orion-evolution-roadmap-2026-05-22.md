# Orion 平台演进规划

> 创建日期：2026-05-22
> 合并来源：
> - module-expansion-brainstorm-2026-05-22.md（12个可新增模块）
> - function-enhancement-brainstorm-2026-05-22.md（35+功能增强点）
> - new-module-identification-2026-05-22.md（系统缺失模块识别）
> - new-module-identification-2026-05-22-v2.md（修正版，排除已实现功能）

---

## 一、战略级新增模块（P0）

### 1. MLOps 平台

**定位**：AI模型全生命周期管理，从训练到部署的完整流水线。

**核心能力**：
- 模型训练任务管理（支持多种框架）
- 模型版本管理与注册中心
- 模型部署与在线推理服务
- 模型性能监控与漂移检测
- 特征工程与数据版本管理

**差异化**：与现有AI服务深度集成，利用Pipeline引擎编排ML工作流。

**优先级**：P0 | 实施难度：高 | 预计工作量：3人月

---

### 2. FinOps 云成本优化

**定位**：云资源成本透明化与优化引擎。

**核心能力**：
- 多云成本聚合与分摊
- 资源利用率分析（CPU/内存/存储）
- 成本异常检测与告警
- 闲置资源识别与回收建议
- 预算预测与优化建议

**差异化**：利用平台已有的成本数据和监控能力，提供AI驱动的成本优化建议。

**优先级**：P0 | 实施难度：中 | 预计工作量：2人月

---

### 3. Serverless 计算引擎

**定位**：面向事件驱动计算的无服务器能力。

**核心能力**：
- 函数即服务（FaaS）运行时
- 自动弹性伸缩（0到N）
- 事件源绑定（HTTP/Kafka/Timer等）
- 冷启动优化
- 函数版本与灰度发布

**差异化**：基于现有Knative集成，提供更友好的开发者体验。

**优先级**：P0 | 实施难度：高 | 预计工作量：4人月

---

### 4. 多云管理平台

**定位**：统一多云资源的管控平面。

**核心能力**：
- 多云资源统一视图（AWS/阿里云/腾讯云）
- 跨云资源调度与迁移
- 多云网络与安全策略
- 多云合规审计
- 云厂商成本对比与优化

**差异化**：不是替代现有IaC，而是让多云操作可视化、可管理。

**优先级**：P0 | 实施难度：高 | 预计工作量：4人月

---

## 二、功能增强点

### 2.1 智能告警增强

| 增强项 | 当前状态 | 目标状态 |
|--------|---------|---------|
| 智能降噪 | 基于阈值 | 基于AI的异常模式识别 |
| 自动根因分析 | 手动排查 | 关联指标自动定位根因 |
| 告警预测 | 无 | 基于历史数据预测告警趋势 |
| 动态阈值 | 固定阈值 | 基于时序的自适应阈值 |

### 2.2 智能调度增强

| 增强项 | 当前状态 | 目标状态 |
|--------|---------|---------|
| 资源预估 | 固定配置 | 基于历史的资源预测 |
| 优先级调度 | 简单优先级 | 基于SLA的智能调度 |
| 故障自愈 | 基础重试 | 完整自愈策略库 |

### 2.3 智能测试生成

| 增强项 | 当前状态 | 目标状态 |
|--------|---------|---------|
| 用例生成 | 手工编写 | AI基于代码变更生成 |
| 覆盖率优化 | 人工分析 | AI识别未覆盖路径 |
| 回归测试选择 | 全量执行 | 基于变更影响分析 |

### 2.4 智能部署策略

| 增强项 | 当前状态 | 目标状态 |
|--------|---------|---------|
| 灰度策略 | 手动配置 | AI基于指标自动调整 |
| 回滚决策 | 人工判断 | 基于SLA自动回滚 |
| 发布窗口 | 固定时间 | 智能推荐最佳窗口 |

### 2.5 自动化增强

| 增强项 | 当前状态 | 目标状态 |
|--------|---------|---------|
| 自动审批 | 人工审批 | 基于风险评估自动通过 |
| 工单自动分类 | 手动分配 | AI自动分类与路由 |
| 知识库自动更新 | 手动维护 | 基于解决结果自动沉淀 |

---

## 三、全新模块识别（系统完全缺失）

基于对 131 个后端服务的深度能力矩阵分析，以下模块在系统中完全缺失：

### 3.1 P0 级别 - 必须建设

| 模块 | 定位 | 工作量 | 关键能力 |
|------|------|--------|---------|
| **数据库DevOps** | 数据库开发运维一体化 | 2人月 | SQL审核、慢查询分析、敏感数据发现与脱敏 |
| **开发者门户** | API一站式服务平台 | 2人月 | API文档、Mock、SDK生成、订阅管理 |
| **向量存储+RAG** ⚠️能力增强 | AI知识管理增强 | 1.5人月 | 向量存储、语义检索、RAG Pipeline |
| **配额与计费** | 多租户商业化底座 | 2.5人月 | 配额管理、计费引擎、预算控制 |
| **元数据管理** | 企业数据资产目录 | 2人月 | 元数据采集、存储、检索、变更追踪 |
| **完整链路追踪** ⚠️P1 | 全栈可观测性 | 3人月 | Trace采集、存储、可视化、依赖拓扑 |

### 3.2 P1 级别 - 重要建设

| 模块 | 定位 | 工作量 | 关键能力 |
|------|------|--------|---------|
| **数据血缘** | 数据流转可视化 | 3人月 | SQL解析、血缘提取、影响分析 |
| **智能巡检** | 自动化运维巡检 | 2人月 | 巡检任务、报告生成、异常预警 |
| **容量规划** | 智能容量预测 | 2人月 | 趋势预测、成本模拟、扩容建议 |
| **问题管理** | ITSM问题根因管理 | 2人月 | 根因分析、复盘管理、知识沉淀 |
| **AI安全监控** | AI安全保障 | 2人月 | 输入审核、输出审计、敏感检测 |
| **中间件运维** | 中间件可观测性 | 3人月 | Redis/ES/Kafka监控与诊断 |
| **数据质量平台** | 数据质量保障 | 2人月 | 质量规则、评分模型、异常告警 |

### 3.3 P2 级别 - 规划建设

| 模块 | 定位 | 工作量 |
|------|------|--------|
| **发布编排** | 企业级发布协同 | 2人月 |
| **变更影响分析** | 变更风险预检 | 2人月 |

---

## 四、实施路线图

### Phase 1：基础能力构建（第1-3月）

- 数据库DevOps + 开发者门户 + 向量存储+RAG（可并行）
- **里程碑**：SQL审核上线、API门户可用、知识库向量化

### Phase 2：平台运营底座（第3-5月）

- 元数据管理 + 配额与计费 + 智能巡检（可并行）
- **里程碑**：元数据自动采集、配额检查生效、巡检报告自动生成

### Phase 3：可观测性增强（第5-8月）

- 完整链路追踪（需POC验证）
- **里程碑**：Trace数据可查询、服务拓扑图生成

### Phase 4：数据治理体系（第8-11月）

- 数据血缘 + 数据质量 + 中间件运维（可并行）
- **里程碑**：血缘图谱可用、质量评分达标、中间件监控覆盖

### Phase 5：智能化运维（第11-13月）

- 容量规划 + 问题管理 + AI安全监控（可并行）
- **里程碑**：容量预测准确、问题知识沉淀、AI安全合规

### Phase 6：发布与变更安全（第13-15月）

- 发布编排 + 变更影响分析
- **里程碑**：发布流程标准化、变更风险可控

---

## 五、总预计工作量

| 类别 | 模块数 | 总工作量 |
|------|--------|---------|
| 战略级新增 | 4 | 13人月 |
| 功能增强点 | 5类 | 持续迭代 |
| 全新模块识别 | 15 | 33人月 |

**总计**：约 46+ 人月，分布在 6 个实施阶段，总周期 12-15 个月。

---

*文档合并时间：2026-05-22*

---

## 附录A：数据模型设计（来自 original v2 文档）

### A.1 数据库DevOps平台

#### ER图设计

```
┌─────────────────┐       ┌─────────────────┐
│ sql_audit_rule  │       │ sql_audit_task  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:N──│ id (PK)         │
│ rule_name       │       │ rule_id (FK)    │
│ rule_type       │       │ sql_content     │
│ severity        │       │ database        │
│ pattern         │       │ status          │
│ message         │       │ result          │
│ is_enabled      │       │ executed_by     │
│ tenant_id       │       │ executed_at     │
│ created_at      │       │ tenant_id       │
│ updated_at      │       │ created_at      │
                          │ updated_at      │
                          └─────────────────┘

┌──────────────────────┐       ┌─────────────────┐
│ sensitive_data_      │       │ data_masking_   │
│ discovery            │       │ rule            │
├──────────────────────┤       ├─────────────────┤
│ id (PK)              │       │ id (PK)         │
│ database             │       │ rule_name       │
│ table_name           │       │ field_pattern   │
│ column_name          │       │ masking_type    │
│ data_type            │       │ masking_function│
│ sensitivity_level    │       │ is_enabled      │
│ discovered_at        │       │ tenant_id       │
│ tenant_id            │       │ created_at      │
│ created_at           │       │ updated_at      │
│ updated_at           │       └─────────────────┘
└──────────────────────┘
```

#### 核心数据表

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| sql_audit_rule | SQL审核规则定义 | rule_name, rule_type, severity, pattern, message, is_enabled |
| sql_audit_task | SQL审核执行记录 | rule_id, sql_content, database, status, result, executed_by, executed_at |
| sensitive_data_discovery | 敏感数据发现记录 | database, table_name, column_name, data_type, sensitivity_level, discovered_at |
| data_masking_rule | 数据脱敏规则配置 | rule_name, field_pattern, masking_type, masking_function, is_enabled |
| slow_query_record | 慢查询记录 | database, query_text, execution_time, rows_examined, index_used, recorded_at |
| database_instance | 数据库连接信息 | instance_name, host, port, db_type, version, status |

---

### A.2 开发者门户

#### ER图设计

```
┌─────────────────┐       ┌─────────────────┐
│ api_catalog     │       │ api_doc_version │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:N──│ id (PK)         │
│ api_name        │       │ api_id (FK)     │
│ description     │       │ version         │
│ category        │       │ spec_content    │
│ owner           │       │ spec_format     │
│ tenant_id       │       │ release_note    │
│ created_at      │       │ is_published    │
│ updated_at      │       │ tenant_id       │
└─────────────────┘       │ created_at      │
                          │ updated_at      │
┌─────────────────┐       └─────────────────┘
│ api_mock_       │              │
│ instance        │              │
├─────────────────┤              │
│ id (PK)         │              │
│ api_id (FK)     │──────────────┘
│ endpoint        │
│ method          │
│ response_schema │
│ is_active       │
│ tenant_id       │
│ created_at      │
│ updated_at      │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ api_subscription│       │ sdk_generation  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ api_id (FK)     │       │ api_id (FK)     │
│ subscriber_id   │       │ language        │
│ status          │       │ version         │
│ approved_by     │       │ download_url    │
│ approved_at     │       │ status          │
│ tenant_id       │       │ tenant_id       │
│ created_at      │       │ created_at      │
│ updated_at      │       │ updated_at      │
└─────────────────┘       └─────────────────┘

┌─────────────────┐
│ api_usage_stats │
├─────────────────┤
│ id (PK)         │
│ api_id (FK)     │
│ subscriber_id   │
│ call_count      │
│ error_count     │
│ latency_p50     │
│ latency_p99     │
│ date            │
│ tenant_id       │
│ created_at      │
└─────────────────┘
```

#### 核心数据表

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| api_catalog | API目录主表 | api_name, description, category, owner, tenant_id |
| api_doc_version | API文档版本管理 | api_id, version, spec_content, spec_format, release_note, is_published |
| api_mock_instance | Mock服务实例 | api_id, endpoint, method, response_schema, is_active |
| api_subscription | API订阅申请记录 | api_id, subscriber_id, status, approved_by, approved_at |
| sdk_generation | SDK生成记录 | api_id, language, version, download_url, status |
| api_usage_stats | API使用统计 | api_id, subscriber_id, call_count, error_count, latency_p50, latency_p99, date |

---

### A.3 配额与计费系统

#### ER图设计

```
┌─────────────────┐       ┌─────────────────┐
│ quota_template  │       │ tenant_quota    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:N──│ id (PK)         │
│ template_name   │       │ template_id(FK) │
│ quota_type      │       │ tenant_id       │
│ limit_value     │       │ allocated_value │
│ unit            │       │ used_value      │
│ period          │       │ period          │
│ is_default      │       │ effective_from  │
│ tenant_id       │       │ effective_to    │
│ created_at      │       │ tenant_id       │
│ updated_at      │       │ created_at      │
└─────────────────┘       │ updated_at      │
                          └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ quota_usage_log │       │ billing_bill    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ tenant_id       │       │ tenant_id       │
│ quota_id (FK)   │       │ bill_type       │
│ resource_type   │       │ period          │
│ resource_id     │       │ amount          │
│ operation_type  │       │ currency        │
│ usage_delta     │       │ status          │
│ balance_after   │       │ due_date        │
│ recorded_at     │       │ paid_at         │
│ created_at      │       │ tenant_id       │
└─────────────────┘       │ created_at      │
                          │ updated_at      │
                          └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ quota_alert     │       │ billing_rule    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ tenant_id       │       │ rule_name       │
│ quota_id (FK)   │       │ quota_type      │
│ threshold_pct   │       │ price_per_unit  │
│ alert_type      │       │ currency        │
│ is_enabled      │       │ effective_from  │
│ last_triggered  │       │ effective_to    │
│ created_at      │       │ tenant_id       │
│ updated_at      │       │ created_at      │
└─────────────────┘       └─────────────────┘
```

#### 核心数据表

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| quota_template | 配额模板定义 | template_name, quota_type, limit_value, unit, period, is_default |
| tenant_quota | 租户配额分配 | template_id, tenant_id, allocated_value, used_value, period, effective_from, effective_to |
| quota_usage_log | 配额使用记录 | tenant_id, quota_id, resource_type, resource_id, operation_type, usage_delta, balance_after, recorded_at |
| billing_bill | 计费账单 | tenant_id, bill_type, period, amount, currency, status, due_date, paid_at |
| billing_rule | 计费规则 | rule_name, quota_type, price_per_unit, currency, effective_from, effective_to |
| quota_alert | 配额告警配置 | tenant_id, quota_id, threshold_pct, alert_type, is_enabled, last_triggered |

---

### A.4 元数据管理系统

#### ER图设计

```
┌─────────────────┐       ┌─────────────────┐
│ metadata_def    │       │ metadata_value  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:N──│ id (PK)         │
│ entity_type     │       │ definition_id   │
│ field_name      │       │ entity_id       │
│ field_type      │       │ value           │
│ description     │       │ source          │
│ is_required     │       │ collected_at    │
│ data_source     │       │ tenant_id       │
│ tenant_id       │       │ created_at      │
│ created_at      │       │ updated_at      │
│ updated_at      │       └─────────────────┘
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ metadata_task   │       │ metadata_change │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:N──│ id (PK)         │
│ task_name       │       │ value_id (FK)   │
│ task_type       │       │ entity_type     │
│ data_source     │       │ entity_id       │
│ schedule        │       │ field_name      │
│ status          │       │ old_value       │
│ last_run_at     │       │ new_value       │
│ next_run_at     │       │ changed_by      │
│ tenant_id       │       │ changed_at      │
│ created_at      │       │ tenant_id       │
│ updated_at      │       │ created_at      │
└─────────────────┘       └─────────────────┘
```

#### 核心数据表

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| metadata_def | 元数据定义 | entity_type, field_name, field_type, description, is_required, data_source |
| metadata_value | 元数据值存储 | definition_id, entity_id, value, source, collected_at |
| metadata_task | 元数据采集任务 | task_name, task_type, data_source, schedule, status, last_run_at, next_run_at |
| metadata_change | 元数据变更历史 | value_id, entity_type, entity_id, field_name, old_value, new_value, changed_by, changed_at |

---

### A.5 完整链路追踪

#### ER图设计

```
┌─────────────────┐       ┌─────────────────┐
│ trace_meta      │       │ trace_span      │
├─────────────────┤       ├─────────────────┤
│ trace_id (PK)   │──1:N──│ id (PK)         │
│ service_name    │       │ trace_id (FK)   │
│ operation_name  │       │ span_id         │
│ start_time      │       │ parent_span_id  │
│ end_time        │       │ service_name    │
│ duration        │       │ operation_name  │
│ status_code     │       │ span_kind       │
│ tags            │       │ start_time      │
│ tenant_id       │       │ end_time        │
│ created_at      │       │ duration        │
│ updated_at      │       │ status_code     │
└─────────────────┘       │ status_message  │
                          │ tags            │
┌─────────────────┐       │ logs            │
│ trace_sampling  │       │ tenant_id       │
├─────────────────┤       │ created_at      │
│ id (PK)         │       └─────────────────┘
│ service_name    │
│ endpoint        │
│ sampling_rate   │
│ sampling_type   │
│ priority        │
│ is_enabled      │
│ tenant_id       │
│ created_at      │
│ updated_at      │
└─────────────────┘

┌─────────────────┐
│ trace_service   │
├─────────────────┤
│ id (PK)         │
│ service_name    │
│ service_version │
│ environment     │
│ status          │
│ tenant_id       │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

#### 核心数据表

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| trace_meta | Trace元数据 | trace_id, service_name, operation_name, start_time, end_time, duration, status_code, tags |
| trace_span | Span关联数据 | trace_id, span_id, parent_span_id, service_name, operation_name, span_kind, start_time, end_time, duration, status_code, status_message, tags, logs |
| trace_sampling | 采样配置 | service_name, endpoint, sampling_rate, sampling_type, priority, is_enabled |
| trace_service | 服务注册表 | service_name, service_version, environment, status |

---

### A.6 数据血缘系统

#### ER图设计

```
┌─────────────────┐       ┌─────────────────┐
│ lineage_node    │       │ lineage_edge    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ node_type       │       │ source_node_id  │
│ node_name       │       │ target_node_id  │
│ node_sub_type   │       │ edge_type       │
│ data_source     │       │ transform_sql   │
│ database        │       │ field_mapping   │
│ table_name      │       │ confidence      │
│ column_name     │       │ extracted_at    │
│ owner           │       │ tenant_id       │
│ tenant_id       │       │ created_at      │
│ created_at      │       │ updated_at      │
│ updated_at      │       └─────────────────┘
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ lineage_task    │       │ field_lineage   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ task_name       │       │ source_field    │
│ task_type       │       │ target_field    │
│ data_source     │       │ transform_expr  │
│ schedule        │       │ edge_id (FK)    │
│ status          │       │ confidence      │
│ last_run_at     │       │ tenant_id       │
│ next_run_at     │       │ created_at      │
│ nodes_discovered│       └─────────────────┘
│ edges_discovered│
│ tenant_id       │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

#### 核心数据表

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| lineage_node | 血缘节点 | node_type, node_name, node_sub_type, data_source, database, table_name, column_name, owner |
| lineage_edge | 血缘边关系 | source_node_id, target_node_id, edge_type, transform_sql, field_mapping, confidence, extracted_at |
| lineage_task | 血缘任务管理 | task_name, task_type, data_source, schedule, status, last_run_at, nodes_discovered, edges_discovered |
| field_lineage | 字段级血缘 | source_field, target_field, transform_expr, edge_id, confidence |

---

## 附录B：API接口设计（来自 original v2 文档）

### B.1 数据库DevOps平台

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| GET | /api/v1/db-audit/rules | 获取审核规则列表 | 支持分页、按类型/启停筛选 |
| POST | /api/v1/db-audit/rules | 创建审核规则 | 需要权限验证 |
| PUT | /api/v1/db-audit/rules/:id | 更新审核规则 | - |
| DELETE | /api/v1/db-audit/rules/:id | 删除审核规则 | 软删除 |
| POST | /api/v1/db-audit/execute | 执行SQL审核 | 传入SQL内容、目标库 |
| GET | /api/v1/db-audit/tasks | 获取审核任务列表 | 支持分页、状态筛选 |
| GET | /api/v1/sensitive-data/discoveries | 获取敏感数据发现列表 | 支持分页筛选 |
| POST | /api/v1/sensitive-data/discoveries | 触发敏感数据扫描 | 指定数据库范围 |
| GET | /api/v1/data-masking/rules | 获取脱敏规则列表 | - |
| POST | /api/v1/data-masking/rules | 创建脱敏规则 | - |
| POST | /api/v1/data-masking/preview | 预览脱敏效果 | 输入示例数据 |
| GET | /api/v1/db-audit/dashboard/stats | 获取仪表盘统计 | 审核通过率、问题分布 |

#### 查询参数规范

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |
| is_enabled | boolean | 启用状态筛选 |
| rule_type | string | 规则类型：syntax/security/performance |
| severity | string | 严重程度：critical/warning/info |
| database | string | 数据库名称筛选 |
| status | string | 任务状态：pending/running/completed/failed |

---

### B.2 开发者门户

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| GET | /api/v1/developer-portal/apis | 获取API文档列表 | 支持分页、标签筛选 |
| GET | /api/v1/developer-portal/apis/:id | 获取API详情 | 包含所有版本 |
| GET | /api/v1/developer-portal/apis/:id/versions | 获取API版本列表 | - |
| POST | /api/v1/developer-portal/apis/import | 导入API文档 | 支持OpenAPI/Swagger |
| GET | /api/v1/developer-portal/mock/generate | 生成Mock服务 | 根据API规范生成 |
| POST | /api/v1/developer-portal/subscriptions | 提交API订阅申请 | - |
| PUT | /api/v1/developer-portal/subscriptions/:id/approve | 批准订阅申请 | 管理员操作 |
| POST | /api/v1/developer-portal/sdk/generate | 生成SDK | 指定语言和版本 |
| GET | /api/v1/developer-portal/stats/usage | 获取API使用统计 | 支持时间范围筛选 |
| GET | /api/v1/developer-portal/test/online | 在线测试API | 返回测试结果 |

#### 查询参数规范

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |
| tag | string | 标签筛选 |
| keyword | string | 关键字搜索 |
| status | string | 订阅状态：pending/approved/rejected |
| language | string | SDK语言：java/go/python/ts |
| start_date | string | 统计开始日期 |
| end_date | string | 统计结束日期 |

---

### B.3 配额与计费系统

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| GET | /api/v1/billing/templates | 获取配额模板列表 | - |
| POST | /api/v1/billing/templates | 创建配额模板 | - |
| PUT | /api/v1/billing/templates/:id | 更新配额模板 | - |
| DELETE | /api/v1/billing/templates/:id | 删除配额模板 | - |
| GET | /api/v1/billing/quotas | 获取租户配额列表 | 超级管理员查看全部 |
| POST | /api/v1/billing/quotas | 分配配额给租户 | - |
| PUT | /api/v1/billing/quotas/:tenant_id | 调整租户配额 | - |
| GET | /api/v1/billing/quotas/:tenant_id/usage | 获取配额使用详情 | 当前周期 |
| GET | /api/v1/billing/bills | 获取账单列表 | 当前租户 |
| POST | /api/v1/billing/bills/:id/pay | 确认支付 | - |
| GET | /api/v1/billing/alerts | 获取配额告警配置 | - |
| POST | /api/v1/billing/alerts | 创建配额告警 | - |
| GET | /api/v1/billing/summary | 获取配额汇总报表 | 支持导出 |

#### 查询参数规范

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |
| quota_type | string | 配额类型：cpu/memory/storage/api_calls |
| period | string | 周期：daily/monthly/yearly |
| status | string | 账单状态：pending/paid/overdue |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |

---

### B.4 元数据管理系统

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| GET | /api/v1/metadata/definitions | 获取元数据定义列表 | 支持分页、按实体类型筛选 |
| POST | /api/v1/metadata/definitions | 创建元数据定义 | - |
| PUT | /api/v1/metadata/definitions/:id | 更新元数据定义 | - |
| DELETE | /api/v1/metadata/definitions/:id | 删除元数据定义 | 软删除 |
| GET | /api/v1/metadata/values/:entity_type/:entity_id | 获取实体元数据 | - |
| POST | /api/v1/metadata/values | 批量写入元数据 | - |
| GET | /api/v1/metadata/tasks | 获取采集任务列表 | - |
| POST | /api/v1/metadata/tasks | 创建采集任务 | - |
| POST | /api/v1/metadata/tasks/:id/run | 手动触发采集 | - |
| GET | /api/v1/metadata/tasks/:id/history | 获取任务执行历史 | - |
| GET | /api/v1/metadata/changes | 获取变更历史 | 支持分页筛选 |
| GET | /api/v1/metadata/search | 搜索元数据 | 关键字搜索 |

#### 查询参数规范

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |
| entity_type | string | 实体类型：table/api/pipeline/service |
| field_name | string | 字段名筛选 |
| data_source | string | 数据源筛选 |
| task_type | string | 任务类型：database/api/file |
| status | string | 任务状态：idle/running/completed/failed |
| keyword | string | 搜索关键字 |
| start_date | string | 变更开始日期 |
| end_date | string | 变更结束日期 |

---

### B.5 完整链路追踪

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| GET | /api/v1/tracing/traces | 查询Trace列表 | 支持分页、多条件筛选 |
| GET | /api/v1/tracing/traces/:trace_id | 获取Trace详情 | 包含完整Span树 |
| GET | /api/v1/tracing/traces/:trace_id/spans | 获取Trace下所有Span | - |
| GET | /api/v1/tracing/spans/:span_id | 获取Span详情 | - |
| GET | /api/v1/tracing/services | 获取服务列表 | - |
| GET | /api/v1/tracing/services/:service_name/endpoints | 获取服务端点列表 | - |
| GET | /api/v1/tracing/topology | 获取拓扑图数据 | 指定时间范围 |
| GET | /api/v1/tracing/dependencies | 获取依赖关系 | 服务间调用 |
| GET | /api/v1/tracing/duration/stats | 获取耗时统计 | P50/P95/P99 |
| GET | /api/v1/tracing/error/stats | 获取错误统计 | 按服务/端点 |
| GET | /api/v1/tracing/sampling | 获取采样配置 | - |
| POST | /api/v1/tracing/sampling | 创建采样规则 | - |
| PUT | /api/v1/tracing/sampling/:id | 更新采样规则 | - |
| DELETE | /api/v1/tracing/sampling/:id | 删除采样规则 | - |
| GET | /api/v1/tracing/dashboard | 获取追踪仪表盘 | 核心指标汇总 |
| POST | /api/v1/tracing/analyze | 分析调用链 | AI辅助分析 |

#### 查询参数规范

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |
| trace_id | string | Trace ID精确查询 |
| service_name | string | 服务名筛选 |
| operation_name | string | 操作名筛选 |
| start_time | string | 开始时间（ISO8601） |
| end_time | string | 结束时间（ISO8601） |
| duration_min | integer | 最小耗时（毫秒） |
| duration_max | integer | 最大耗时（毫秒） |
| status_code | string | HTTP状态码筛选 |
| error | boolean | 是否包含错误 |
| depth | integer | 链路深度筛选 |

---

### API设计原则

1. **路径命名**：使用 `/api/v1/{domain}/{resource}` 格式
2. **多租户隔离**：所有接口强制要求 `X-Tenant-ID` header（超级管理员除外）
3. **分页规范**：默认 `page=1`, `limit=20`，最大100
4. **时间格式**：ISO8601格式（`2026-05-22T10:00:00Z`）
5. **错误响应**：统一格式 `{ success: false, error: { code, message, details, traceId } }`
6. **速率限制**：查询类 1000次/分钟、写入类 100次/分钟、批量操作 10次/分钟

---

## 附录C：SLA核心指标定义（来自 original v2 文档）

### C.1 P0模块SLA指标

| 模块 | 指标类型 | 指标项 | 目标值 | 说明 |
|------|---------|--------|-------|------|
| 数据库DevOps | 可用性 | 系统可用率 | ≥99.9% | SQL审核、敏感数据发现服务 |
| 数据库DevOps | 性能 | SQL审核响应时间 | P95≤5s | 单次SQL审核处理时间 |
| 数据库DevOps | 性能 | 敏感数据扫描吞吐量 | ≥10000条/分钟 | 大表扫描性能 |
| 数据库DevOps | 错误率 | 审核任务失败率 | ≤0.5% | 审核任务执行失败比例 |
| 开发者门户 | 可用性 | 门户可用率 | ≥99.9% | 文档浏览、Mock服务 |
| 开发者门户 | 性能 | 文档加载时间 | P95≤2s | 页面首次加载 |
| 开发者门户 | 性能 | Mock服务响应时间 | P95≤200ms | Mock接口响应延迟 |
| 开发者门户 | 性能 | SDK生成时间 | ≤60s | 常规语言SDK生成 |
| 开发者门户 | 错误率 | API调用错误率 | ≤1% | 开发者API调用失败率 |
| 向量存储+RAG | 可用性 | 向量检索服务可用率 | ≥99.9% | 相似度查询服务 |
| 向量存储+RAG | 性能 | 向量检索延迟 | P95≤100ms | 10万向量规模检索 |
| 向量存储+RAG | 性能 | RAG生成延迟 | P95≤3s | 完整RAG pipeline |
| 向量存储+RAG | 性能 | 向量写入吞吐量 | ≥5000条/秒 | 批量向量写入 |
| 配额与计费 | 可用性 | 计费服务可用率 | ≥99.95% | 账单计算、配额检查 |
| 配额与计费 | 性能 | 配额检查响应时间 | P95≤50ms | 资源创建前检查 |
| 配额与计费 | 性能 | 账单生成时间 | ≤30s | 月度账单生成 |
| 配额与计费 | 错误率 | 计费计算错误率 | ≤0.01% | 计费金额计算错误 |
| 元数据管理 | 可用性 | 元数据服务可用率 | ≥99.9% | 元数据查询、采集服务 |
| 元数据管理 | 性能 | 元数据查询响应 | P95≤500ms | 复杂查询场景 |
| 元数据管理 | 性能 | 全量扫描时间 | ≤4小时 | 10万级元数据全量扫描 |
| 元数据管理 | 错误率 | 采集任务失败率 | ≤2% | 定时采集任务失败率 |
| 完整链路追踪 | 可用性 | Trace查询服务可用率 | ≥99.9% | Trace数据查询 |
| 完整链路追踪 | 性能 | Trace查询响应时间 | P95≤3s | 单次Trace查询 |
| 完整链路追踪 | 性能 | Trace写入吞吐量 | ≥10000条/秒 | 高并发写入 |
| 完整链路追踪 | 性能 | 拓扑图生成时间 | ≤10s | 服务拓扑数据生成 |
| 完整链路追踪 | 错误率 | Trace数据丢失率 | ≤1% | 高并发下的数据丢失 |
| 完整链路追踪 | 资源 | 存储成本控制 | ≤$0.1/百万Trace | 分层存储成本优化 |

### C.2 P1模块SLA指标

| 模块 | 指标类型 | 指标项 | 目标值 | 说明 |
|------|---------|--------|-------|------|
| 数据血缘 | 可用性 | 血缘服务可用率 | ≥99.5% | 血缘查询服务 |
| 数据血缘 | 性能 | 血缘查询响应 | P95≤2s | 单表血缘查询 |
| 数据血缘 | 性能 | SQL解析吞吐量 | ≥1000条/分钟 | 批量SQL解析 |
| 数据血缘 | 错误率 | 血缘解析准确率 | ≥95% | 自动解析准确度 |
| 智能巡检 | 可用性 | 巡检服务可用率 | ≥99.5% | 巡检任务执行 |
| 智能巡检 | 性能 | 报告生成时间 | ≤30s | 巡检报告生成 |
| 智能巡检 | 错误率 | 巡检任务失败率 | ≤2% | 定时任务异常 |
| 容量规划 | 可用性 | 预测服务可用率 | ≥99.5% | 容量预测服务 |
| 容量规划 | 性能 | 预测计算时间 | ≤5分钟 | 月度容量预测 |
| 容量规划 | 错误率 | 预测模型准确率 | ≥85% | 容量预测准确度 |
| 问题管理 | 可用性 | 问题服务可用率 | ≥99.5% | 问题管理流程 |
| 问题管理 | 性能 | 根因分析时间 | ≤30s | AI辅助根因分析 |
| 问题管理 | 错误率 | 知识关联准确率 | ≥80% | 问题与知识库关联 |
| AI安全监控 | 可用性 | 安全监控服务可用率 | ≥99.9% | AI请求监控 |
| AI安全监控 | 性能 | 请求审核延迟 | P95≤200ms | AI输入输出审核 |
| AI安全监控 | 性能 | 敏感检测吞吐量 | ≥5000条/分钟 | 批量内容检测 |
| AI安全监控 | 错误率 | 误报率 | ≤5% | 安全检测误报 |
| AI安全监控 | 错误率 | 漏报率 | ≤1% | 安全检测漏报 |
| 中间件运维 | 可用性 | 监控服务可用率 | ≥99.9% | 中间件监控 |
| 中间件运维 | 性能 | 指标采集延迟 | ≤10s | 指标从采集到可见 |
| 中间件运维 | 性能 | 告警触发延迟 | ≤30s | 异常检测到告警触发 |
| 中间件运维 | 错误率 | 指标采集完整率 | ≥99.9% | 数据采集完整性 |
| 数据质量 | 可用性 | 质量服务可用率 | ≥99.5% | 数据质量检查 |
| 数据质量 | 性能 | 质量报告生成 | ≤60s | 质量报告生成 |
| 数据质量 | 错误率 | 规则执行失败率 | ≤1% | 质量规则执行异常 |

---

## 附录D：技术选型论证（来自 original v2 文档）

### D.1 向量存储选型（向量存储+RAG引擎）

| 维度 | PgVector | Milvus | Qdrant |
|------|----------|--------|--------|
| **架构** | PostgreSQL 扩展 | 独立分布式系统 | 独立分布式系统（Rust） |
| **部署复杂度** | 极低（复用现有 PG） | 高（需独立集群、etcd、MinIO） | 中（独立进程，支持 Docker） |
| **向量规模** | 百万级（单机） | 十亿级（分布式） | 十亿级（分布式） |
| **检索延迟** | P95 ~50-100ms（10万向量） | P95 ~10-50ms | P95 ~10-50ms |
| **运维成本** | 低（DBA 已有技能） | 高（需专门运维） | 中 |
| **与现有系统集成** | 完美（平台已有 PostgreSQL） | 需新增基础设施 | 需新增基础设施 |
| **事务支持** | 支持（与业务数据同事务） | 不支持 | 不支持 |

**推荐方案：PgVector**

**理由**：
1. Orion 平台已全面使用 PostgreSQL（207 个迁移文件），引入 PgVector 零额外运维成本
2. 当前知识库向量规模预计在十万级，远低于 PgVector 百万级单机上限
3. RAG 场景需要将向量与元数据在同一事务中写入，PgVector 原生支持
4. 当向量规模增长至千万级时，可平滑迁移至 Milvus/Qdrant

**风险与缓解**：
- 风险：向量检索性能随数据量增长下降 → 定期 REINDEX + IVFFlat 索引
- 风险：PG 实例负载增加 → 向量检索配置独立的 connection pool

### D.2 链路追踪存储选型（完整链路追踪）

| 维度 | Elasticsearch | ClickHouse | TimescaleDB |
|------|---------------|------------|-------------|
| **架构** | 分布式文档引擎 | 列式 OLAP 引擎 | PostgreSQL 时序扩展 |
| **写入吞吐** | 高（10万+ spans/s） | 极高（50万+ spans/s） | 中（依赖 PG 单机性能） |
| **查询灵活性** | 高（全文搜索、聚合） | 中（SQL，适合预定义查询） | 高（完整 SQL） |
| **Span 树重建** | 优（天然文档模型） | 中（需 ARRAY JOIN） | 中（需递归 CTE） |
| **分层存储** | 原生支持（ILM） | 支持（TTL + 多磁盘） | 支持（chunk 压缩） |
| **运维复杂度** | 高（JVM、分片管理） | 中（C++，资源敏感） | 低（PG 扩展） |
| **存储成本** | 高（~3x 原始数据） | 低（~1.5x 原始数据，列压缩） | 中（~2x 原始数据） |

**推荐方案：ClickHouse（温/热层）+ PostgreSQL（元数据层）**

**理由**：
1. 链路追踪是典型的高写低读场景（写入:读取 ≈ 100:1），ClickHouse 列式存储批量写入性能最优
2. Trace 数据量大（100 QPS × 10% 采样 × 20 spans/trace），ClickHouse 列压缩比 3-5x
3. **分层架构**：
   - **元数据层（PostgreSQL）**：存储 trace_meta、trace_sampling 等结构化数据
   - **Span 明细层（ClickHouse）**：存储 trace_span 明细数据，列式压缩
   - **归档层（对象存储）**：30 天以上数据导出至 MinIO/OSS

**不选 Elasticsearch 的理由**：存储成本高 2-3 倍，平台无现有 ES 运维经验

**不选 TimescaleDB 的理由**：写入吞吐量无法满足高并发 Trace 场景

**风险与缓解**：
- 风险：ClickHouse 不适合高频小批量写入 → Collector 端批量缓冲（1000 spans 或 5s 触发）
- 风险：ClickHouse 更新/删除能力弱 → Trace 数据为 append-only 场景，不需要更新

### D.3 图数据库选型（数据血缘系统）

| 维度 | Neo4j | NebulaGraph | PostgreSQL（虚拟图） |
|------|-------|-------------|---------------------|
| **查询语言** | Cypher（强大、直观） | nGQL（类 SQL） | SQL（递归 CTE） |
| **图查询性能** | 优（原生图存储） | 优（分布式原生图） | 中（关系型模拟） |
| **分布式扩展** | 仅企业版 | 开源支持 | 不支持 |
| **节点规模** | 社区版 <1000万 | 十亿级 | 百万级（递归 CTE 性能下降） |
| **部署复杂度** | 中（Java） | 中高（多组件） | 极低（复用 PG） |
| **运维成本** | 中 | 高 | 低 |
| **与现有系统集成** | 需新增组件 | 需新增组件 | 零新增 |

**推荐方案：分阶段选型**

| 阶段 | 方案 | 适用条件 |
|------|------|---------|
| Phase 1（0-6月） | PostgreSQL 虚拟图（递归 CTE） | 数据规模 <10万 节点，快速验证 |
| Phase 2（6-12月） | NebulaGraph | 数据规模 >10万 节点，需分布式扩展 |

**理由**：
1. 数据血缘节点初期预计在万级，PostgreSQL 递归 CTE 完全可以支撑
2. 平台已有 PostgreSQL 运维能力，无需引入新组件
3. 平滑迁移路径：Phase 1 建立血缘数据模型和 API 层，Phase 2 替换存储层
4. NebulaGraph 为国产开源项目，符合国内企业技术选型偏好

**不选 Neo4j 的理由**：社区版集群功能需企业版（付费），GPL 协议合规风险

**风险与缓解**：
- 风险：PostgreSQL 递归 CTE 深度 >10 层时性能下降 → 限制血缘查询深度为 5 层
- 风险：迁移至 NebulaGraph 时数据迁移成本高 → Phase 1 设计抽象存储接口

---

## 附录E：部署架构设计（来自 original v2 文档）

### E.1 模块部署模式汇总

| 模块 | 部署模式 | 独立服务名 | 依赖特殊组件 |
|------|---------|-----------|-------------|
| 数据库DevOps | 内嵌+未来可拆分 | orion-dbops-service | SQL解析库 |
| 开发者门户 | 前端子模块+后端 | orion-portal-service | SDK生成工具 |
| 配额与计费 | 单体内嵌 | 嵌入platform-service | 定时任务 |
| 元数据管理 | 内嵌+未来可拆分 | orion-metadata-service | 采集Agent |
| 完整链路追踪 | 内嵌+未来可拆分 | orion-tracing-service | ClickHouse |
| 数据血缘 | 内嵌+未来可拆分 | orion-lineage-service | 图数据库 |

### E.2 资源估算汇总

| 环境 | 总CPU | 总内存 | 总存储 | 特殊组件 |
|------|-------|--------|--------|---------|
| 开发/测试 | 14核 | 24GB | 200GB | 共享现有组件 |
| 生产 | 36核 | 64GB | 4TB | NebulaGraph/ClickHouse |

### E.3 高可用设计要点

| 模块 | 高可用策略 |
|------|-----------|
| 数据库DevOps | 多实例部署 + Redis Cluster 任务队列 + 审核超时30s |
| 开发者门户 | CDN缓存 + Mock服务隔离 + SDK生成异步化 |
| 配额与计费 | 与主服务共存 + Redis 缓存配额检查 + 计费幂等 + Saga补偿 |
| 元数据管理 | 分布式采集 + 单数据源隔离 + Redis 缓存（目标命中率>80%） |
| 完整链路追踪 | 3+ Collector实例 + ClickHouse 3节点集群 + 高负载自动降采样 |
| 数据血缘 | PostgreSQL 虚拟图（初期）→ NebulaGraph 因果集群 |

---

## 附录F：用户故事矩阵（来自 original v2 文档）

### F.1 数据库DevOps平台

| 角色 | 用户故事 | 预期结果 |
|------|---------|---------|
| DBA | 在SQL提交前自动审核，提前发现性能问题 | SQL审核结果即时返回，明确指出问题和建议 |
| 开发者 | 自助提交SQL审核，获得优化建议 | 审核结果包含索引建议、执行计划分析、改写建议 |
| 安全工程师 | 自动发现数据库中的敏感数据 | 扫描结果列出敏感字段位置、敏感度等级、处理建议 |
| 运维工程师 | 查看数据库性能仪表盘 | 仪表盘展示慢查询排行、连接数、缓存命中率等 |
| DBA | 配置数据脱敏规则，开发环境使用脱敏数据 | 脱敏规则配置后，查询结果自动脱敏展示 |

### F.2 开发者门户

| 角色 | 用户故事 | 预期结果 |
|------|---------|---------|
| 内部开发者 | 浏览API文档并在线测试 | 文档完整、支持在线调试、返回真实测试结果 |
| 合作伙伴 | 申请订阅API并获取SDK | 订阅申请可提交、审批状态可查、SDK可下载 |
| API提供者 | 导入OpenAPI规范并自动生成文档 | 规范导入后自动生成完整文档、可版本管理 |
| 技术经理 | 查看API使用统计 | 使用统计包含调用量、错误率、响应时间分布 |
| 运维工程师 | 为API创建Mock服务 | Mock服务一键生成、返回示例数据、可自定义响应 |

### F.3 向量存储与RAG引擎

| 角色 | 用户故事 | 预期结果 |
|------|---------|---------|
| AI开发者 | 将知识库内容向量化 | 知识库内容自动向量化、存储在向量数据库中 |
| 运维工程师 | 通过自然语言搜索运维知识 | 语义搜索返回相关文档、标注引用来源 |
| 智能客服 | 基于RAG生成回复 | RAG生成的回复包含引用来源、可追溯 |
| 数据工程师 | 管理向量索引 | 索引状态可查看、可手动触发重建 |

### F.4 配额与计费系统

| 角色 | 用户故事 | 预期结果 |
|------|---------|---------|
| 平台运营 | 配置租户配额模板 | 模板配置包含CPU、内存、存储、API调用等维度 |
| 租户管理员 | 查看当前配额使用情况 | 配额使用仪表盘展示各项资源使用比例、趋势 |
| 开发者 | 了解资源创建时的配额限制 | 创建资源前显示配额检查结果、剩余额度 |
| 财务人员 | 查看月度账单 | 账单包含明细、汇总、支持导出 |

### F.5 元数据管理系统

| 角色 | 用户故事 | 预期结果 |
|------|---------|---------|
| 数据工程师 | 自动采集数据库表结构元数据 | 元数据自动从CMDB同步、包含表结构、字段信息 |
| 数据管理员 | 搜索数据资产 | 关键字搜索返回相关资产列表、标注类型和位置 |
| 开发者 | 查看数据资产的血缘关系 | 血缘图展示上游来源和下游影响 |
| 审计人员 | 查看元数据变更历史 | 变更记录包含变更人、变更时间、变更内容 |

### F.6 完整链路追踪

| 角色 | 用户故事 | 预期结果 |
|------|---------|---------|
| 后端开发者 | 查看单个请求的完整调用链 | Trace详情展示完整的Span树、耗时分布、错误信息 |
| SRE | 查看服务间的依赖拓扑 | 拓扑图展示服务调用关系、调用量、错误率 |
| 运维工程师 | 按服务统计性能指标 | 性能报表包含P50/P95/P99延迟、错误率、吞吐量 |
| SRE | 配置Trace采样策略 | 采样规则可按服务、接口、错误条件配置 |
| 后端开发者 | AI辅助分析调用链 | AI分析返回可疑点建议、优化建议 |

---

## 附录G：专家评审意见汇总（来自 original v2 文档）

### G.1 架构维度评审（评分：8/10）

| 问题类型 | 模块 | 问题描述 | 建议 |
|----------|------|---------|------|
| **重复识别** | 向量存储+RAG | ai服务已包含VectorStore/Embedding能力 | 调整为"能力增强"而非全新模块 ✅ |
| **依赖错误** | 元数据、数据血缘、数据质量 | 依赖不存在的data-governance服务 | 明确标注为"需新建服务" ✅ |
| **边界模糊** | 配额与计费 vs pipeline-budget | 功能有重叠 | 明确边界或整合 |
| **服务不存在** | observability | 现有服务功能不匹配 | 明确是新建还是扩展 |

### G.2 安全合规评审（评分：6.5/10）

| 法规要求 | 覆盖情况 | 缺失 |
|----------|---------|------|
| 敏感数据处理 | 部分覆盖 | 脱敏算法、数据分类分级 |
| 个人信息保护法 | **未覆盖** | 向量数据PII处理、删除机制 |
| 审计日志 | 部分覆盖 | 存储周期（建议≥180天）、完整性保护 |
| 权限控制 | 部分覆盖 | 超级管理员bypass、子租户权限归属 |

### G.3 分布式事务风险

| 模块 | 事务场景 | 建议方案 |
|------|---------|---------|
| 配额与计费 | 资源创建+配额占用 | Saga编排+补偿job |
| 数据血缘 | 多SQL解析+图写入 | 最终一致性+异常记录 |
| 元数据管理 | 多数据源采集+存储 | 增量同步+定时对账 |

### G.4 综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **数据模型设计** | 5/10 | 命名规范严重不一致，关键表/字段缺失 |
| **API接口设计** | 6/10 | RESTful风格基本正确，但与现有系统风格不一致 |
| **部署架构设计** | 7/10 | 框架完整，但与现有部署策略矛盾 |
| **技术选型论证** | 8.5/10 | 三大核心选型论证充分 |
| **SLA指标定义** | 7/10 | P0/P1定义完整，P2缺失 |
| **总体评分** | **7.1/10** | 整体质量良好，安全合规设计偏弱 |

### G.5 修正优先级

#### P0 修正（阻塞详细设计）
1. 统一命名规范：ER图字段 snake_case
2. 修复数据错误：TenantQuota重复字段、第六章编号重复
3. 补充核心表：api_catalog、database_instance、api_mock_instance
4. 统一API风格：分页参数、错误响应格式、路径前缀
5. 解决技术方案矛盾：第10章与第11章存储选型统一
6. 修正部署模式：按"默认内嵌+未来可拆分"策略重写

#### P1 修正（建议修正）
1. 补充P1模块数据模型（至少ER图级别）
2. 补充P1模块用户故事矩阵
3. 补充data-governance服务定义或合并到元数据管理
4. 补充健康检查、扩缩容、CI/CD设计
5. 补充安全设计专章
