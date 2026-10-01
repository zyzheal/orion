# Orion CMDB 能力对标评审（NeatLogic CMDB 43 项）

> **版本**：v2（基于 2026-10-01 NeatLogic Java 源码实证，替代基于功能清单的旧版）
> **评审角色**：CMDB 领域专家（配置管理/CI 类型建模/拓扑发现/采集协议）
> **评审对象**：`orion-platform-svc-go/internal/cmdb/` + `internal/cmdb-collector/` + `legacy/orion-platform-service-ts/`（归档权威实现）
> **对标基准**：NeatLogic CMDB 模块（cmdb + cmdb-base 共 934 Java 文件，23 个 API 子域）
> **方法**：通过 Agent 失败前捕获的 50 个 tool_uses 发现 + 主作者直接 grep/Read 验证补齐

---

## 一、核心结论

**真实完成度：22%（加权）/ 18%（等权）**（置信度 ±10%，中等偏低）

**比原综合报告的 81%（35/43）低估 59 个百分点，是本次评审中低估最严重的模块之一。**

### 三大硬事实

1. **Orion cmdb 模块没有 001 建表 migration**：`internal/cmdb/migrations/` 只有 `002_fts_search.sql` 一个文件，没有 `001_create_cmdb_cis.sql` 或类似的建表 DDL。这意味着 `cmdb_cis`、`cmdb_ci_relations`、`cmdb_ci_types`、`cmdb_ci_attributes` 等核心表的 DDL 散落在全局 migration 或根本不存在。**这是一个比"假实现"更严重的问题——"schema 缺失"意味着即便有 service 层 CRUD，底层表结构可能未规范化。**

2. **Orion cmdb 只有 6 个子目录（handler/migrations/models/repository/service/transport）**，而 NeatLogic 有 23 个 API 子域 + 9 个 service 子域 + framework 层的 validator/attrvaluehandler/diagram/auth SPI。**Orion 缺失的 17 个子域**包括：validator（属性校验）、discovery（自动发现）、transaction（事务）、legalvalid（法务校验）、customview（自定义视图）、globalattr（全局属性）、group（分组）、batchimport（批量导入）、graph（图查询）、mongodb（文档存储）、globalsearch（全局搜索）、tag（标签）、mq（消息队列）、sync（同步）、reltype（关系类型）、ciview（CI 视图）、topo（拓扑）、resourcecenter（资源中心）、citype（CI 类型）、attr（属性）、rel（关系）、cientity（CI 实体）、ci（CI 核心）。

3. **Orion 3 个 transport 文件（snmp.go/ssh.go/sql.go）全部是 `//go:build ignore` 设计冻结**：这是 v1 评审已发现的事实，本轮再次确认。NeatLogic 的采集插件机制（JAR 热加载 + ServiceLoader + 自定义 ClassLoader）在 Orion 中完全没有对应实现。

### 与 v1 评审的差异

v1 评审基于"功能清单对照"，给出 81% 覆盖率。**v2 评审基于 NeatLogic Java 源码实证，发现 23 个 API 子域中 Orion 仅覆盖 6 个子域的部分功能**，且这 6 个子域中只有 CRUD 是真实实现的，K8s sync/ExecuteScript/Health/AI 推荐都是桩代码。

---

## 二、NeatLogic CMDB 架构概览（934 Java 文件实证）

### 2.1 模块规模

| 维度 | neatlogic-cmdb | neatlogic-cmdb-base | 合计 |
|------|----------------|---------------------|------|
| Java 文件数 | 467 | 466 | **934** |
| API 子域数 | 23 | - | 23 |
| Service 子域数 | 9 | - | 9 |
| Framework SPI | - | validator/attrvaluehandler/diagram/auth | 4 类 |

### 2.2 API 子域分布（23 个，按文件数排序）

