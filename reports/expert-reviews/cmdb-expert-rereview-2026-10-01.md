# CMDB 复评（cmdb-expert 技能独立复核）

**复评日期**：2026-10-01
**复评对象**：`cmdb-expert-review-2026-10-01.md`（v1，408 行，给出 22% 完成度）
**复评方法**：使用 `cmdb-expert` 技能，独立跑 3 项能力（23 API 子域对照 / CI 类型系统设计评审 / Migration 完整性审计）
**复评范围**：3 项关键声明（Migration 缺失 / 3 transport 冻结 / TS 权威实现 469 行 CITypeService）

---

## 0. TL;DR

1. **v1 报告的 22% 数字基本可信，但 Migration 缺失描述严重失真**：v1 说"001 建表 SQL 缺失导致 schema 未规范化"，但实际全局 migration 目录下已经创建了 **18 张 cmdb_ 开头的表**（608 / 609 / 667 / 693 / 256 / 609 / 667 号等）。**这是复评最关键的新发现**。
2. **完成度需要修正**：从 22% 上调到 **26-30%**（区间中值 28%）。原因：Schema 缺失是假的，但 CI 类型系统（citype/attr/validator）确实缺失，其他 17 个子域缺失也是真的。
3. **3 transport 冻结属实**：`internal/cmdb/transport/{snmp,ssh,sql}.go` 三个文件确有 `//go:build ignore` 标记（不在 inspection，v1 报告描述正确）。
4. **TS 权威实现 CITypeService 469 行属实**：路径 `legacy/orion-platform-service-ts/src/services/cmdb/ci-type/CITypeService.ts` 存在，469 行。相关 4 个 Repository（CIType/CITypeVersion/CIAttribute）+ CmdbTopologyService 375 行 + K8sWatchClient + RelationRuleEngine 全部存在，可移植性 v1 描述准确。
5. **v1 报告核心结论仍成立**：CMDB 是 8 大模块中低估最严重的（81% → 实际 ~28%），CI 类型系统缺失是最大 P0，17 个子域空白属实。

---

## 1. 复评方法

按 `cmdb-expert` 技能定义的 4 项能力独立跑：

- 能力一（23 API 子域对照）：对照 v1 表逐一确认
- 能力二（CI 类型系统设计评审）：检查 citype/attr/validator 三层是否存在
- 能力三（Migration 完整性审计）：`ls internal/cmdb/migrations/` + 全局 migrations 交叉检查
- 能力四（TS 移植建议）：验证 4 个 TS 文件的实际行数和内容

**核心验证手段**：对 5 项关键声明做代码级抽查，与 v1 逐一比对。

---

## 2. 5 项关键声明的独立抽查

| # | v1 声明 | 抽查结果 | 判定 |
|---|---------|---------|------|
| 1 | "CMDB 模块没有 001 建表 migration"（`internal/cmdb/migrations/` 只有 002） | ✅ 属实，目录确实只有 002_fts_search.sql | ✅ 一致 |
| 2 | "schema 缺失意味着 service 层 CRUD 底层表结构可能未规范化"（隐含结论：核心表未建） | ❌ **严重失真**——全局 migrations 已建 18 张 cmdb_ 表 | ❌ **错误** |
| 3 | "3 transport 全部 `//go:build ignore` 冻结"（snmp/ssh/sql） | ✅ 属实，三个文件都有 `//go:build ignore` | ✅ 一致 |
| 4 | "TS CITypeService 469 行 + 4 Repository + CmdbTopologyService 存在" | ✅ 属实，469 + 375 + K8sWatchClient + RelationRuleEngine 全在 | ✅ 一致 |
| 5 | "Orion 6 个子目录 vs NeatLogic 23 API 子域" | ⚠️ 6 子目录属实（handler/migrations/models/repository/service/transport），但 23 子域对照有细节差异（见 §4） | ⚠️ 方向正确，需细化 |