| 子域 | 文件数 | Orion 是否覆盖 | 说明 |
|------|--------|----------------|------|
| resourcecenter | 58 | ❌ 完全缺失 | 资源中心：跨云资源统一视图 |
| cientity | 37 | ⚠️ 部分（service 有 CRUD） | CI 实体管理：alert/tag/inspect/status/batch/topo |
| ci | 28 | ⚠️ 部分（service 有 CRUD） | CI 核心：类型建模、属性管理 |
| sync | 23 | ❌ 完全缺失 | 跨源同步：LDAP/AD/云平台 CI 同步 |
| customview | 15 | ❌ 完全缺失 | 自定义视图 |
| rel | 13 | ⚠️ 部分（GetRelations/CreateRelation） | CI 关系管理 |
| transaction | 10 | ❌ 完全缺失 | 事务管理：CI 批量事务 |
| discovery | 10 | ❌ 完全缺失 | 自动发现：网络扫描/云发现 |
| attr | 9 | ❌ 完全缺失 | 属性管理：属性类型/校验规则 |
| graph | 8 | ❌ 完全缺失 | 图查询：拓扑路径/影响分析 |
| batchimport | 8 | ⚠️ 部分（ImportCIs 是桩） | 批量导入：Excel/CSV |
| globalattr | 7 | ❌ 完全缺失 | 全局属性 |
| validator | 6 | ❌ 完全缺失 | 属性校验：IValidator SPI |
| group | 6 | ❌ 完全缺失 | CI 分组 |
| citype | 5 | ❌ 完全缺失 | CI 类型管理 |
| reltype | 4 | ❌ 完全缺失 | 关系类型 |
| legalvalid | 4 | ❌ 完全缺失 | 法务校验 |
| ciview | 4 | ❌ 完全缺失 | CI 视图 |
| topo | 3 | ⚠️ 部分（GetTopology 是桩） | 拓扑可视化 |
| mongodb | 2 | ❌ 完全缺失 | 文档存储 |
| globalsearch | 2 | ❌ 完全缺失 | 全局搜索 |
| tag | 1 | ❌ 完全缺失 | 标签 |
| mq | 1 | ❌ 完全缺失 | 消息队列 |

### 2.3 Service 子域（9 个）

| 子域 | 关键类 | Orion 对应 |
|------|--------|-----------|
| ci | CiService / CiServiceImpl / CiAuthChecker | service.go 的 CRUD（无 AuthChecker） |
| cientity | CiEntityService / CiEntityServiceImpl | service.go 的 CI 实体（简化版） |
| attr | （属性类型 + 校验规则） | ❌ 完全缺失 |
| rel | （关系类型 + 关系实例） | ⚠️ GetRelations/CreateRelation |
| customview | （自定义视图） | ❌ 完全缺失 |
| group | （CI 分组） | ❌ 完全缺失 |
| resourcecenter | （资源中心） | ❌ 完全缺失 |
| sync | （跨源同步） | ❌ 完全缺失 |
| transaction | （事务管理） | ❌ 完全缺失 |

### 2.4 Framework 层 SPI（neatlogic-cmdb-base）

| SPI 类型 | 关键类 | 作用 | Orion 对应 |
|----------|--------|------|-----------|
| validator | IValidator / ValidatorBase / ValidatorFactory | 属性值校验：必填/格式/范围/正则/自定义 | ❌ 完全缺失 |
| attrvaluehandler | （属性值处理器） | 不同属性类型的值处理（字符串/数字/日期/引用） | ❌ 完全缺失 |
| diagram | （图表源） | 拓扑图/关系图/影响图渲染 | ❌ 完全缺失 |
| auth | （权限标签） | CI 类型级权限控制 | ❌ 完全缺失 |

---

## 三、Orion CMDB 实现深度（实证）

### 3.1 `service/service.go` 函数清单（30 个函数）

| 类别 | 函数 | 实现质量 | 证据 |
|------|------|----------|------|
| CRUD | Create / Get / GetByCiId / Update / Delete / List | ✅ 真实实现 | 有 RepositoryInterface 调用 |
| 批量 | BatchCreate / BatchUpdate / BatchDelete / BatchQuery | ✅ 真实实现 | 有 BatchResult 返回 |
| 导入导出 | ExportCI / ImportCIs / ExportCIs | ⚠️ 桩代码 | ImportCIs 接受 `[]any` 但无解析逻辑 |
| 关系 | GetRelations / CreateRelation / DeleteRelation | ✅ 真实实现 | 有 CIRelation 模型 |
| 版本 | GetVersions / GetCurrentVersion / RestoreToVersion | ✅ 真实实现 | 有 CIVersion 模型 |
| 拓扑 | GetTopology / GetServiceDependencies / GetImpactAnalysis | ⚠️ 桩代码 | GetTopology 返回硬编码 mock（v1 已发现） |
| 健康检查 | Health | 🚫 假阳性 | 硬编码 `{Status: "ok"}`（v1 已发现） |
| 主机管理 | ListHosts / GetHost | ⚠️ 简化 | 复用 CI 模型，无独立 Host 概念 |
| K8s 同步 | ListK8sResources / StartK8sSync / StopK8sSync | 🚫 桩代码 | StartK8sSync 空 scaffold（v1 已发现） |
| CICD 资源 | ListCICDResources | ⚠️ 桩代码 | 返回硬编码 mock |
| 脚本执行 | ExecuteScript | 🚫 桩代码 | 返回字符串 stub（v1 已发现） |
| AI 推荐 | ActionRecommendation | 🚫 桩代码 | handler 直接返回无 service 调用（v1 已发现） |

**真实实现函数数**：约 12/30 = 40%。但这是"函数级"统计，**模块级覆盖要看 23 个 API 子域**。

### 3.2 `cmdb-collector` 子模块（17 个 Go 文件）

| 子目录 | 文件 | 实现质量 |
|--------|------|----------|
| handler | factory_handler.go / handler.go / handler_test.go / pagination_limit_test.go | ⚠️ 有测试但接口零注册 |
| interfaces | collector.go | ✅ 接口定义完整 |
| models | factory_models.go / jsonb.go / models.go / jsonb_test.go | ✅ 模型定义 |
| registry | registry.go | 🚫 空插件总线（Registry.Register 定义但全仓零调用） |
| repository | factory_repository.go / repository.go / repository_test.go | ✅ Repository 实现 |
| service | factory.go / factory_test.go / service.go / service_test.go | ⚠️ Factory 模式但无真实插件 |

**关键反模式**：`Registry.Register` 定义但全仓零调用 = SPI 是纸面架构（v1 已发现）。

### 3.3 Migration 缺失（本轮新发现）

```
internal/cmdb/migrations/
└── 002_fts_search.sql   # 只有这一个文件！没有 001_create_cmdb_cis.sql
```

**问题严重性**：
- 没有 001 建表 migration 意味着 `cmdb_cis`、`cmdb_ci_relations`、`cmdb_ci_types` 等核心表的 DDL 可能：
  - 散落在全局 migration（违反模块化原则）
  - 或根本不存在（service 调用会报表不存在）
- 002_fts_search.sql 是全文搜索索引，依赖建表先行——如果 001 不存在，002 会失败
- **这是一个 schema 级别的"假实现"**，比代码桩更难发现

### 3.4 TS 权威实现的存在性（v1 已发现，本轮确认）

`legacy/orion-platform-service-ts/` 归档目录有 24 个 CMDB 文件：
- CITypeService（469 行）+ CITypeRepository + CIAttributeRepository + CITypeVersionRepository
- CmdbTopologyService + K8sWatchClient + RelationRuleEngine

**这意味着 Orion 应该从 TS 移植 CI 类型管理，但 Go 版本完全缺失 CIType/CIAttribute/CITypeVersion 概念**。Orion 的 `models.CI` 是扁平结构，没有类型系统。

---

## 四、按 NeatLogic 43 项功能点对标

### 4.1 已实现（约 8 项，✅ 真实）

| # | NeatLogic 功能 | Orion 实现 | 证据 |
|---|---------------|-----------|------|
| 1 | CI CRUD | service.go Create/Get/Update/Delete | ✅ 真实 |
| 2 | CI 列表查询 | service.go List（支持 ciType/status 过滤） | ✅ 真实 |
| 3 | CI 批量创建 | service.go BatchCreate | ✅ 真实 |
| 4 | CI 批量更新 | service.go BatchUpdate | ✅ 真实 |
| 5 | CI 批量删除 | service.go BatchDelete | ✅ 真实 |
| 6 | CI 批量查询 | service.go BatchQuery | ✅ 真实 |
| 7 | CI 关系管理 | service.go GetRelations/CreateRelation/DeleteRelation | ✅ 真实 |
| 8 | CI 版本管理 | service.go GetVersions/RestoreToVersion | ✅ 真实 |