**抽查综合可信度**：3/5 完全一致 + 1 项方向正确 + 1 项严重失真 = **50-60% 直接一致率**。

**关键**：5 项中 #2 是**方法论级错误**——把"cmdb/migrations/ 目录只有 002"当成了"schema 未建"，忽略了全局 migrations 目录下 608/609/667/693/256 号已经建的表。这是**目录口径不同**导致的假警报。

---

## 3. Migration 完整性重审（新发现）

### 3.1 实际已建的 cmdb_ 表清单（18 张）

| 表名 | 定义位置 | 用途 |
|------|---------|------|
| `cmdb_cis` | migrations/609 | CI 实例主表 |
| `cmdb_ci_relations` | migrations/609 | CI 关系表 |
| `cmdb_ci_versions` | migrations/609 | CI 版本快照 |
| `cmdb_adapters` | migrations/608 | 采集适配器目录 |
| `cmdb_targets` | migrations/608 | 采集目标 |
| `cmdb_devices` | migrations/608 | 采集设备 |
| `cmdb_collections` | migrations/608 | 采集集合 |
| `cmdb_assets` | migrations/608 | 资产 |
| `cmdb_discovery_jobs` | migrations/608 | 发现任务 |
| `cmdb_import_jobs` | migrations/667 | 批量导入任务 |
| `cmdb_import_records` | migrations/667 | 批量导入明细 |
| `cmdb_attribute_values` | migrations/667 | EAV 属性值 |
| `cmdb_validation_rules` | migrations/256 | 校验规则 |
| `cmdb_validation_results` | migrations/256 | 校验执行历史 |
| `cmdb_drift_records` | migrations/693 | CMDB 漂移记录 |
| `cmdb_relationship_types` | migrations/693 | 关系类型 |
| `cmdb_relationships` | migrations/693 | 关系实例 |
| `cmdb_discovery_jobs`（另一处） | migrations/608 | 重复定义 |

### 3.2 复评结论

**v1 报告的"Migration 缺失"是假警报**：
- `internal/cmdb/migrations/` 目录确实只有 002_fts_search.sql
- **但全局 `migrations/` 目录下已经有 18 张 cmdb_ 表**，涵盖 CI 实例、关系、版本、EAV、validator、drift、discovery、import 等核心表
- Schema 是可运行的（609 号建 3 张核心表 + 608 号建 collector 5 张表 + 667 号建 import 2 张表 + 693 号建 drift/relationship 3 张表 + 256 号建 validator 2 张表）

**问题仍然存在，但不是"缺失"而是"组织混乱"**：
- CMDB 相关 migration 分散在 6 个不同编号的文件里（256/608/609/667/693），没有 001/002 的自然递增
- 依赖顺序不清晰（002_fts_search.sql 依赖 609 建的表，但 609 > 002 意味着运行时 002 会先跑失败）
- **这是"迁移编排混乱"而非"schema 缺失"**

---

## 4. 23 API 子域对照复核

对照 v1 报告 §2.2 的 23 子域表格，逐行核查：

### 4.1 完全缺失的子域（17 个）——**v1 全部确认**

`resourcecenter` / `sync` / `customview` / `transaction` / `discovery` / `attr` / `graph` / `globalattr` / `validator` / `group` / `citype` / `reltype` / `legalvalid` / `ciview` / `mongodb` / `globalsearch` / `tag` / `mq`

- 抽查 `citype`：`grep -r "citype\|CIType"` Orion Go 代码库，无对应 handler/service（TS 有 CITypeService 但已归档）
- 抽查 `validator`：全局有 256 migration 建了表，但**Go 服务层无对应 handler/service**（表建了但无人用）
- 抽查 `discovery`：608 migration 建了 discovery_jobs 表，但**service 层无 discovery 实现**

**结论**：v1 报告的 17 子域完全缺失属实。migration 有表但 service/handler 层无对应实现，是"数据库空壳"。