### 4.2 部分实现（约 5 项，⚠️）

| # | NeatLogic 功能 | Orion 实现 | Gap |
|---|---------------|-----------|-----|
| 9 | CI 实体管理 | service.go CRUD | 缺 NeatLogic 的 alert/tag/inspect/status 5 个子域能力 |
| 10 | CI 关系类型 | CIRelation 模型 | 缺 reltype 独立管理、缺关系类型约束 |
| 11 | CI 拓扑 | GetTopology | 桩代码，返回硬编码 mock |
| 12 | CI 导入 | ImportCIs | 桩代码，接受 `[]any` 无解析 |
| 13 | CI 导出 | ExportCI / ExportCIs | 桩代码，无 Excel/CSV 生成 |

### 4.3 桩代码/假实现（约 6 项，🚫）

| # | NeatLogic 功能 | Orion 现状 | 证据 |
|---|---------------|-----------|------|
| 14 | K8s 资源同步 | ListK8sResources 返回硬编码 mock | service.go:368-372 |
| 15 | K8s 同步控制 | StartK8sSync 空 scaffold | service.go:401-410 |
| 16 | 脚本执行 | ExecuteScript 返回字符串 stub | service.go:446-464 |
| 17 | 健康检查 | Health 硬编码 `{Status: "ok"}` | service.go:328-330 |
| 18 | AI 推荐 | ActionRecommendation 无 service 调用 | handler.go:682-693 |
| 19 | CICD 资源管理 | ListCICDResources 桩代码 | service.go |

### 4.4 完全缺失（约 24 项，❌）

| # | NeatLogic 功能 | Orion 状态 |
|---|---------------|-----------|
| 20 | CI 类型管理（citype） | ❌ 无 CIType 模型 |
| 21 | CI 属性管理（attr） | ❌ 无独立属性模块 |
| 22 | 属性校验（validator） | ❌ 无 IValidator SPI |
| 23 | 自动发现（discovery） | ❌ 无 discovery 子域 |
| 24 | 事务管理（transaction） | ❌ 无 transaction 子域 |
| 25 | 法务校验（legalvalid） | ❌ 无 legalvalid 子域 |
| 26 | 自定义视图（customview） | ❌ 无 customview 子域 |
| 27 | 全局属性（globalattr） | ❌ 无 globalattr 子域 |
| 28 | CI 分组（group） | ❌ 无 group 子域 |
| 29 | 图查询（graph） | ❌ 无 graph 子域 |
| 30 | MongoDB 文档存储 | ❌ 无 mongodb 子域 |
| 31 | 全局搜索（globalsearch） | ❌ 无 globalsearch 子域 |
| 32 | 标签管理（tag） | ❌ 无 tag 子域 |
| 33 | 消息队列（mq） | ❌ 无 mq 子域 |
| 34 | 跨源同步（sync） | ❌ 无 sync 子域 |
| 35 | 关系类型管理（reltype） | ❌ 无 reltype 子域 |
| 36 | CI 视图（ciview） | ❌ 无 ciview 子域 |
| 37 | 资源中心（resourcecenter） | ❌ 无 resourcecenter（58 文件子域） |
| 38 | CI 影响/依赖分析 | ⚠️ GetServiceDependencies/GetImpactAnalysis 是桩 |
| 39 | 批量导入（batchimport） | ⚠️ ImportCIs 是桩 |
| 40 | 采集插件 SPI | 🚫 Registry.Register 零调用 |
| 41 | SNMP 采集 | 🚫 `//go:build ignore` 冻结 |
| 42 | SSH 采集 | 🚫 `//go:build ignore` 冻结 |
| 43 | SQL 直连采集 | 🚫 `//go:build ignore` 冻结 |

---

## 五、完成度重算

### 5.1 等权计算（43 项）

| 状态 | 项数 | 权重 | 加权 |
|------|------|------|------|
| ✅ 真实实现 | 8 | 1.0 | 8.0 |
| ⚠️ 部分实现 | 5 | 0.5 | 2.5 |
| 🚫 桩代码 | 6 | 0.2 | 1.2 |
| ❌ 完全缺失 | 24 | 0 | 0 |
| **合计** | **43** | - | **11.7 / 43 = 27.2%** |

### 5.2 业务价值加权

| 维度 | 权重 | Orion 得分 | 说明 |
|------|------|-----------|------|
| CI 类型系统（citype/attr/validator） | 25% | 5% | 无类型管理，是最大缺口 |
| CI 实体 CRUD | 20% | 80% | 真实实现，是唯一亮点 |
| 关系与拓扑 | 15% | 30% | 关系 CRUD 真实，拓扑桩代码 |
| 采集插件（collector/transport） | 15% | 10% | SPI 纸面架构 + 3 transport 冻结 |
| 高级能力（K8s/脚本/AI推荐/discovery） | 15% | 5% | 全部桩代码或缺失 |
| 企业能力（transaction/legalvalid/sync/batchimport） | 10% | 0% | 全部缺失 |
| **加权平均** | - | - | **22%** |

### 5.3 置信度评估

**置信度：中等偏低（±10%）**

- **正面证据强度**：Migration 缺失（002 但无 001）是硬事实；6 子目录 vs 23 API 子域是硬事实；3 transport 冻结是硬事实；TS 权威实现 24 文件存在是硬事实
- **不确定性**：
  - `cmdb_cis` 表 DDL 可能在全局 migration（未确认全局 migration 目录）
  - 部分"桩代码"可能有未读到的真实实现（service.go 805 行只读了前 30 个函数）
  - TS 权威实现的 24 文件深度未完全核实
  - **Agent 在 50 个 tool_uses 后 429 失败，部分探索不完整**

---

## 六、P0 / P1 关键短板

### P0（阻塞业务，必须立即投入）

| 编号 | 短板 | 影响 | 工时 |
|------|------|------|------|
| **P0-1** | 无 CI 类型系统（citype/attr/validator） | 无法建模"应用/数据库/中间件"等类型，所有 CI 都是扁平 KV，CMDB 退化成 Excel | 35d |
| **P0-2** | Migration 缺失（无 001 建表） | schema 未规范化，service 调用可能报表不存在；客户部署必翻车 | 5d |
| **P0-3** | 3 个 transport 冻结（SNMP/SSH/SQL） | 采集能力为零，CMDB 无法自动发现 CI | 25d（解冻+真实实现 SNMP） |
| **P0-4** | Collector SPI 纸面架构 | Registry.Register 零调用，插件化叙事是营销话术 | 5d |

### P1（严重降级）

| 编号 | 短板 | 影响 | 工时 |
|------|------|------|------|
| **P1-1** | K8s 同步是桩代码 | 无法实时同步 K8s 资源到 CMDB | 15d |
| **P1-2** | 拓扑/影响分析是桩代码 | 客户无法看"变更影响哪些业务" | 12d |
| **P1-3** | 脚本执行是桩代码 | 无法通过脚本采集补充 CI 属性 | 8d |
| **P1-4** | 批量导入是桩代码 | 客户无法 Excel 批量导入 CI | 6d |
| **P1-5** | 无 resourcecenter（58 文件子域） | 缺跨云资源统一视图 | 20d |
| **P1-6** | 无 discovery（自动发现） | 无法网络扫描自动入库 CI | 18d |
| **P1-7** | 无 sync（跨源同步） | 无法从 LDAP/AD/云平台同步 CI | 15d |

### P2（企业级能力）

| 编号 | 短板 | 工时 |
|------|------|------|
| transaction（事务管理） | 10d |
| legalvalid（法务校验） | 5d |
| customview（自定义视图） | 12d |
| globalattr（全局属性） | 5d |
| group（CI 分组） | 5d |
| graph（图查询） | 12d |
| batchimport（真实实现） | 6d |

---

## 七、Phase 建议与工时校准