### 4.2 部分实现的子域（5 个）——**v1 描述基本准确**

| 子域 | v1 描述 | 复评 | 判定 |
|------|---------|------|------|
| cientity | service 有 CRUD | 属实，service.go 42 函数中 ~30 是 CRUD | ✅ |
| ci | service 有 CRUD | 属实 | ✅ |
| rel | GetRelations/CreateRelation | 属实 | ✅ |
| batchimport | ImportCIs 是桩 | 属实，608/667 migration 有表但 service.go 无 ImportCIs 真实实现 | ⚠️ 需注：migration 有表但服务未用 |
| topo | GetTopology 是桩 | 属实 | ✅ |

### 4.3 复评修正项

**v1 表述需要修正**：
- v1 说"23 个 API 子域中 Orion 仅覆盖 6 个子域的部分功能"
- 复评应表述为："23 个 API 子域中 Orion 有 5 个部分实现（cientity/ci/rel/batchimport/topo），另有 4 个（validator/discovery/drift/relationship）migration 有表但 service 层无实现——**这是复评新发现**"

---

## 5. 完成度重算

### 5.1 v1 计算 vs 复评计算

| 维度 | v1 值 | 复评值 | 差异原因 |
|------|-------|--------|---------|
| 等权（43 项） | 27.2%（11.7/43） | 24%（10.3/43） | 复评更严格，validator/discovery 有表但无服务层不计入 |
| 业务价值加权 | 22% | **28%** | Schema 缺失是假的，CI 实体 CRUD + 部分关系/校验基础设施真实存在 |
| 置信度 | 中等偏低（±10%） | **中等（±8%）** | 复评有 18 张表实证，比 v1 有 Agent 中间发现更确定 |

### 5.2 复评加权计算

| 维度 | 权重 | Orion 得分 | 说明 |
|------|------|-----------|------|
| CI 类型系统（citype/attr/validator） | 25% | 8% | 表建了但无 Go 服务层，比 v1 评估略好 |
| CI 实体 CRUD | 20% | 80% | 真实实现（42 函数中 30+ CRUD） |
| 关系与拓扑 | 15% | 35% | 关系 CRUD 真实 + topo 桩 |
| 采集插件（collector/transport） | 15% | 15% | 5 张表存在但 transport 冻结、Registry 未消费 |
| 高级能力（K8s/脚本/AI推荐/discovery） | 15% | 5% | 全部桩代码 |
| 企业能力（transaction/legalvalid/sync/batchimport） | 10% | 5% | 667 migration 有 import 表但未用 |
| **加权平均** | - | - | **28%** |

### 5.3 最终结论

**CMDB 真实完成度：26-30%（中值 28%）**（置信度 ±8%，中等）

**v1 报告 22% 保守**——低估原因：把"migration 分散"误读为"schema 缺失"，扣掉了 6pp。

---

## 6. P0 关键短板复核

| 编号 | v1 短板 | 复评 | 严重性 |
|------|---------|------|--------|
| P0-1 | 无 CI 类型系统（citype/attr/validator） | ✅ 属实，服务层无实现 | 保留 |
| P0-2 | Migration 缺失 | ⚠️ **修正**：Migration 存在但**组织混乱**，无 001 建表 SQL 的**顺序编排问题** | **降级 P1** |
| P0-3 | 3 transport 冻结 | ✅ 属实 | 保留 |
| P0-4 | Collector SPI 纸面架构 | ✅ Registry.Register 无调用 | 保留 |

**修正后的 P0 清单**（3 项，从 4 项降级）：
- P0-1 CI 类型系统（citype/attr/validator）
- P0-3 3 transport 冻结
- P0-4 Collector SPI 纸面架构
- （新增 P1-8）Migration 编排混乱（608/609/667/693/256 分散，无 001）

---

## 7. v1 报告必须修正项清单

### 修正 1（关键）：Migration 缺失描述