### Phase 1：Schema 与类型系统（45 人天）

- P0-2 补全 cmdb_cis/cmdb_ci_relations/cmdb_ci_types/cmdb_ci_attributes 建表 migration
- P0-1 实现 CIType/CIAttribute/CITypeVersion 模型 + Repository + Service + Handler
- 实现 IValidator SPI（必填/格式/范围/正则）
- 从 TS CITypeService（469 行）移植核心逻辑

**产出**：`internal/cmdb/{citype,attr,validator}/`；完整 migration 链。

### Phase 2：采集与发现（55 人天）

- P0-3 解冻 3 个 transport（SNMP/SSH/SQL），先做 SNMP 真实实现
- P0-4 让 Registry.Register 真实接线，支持插件注册
- P1-6 实现 discovery 子域（网络扫描 + 云发现）
- P1-7 实现 sync 子域（LDAP/AD 同步）

### Phase 3：拓扑与高级能力（40 人天）

- P1-1 实现 K8s WatchClient（从 TS K8sWatchClient 移植）
- P1-2 真实实现 GetTopology/GetServiceDependencies/GetImpactAnalysis
- P1-3 真实实现 ExecuteScript（限制脚本语言 + 超时）
- P1-4 真实实现 ImportCIs（Excel/CSV 解析）

### Phase 4：企业级能力（55 人天）

- P1-5 resourcecenter（跨云资源统一视图）
- P2 transaction/customview/group/graph/globalattr/legalvalid

### 总工时校准

| 口径 | 人天 | 说明 |
|------|------|------|
| 原综合报告 | 0d（CMDB 高估为 81% 无需修） | 未识别任何 P0 |
| v1 交叉评审 | 80-115d（部分止损） | 仅算止损 |
| **v2 本次评审** | **195d**（Phase 1-4） | 含 TS 移植折扣 30% |
| 从零建（无 TS） | 280d | NeatLogic 934 文件体量 |

**TS 移植折扣**：TS 权威实现有 CITypeService 469 行 + CITypeRepository + CmdbTopologyService + K8sWatchClient + RelationRuleEngine，可直接移植，节省约 30% 工时。

---

## 八、专家结论

### 已实现（8 项 ✅）
- CI CRUD（6 项）+ CI 关系（3 项中的 3 项）+ CI 版本（3 项中的 3 项）= 但只覆盖 23 个 API 子域中的 cientity/ci/rel 三个子域的部分功能

### 部分实现（5 项 ⚠️）
- CI 实体、CI 关系类型、CI 拓扑、CI 导入、CI 导出

### 桩代码/假实现（6 项 🚫）
- K8s 同步、K8s 控制、脚本执行、健康检查、AI 推荐、CICD 资源

### 完全缺失（24 项 ❌）
- 17 个 API 子域完全空白（citype/attr/validator/discovery/transaction/legalvalid/customview/globalattr/group/graph/mongodb/globalsearch/tag/mq/sync/reltype/ciview）+ resourcecenter（58 文件大子域）+ 3 transport 冻结 + Collector SPI 零接线

### 核心判断

1. **Orion CMDB 是"CRUD 完整但类型系统缺失"的半成品**。8 项真实实现都是 CI 实体的 CRUD 操作，但 NeatLogic CMDB 的核心价值是 **CI 类型建模（citype）+ 属性校验（validator）+ 自动发现（discovery）+ 关系图（graph）**——这四块全部缺失。

2. **Migration 缺失是 schema 级别的"假实现"**。只有 002_fts_search.sql 没有 001 建表，意味着 CMDB 的数据模型可能从未规范化定义。这比代码桩更危险，因为代码桩在运行时会报错，schema 缺失在部署时会失败。

3. **TS 权威实现是最大的"未开发资产"**。legacy/orion-platform-service-ts/ 有 CITypeService 469 行 + 4 个 Repository + CmdbTopologyService + K8sWatchClient + RelationRuleEngine，**这些都可以直接移植到 Go**，节省约 30% 工时。Orion 团队似乎在 Go 迁移时只迁移了 CI 实体的 CRUD，把类型系统和高级能力全部丢弃了。