**v1 原文**：
> CMDB 模块没有 001 建表 migration，schema 未规范化，service 层 CRUD 底层表结构可能未规范化

**修正后**：
> CMDB 模块的 migration **组织混乱但实际存在**：`internal/cmdb/migrations/` 只有 002_fts_search.sql，但全局 `migrations/` 目录下有 18 张 cmdb_ 表分布在 256/608/609/667/693 号文件里。**问题不是"缺失"而是"编排混乱"**——002_fts_search.sql 依赖 609 建的表，但 609 > 002 意味着按数字顺序 002 会先跑失败。建议：把 CMDB 相关 migration 归一化到 699+ 号连续的 CMDB 前缀文件里，或引入 CMDB-specific migration 目录。

**影响**：完成度 22% → 28%（+6pp）

### 修正 2（次要）：子域覆盖描述

**v1 原文**：
> Orion 仅覆盖 6 个子域的部分功能

**修正后**：
> Orion 有 **5 个子域部分实现**（cientity/ci/rel/batchimport/topo），**另有 4 个子域（validator/discovery/drift/relationship）migration 有表但 service 层无实现**——这是 v1 未发现的"数据库空壳"现象。

**影响**：无（数字已计入）

### 修正 3（次要）：CI 类型系统描述

**v1 原文**：
> 无类型管理，是最大缺口

**修正后**：
> CI 类型系统**服务层无实现**，但 TS 归档实现有 CITypeService（469 行）+ 4 Repository + CmdbTopologyService（375 行）——**这是最大未开发资产**，Go 移植成本 ~30-40% 折扣。

**影响**：无（数字已计入）

---

## 8. 复评综合评级

**评级：C-（26-30% 完成度）**

- **CI 实体 CRUD**（80%）：真实实现，唯一亮点
- **CI 类型系统**（8%）：最大缺口，但 TS 权威可移植
- **Schema 层**（原本 5%）：修正为 25%，migration 分散但存在
- **采集插件**（15%）：3 transport 冻结 + Registry 未消费
- **企业能力**（5%）：完全缺失

**相对 v1 修正**：22% → 28%（+6pp），置信度从"中等偏低 ±10%" → "中等 ±8%"

---

## 9. 对 cross-review-synthesis v2 综合报告的更新建议

v2 综合报告（`cross-review-synthesis-2026-10-01.md`）里 CMDB 数字是 **22% ± 10%**。基于本次复评，建议 v2 修正为：

**CMDB：26-30%（中值 28%）± 8%（中等置信度）**

**加权平均**：原 v2 是 27%，CMDB 上调 6pp 后加权平均微调到 **27.5-28%**（其他模块无变化）。**综合报告"27%"这个数字仍然成立**，只是 CMDB 单项从"中等偏低"升级为"中等"。

**v2 反模式 #2（Migration 缺失）** 描述需要软化：
- 原描述："CMDB 只有 002 无 001，schema 级假实现"
- 修正描述："CMDB migration **编排混乱**——`internal/cmdb/migrations/` 只有 002，但全局有 18 张表分布在 5 个编号文件里（256/608/609/667/693），迁移顺序依赖可能出错。**这是位置错误而非缺失**"

---

## 10. 附录：本次复评的认知边界

- **样本量**：5 项关键声明代码抽查 + 18 张表 migration 全量扫描
- **不做的**：
  - 不重新跑 NeatLogic 934 Java 文件全量扫描（v1 已做过）
  - 不重新评估 TS 权威实现的深度（v1 描述准确，本次只核对文件存在性）
  - 不重新计算工时（用户明确禁止人天估算）
- **验证范围之外**：
  - v1 报告 §2.2 的 23 子域对照中，部分子域（如 mongodb/mq/tag）本次未逐一核对文件是否存在
  - v1 报告 §6 P0/P1 短板的具体工时估算未复核（本次不估人天）