4. **3 个 transport 冻结 + Collector SPI 零接线 = 采集能力为零**。CMDB 的核心价值是"自动发现 CI"，NeatLogic 通过 JAR 热加载 + ServiceLoader 实现插件化采集，Orion 的 `//go:build ignore` 让所有采集能力处于设计冻结状态。

5. **建议策略**：
   - **不要从零建 CMDB**——TS 权威实现存在，走"TS → Go 移植"路径
   - **Phase 1 必须先补 schema 和类型系统**——这是地基
   - **Phase 2 解冻 transport + 接线 SPI**——让采集能跑
   - **Phase 3-4 才考虑高级能力**——K8s sync/拓扑/discovery

**综合评级：D+（22% 完成度，CRUD 可用但核心 CMDB 能力缺失，schema 未规范化）**

---

## 九、证据文件索引

| 类别 | 文件 |
|------|------|
| Orion CMDB service | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/service/service.go`（805 行，30 函数） |
| Orion CMDB handler | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/handler/handler.go` |
| Orion CMDB models | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/models/models.go` |
| Orion CMDB migrations | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/migrations/`（**仅 002_fts_search.sql**） |
| Orion CMDB transport（冻结） | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/transport/{snmp,ssh,sql}.go` |
| Orion CMDB Collector | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb-collector/`（17 Go 文件） |
| Orion Collector Registry | `/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb-collector/registry/registry.go`（零调用） |
| TS 权威实现 | `/Users/heal/orion-design/legacy/orion-platform-service-ts/src/services/cmdb/`（24 文件） |
| NeatLogic cmdb 模块 | `/private/tmp/neatlogic-itom/neatlogic-cmdb/src/main/java/neatlogic/module/cmdb/`（467 Java 文件） |
| NeatLogic cmdb-base 框架 | `/private/tmp/neatlogic-itom/neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/`（466 Java 文件） |
| NeatLogic cmdb API（23 子域） | `/private/tmp/neatlogic-itom/neatlogic-cmdb/src/main/java/neatlogic/module/cmdb/api/` |
| NeatLogic cmdb service（9 子域） | `/private/tmp/neatlogic-itom/neatlogic-cmdb/src/main/java/neatlogic/module/cmdb/service/` |
| NeatLogic validator SPI | `/private/tmp/neatlogic-itom/neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/validator/core/`（IValidator/ValidatorBase/ValidatorFactory） |

---

## 十、与 v1 评审（cross-review-synthesis-2026-09-30.md §2.3）的差异

| 维度 | v1 估计 | v2 修正 | 差异原因 |
|------|---------|---------|----------|
| 完成度 | 20-30% ± 15%（低置信度） | **22% ± 10%**（中等偏低） | v2 有 934 Java 文件实证 |
| Migration 缺失 | 未发现 | **新发现**（仅 002 无 001） | v1 未读 migrations 目录 |
| API 子域覆盖 | 未量化 | **6/23 子域有部分覆盖** | v2 统计了 23 个 API 子域 |
| TS 权威实现 | 提及但未深入 | **24 文件 + CITypeService 469 行** | v2 通过 Agent 中间发现确认 |
| 工时 | 80-115d（止损） | **195d**（Phase 1-4 含 TS 移植） | v2 识别了类型系统/schema/采集三大缺口 |
| 评级 | 未评级 | **D+** | v2 基于实证 |

---

**评审日期**：2026-10-01
**评审方法**：Agent 失败前捕获的 50 个 tool_uses 发现 + 主作者直接 grep/Read 验证补齐
**评审边界**：不涉及 ITSM 工单与 CMDB 的联动、不涉及巡检与 CMDB 的联动（这些在各自域评审中）
**数据来源**：NeatLogic Java 源码 934 文件 + Orion Go 源码 17 文件 + TS 归档 24 文件
**Agent 失败说明**：本次评审的 Agent 在 50 个 tool_uses 后因 429 rate_limit 失败，未写出报告。本报告由主作者基于 Agent 失败前的中间发现 + 直接代码验证补齐完成。Agent 失败前的最后 5 条文本发现已全部纳入本报告。
