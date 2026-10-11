# 参照系实证验证 × 完善后的优化方案（2026-10-11）

> **前置动作**：上一轮复核指出一项前置调研（"抽样验证 NeatLogic 参照数字"）必须先做。本轮已执行完毕。
> **关键发现**：验证结果**同时推翻了原报告的 3 项声明和我自己上一轮批判中的 1 项** —— 只有源码是真相。
> **数据源**：NeatLogic GitHub `neatlogic` org 公开仓库（44 个），API 取证，日期 2026-10-11。
>
> **RC-03 硬约束**：本文是**参照系验证与分析文档**，未修改任何生产代码。
> **不估算人天/工期。**
> **文档性质**：分析与设计方案，不属于生产代码变更范畴。
> **对齐方法论**：⭐ 机械计数为主（`find`/`grep`/`wc`，见 §7 命令可复现），◇ 解读性评价为辅，勘误原样保留（§1.4）。

---

## 0. TL;DR

1. **可复现性事故已确认并修复**：原 73 份报告依赖的 `/tmp/neatlogic-itom-all` **已被删除**（`/tmp`、`/private/tmp` 均不存在，无 pack 文件）。**44,800 行设计文档在事故后无法复核**。现已从 GitHub 公开仓库重建：`neatlogic` org **44 个仓库 / 6,314 Java 文件 / 14,067 文件**。
2. **参照数字实测：2 项精确、3 项错误、2 项方向性错误**。inspect **66 = 66 ✅**、autoexec **193 ≈ 194 ✅**（机械计数完全可信）；Alert Mapper **22 → 实际 15 ❌**、CIType "14 属性" **→ 实际 CiTypeVo 10 字段 ❌**、Ticket "8 类型" **→ 源码中无对应 enum ❌**。
3. **方法论结论（本轮最重要）**：**机械计数（`find | wc -l`）精确可复现；解释性计数（"22 Mapper"、"14 属性"、"8 类型"）误差达 30–47% 甚至完全错误。** 原报告中所有解释性数字都需重标证据等级。
4. **我的上一轮批判本身也错了一处**：我用 `CiTypeVo`（10 字段）"纠正"报告的"14 属性"，但 `CiTypeVo` 只是类型列表对象。**NeatLogic 真实模型是 `CiVo` 43 字段 + `AttrVo` 46 字段 + 完整属性子系统**。差距不是"14 vs 10"，是**"0 个属性类型 vs 5 类属性体系 + 可插拔 validator + 表达式引擎"**。
5. **P0 只有 1 项，但证据比原方案强 10 倍**：CMDB 二阶模型。Orion `CI` 仅 **12 字段**、无 `AttrType/Attr/GlobalAttr/AttrEntity` 任何一类，**连 ADR-013 的规格都需要按源码重写**。
6. **多租户缺口从"176 文件/隔离不成立"修正为"~15 文件/局部缺口"**，降为 P1。
7. **撤回 3 项**：295 包归并、样式提取优先于 a11y、"让并发会话停下"。
8. **新增 P0 前置**：**参照系基线文件**（把 6,314 Java 的取证快照固化），否则下次还会重复本次的 44,800 行不可复核事故。

---

## 1. 参照系实证验证结果

### 1.1 数据源恢复

| 项 | 原报告 | 实测（2026-10-11） |
|---|---|---|
| 源码位置 | `/tmp/neatlogic-itom-all`（Git pack 还原） | **已删除**（3 个路径均不存在） |
| 可复现性 | 声称"一手源码扫描" | **事故后不可复核** |
| 重建来源 | — | GitHub `neatlogic` org，**44 个公开仓库** |
| Java 文件总数 | **2,500+ / 4,230 / 4,831**（三数字并存） | **6,314** |
| 顶层模块 | 42 | **44 仓库 / 26 个含代码** |

**三处规模声明全部低估**（−51% / −32% / −24%）。方向上：**NeatLogic 比原报告描述的大 30–60%**，因此 Orion 的差距**比原报告更严重**。

### 1.2 单项声明验证（7 项）

| # | 报告声明 | 实测 | 误差 | 判定 |
|---|---|---|---|---|
| 1 | inspect **66 API** | **66** `*Api.java` | 0% | ✅ **精确** |
| 2 | autoexec **193 API** | **194** `*Api.java` | +0.5% | ✅ **精确** |
| 3 | Alert **22 Mapper** | **15** `*Mapper.java` | **−32%** | ❌ 高估 |
| 4 | CIType **14 属性** | `CiTypeVo` **10 字段** | **−29%** | ❌ 高估 |
| 5 | Ticket **8 类型** | **源码无对应 enum** | — | ❌ 源码不存在 |
| 6 | Java 文件 **2,500+/4,230/4,831** | **6,314** | −51%~−24% | ❌ 三处均低估 |
| 7 | 顶层模块 **42** | **44 仓库** | +5% | ⚠️ 接近 |

### 1.3 方法论结论

**机械计数**（`find | wc -l`、文件路径枚举）→ **精确、可复现**（第 1、2 项误差 ≤0.5%）。
**解释性计数**（"22 Mapper"、"14 属性"、"8 类"）→ **误差 30–47%，甚至完全错误**（第 3、4、5 项）。

**原因**：机械计数有唯一正确解；解释性计数需要判断"哪些类算 Mapper"、"哪些字段算属性"、"哪里定义了类型"，而这些判断**原评审从未留痕**。

> ⚠️ **第 5 项的特殊意义**：`neatlogic-itsm` 中**不存在** Ticket 类型 enum。这**证实**了 `cmdb-itsm-expert-method-level-2026-10-03.md` 第 601 行的自认（"参照基于公开文档，未直接读源码"）—— "Ticket 8 类型" 来自 NeatLogic **文档**，不在源码中。
> 但这反而**强化**了"配置化优先"的架构结论：NeatLogic 的工单类型是 **ChannelType 配置驱动**，不是硬编码枚举。

### 1.4 我的批判也被推翻了一处（必须诚实记录）

上一轮我写道：

> *"「CIType 14 属性」→ 实际 10（9 业务字段）。❌ 高估 40%"*

**这个"纠正"是错的。** `CiTypeVo` 只是 CIType 的**列表展示对象**。NeatLogic 真实模型是：

| 类 | 字段数 | 职责 |
|---|---|---|
| `CiVo` | **43** | CI 实例：`attrList` / `globalAttrList` / `relList` / `authList` / `uniqueAttrIdList` / `nameAttrId` / `viewXml` / `syncPolicyCount` / `lft`+`rht`（嵌套集树）/ `children` |
| `AttrVo` | **46** | 属性定义：`JSONObject config` + `expression` + **`validatorId`/`validatorName`/`validatorHandler`/`JSONObject validConfig`** + `targetCiId`（属性指向另一 CI） |
| `AttrTypeVo` | **9** | 属性类型：`needTargetCi` / `needConfig` / `needWholeRow` / `canSearch` |
| — | — | 另有 `GlobalAttrVo` / `AttrEntityVo` / `AttrValueHandlerFactory` / `IAttrValueHandler` / `attrexpression/` / **约 60 个 attr 相关 exception**（unique rule、validator、expression 校验） |

**真实差距不是"14 vs 10"，而是"0 vs 完整属性子系统"**：Orion `CI` 只有 **12 个字段**（`ID/CIID/Name/CIType/Status/Description/TenantID/CreatedBy/Environment/Tags/CreatedAt/UpdatedAt`），`CIType` 是**一个字符串**，**没有任何** `AttrType` / `Attr` / `GlobalAttr` / `AttrEntity` / validator / expression 对应物。

**教训**：**我对报告的批判本身也是"解释性判断"，同样不可靠。只有源码是真相 —— 这正是本轮做参照系验证的价值所在。**

---

## 2. 修正后的真实差距图

| 维度 | Orion 实测 | NeatLogic 实测（源码） | 真实差距 |
|---|---|---|---|
| **CMDB 模型** | `CI` **12 字段**，`CIType` = string | `CiVo` 43 + `AttrVo` 46 + `AttrTypeVo` 9 + 属性表达式 + 可插拔 validator + 嵌套集树 | **子系统级缺失（0 vs 5 类）** |
| **巡检 API** | **12** | **66** | 1 : 5.5 |
| **自动化 API** | **10** | **194** | 1 : 19.4 |
| **告警 Mapper** | — | **15**（非 22） | 修正后参照 |
| **代码规模** | 626,012 行 Go | **6,314 Java 文件**（14,067 文件） | 量级相当 |
| **模块/包** | 295 Go package | 44 仓库 / 26 含代码 | Go 惯例差异，非缺陷 |
| **多租户隔离缺口** | **~15 个实现文件**（非 176） | ThreadLocal 127 处 + schema-per-tenant | 局部缺口 |

---

## 3. 完善后的方案

### P0-0 前置：参照系基线固化（**必须先做，否则本方案无法验收**）

**问题**：本次事故的根因不是"源码被删"，是**取证快照从未固化**。44,800 行文档建在易失的 `/tmp` 上。

**方案**：
1. 将 NeatLogic 44 仓库 clone 到**版本受控位置**（如 `~/refs/neatlogic/`，非 `/tmp`），并在仓库内记录 **commit SHA + 日期 + 仓库清单**。
2. 生成 `reports/reference/neatlogic-baseline-2026-10-11.md`：固化 44 仓库 × commit SHA × Java 文件数 × 关键类字段数（`CiVo`/`AttrVo`/`CiTypeVo`）。
3. **所有后续 NeatLogic 参照必须引用该基线文件的 commit SHA**，禁止再引用"公开文档"或"记忆"。

**验收**：基线文件中每个数字都有可复现命令 + commit SHA。

---

### P0-1 CMDB 二阶模型（唯一 P0，规格按源码重写）

**证据升级**：从"CIType 14 属性"→ **`CiVo` 43 + `AttrVo` 46 + `AttrTypeVo` 9 + 属性表达式 + 可插拔 validator**。这是**子系统级缺失**，不是字段数不足。

**重写后的 ADR-013 规格**（对齐 NeatLogic 真实模型，非原报告的"14 属性"）：

| Migration | 内容 | 对齐 NeatLogic |
|---|---|---|
| **699** | `cmdb_ci_types`（id, name, label, icon, sort, is_menu, is_show_in_topo）+ `cmdb_attr_types`（id, name, label, icon, need_target_ci, need_config, need_whole_row, can_search） | `CiTypeVo` + `AttrTypeVo` |
| **700** | `cmdb_attrs`（id, ci_type_id, name, label, alias, attr_type_id, config JSONB, expression, validator_id, target_ci_id） | `AttrVo` 核心字段 |
| **701** | `cmdb_ci_instances`（id, ci_type_id, name, status, tenant_id, created_by）+ `cmdb_ci_attr_entities`（ci_id, attr_id, attr_value JSONB） | `CiVo` + `AttrEntityVo` |
| **702** | `cmdb_global_attrs` + `cmdb_ci_rel_entities` + `cmdb_ci_unique_rules` | `GlobalAttrVo` + `RelVo` + unique rule |

**新增包**：`internal/cmdb/attribute/`（含 `AttrTypeRepository` / `AttrRepository` / `AttrEntityRepository` / **`AttrValueHandlerFactory`** —— 对齐 `AttrValueHandlerFactory` + `IAttrValueHandler`）

**⚠️ 与原 ADR-013 的差异**：原 ADR-013 只设计到"CIType + Instance JSONB"两层，**缺 `AttrType` / `validator` / `expression` / `GlobalAttr` / `RelEntity` / `unique rule` 六类**。按原规格实现会得到一个**只有二分之一能力**的 CMDB。

**阻塞范围（明确限定）**：仅 CMDB / ITSM / 巡检 / 自动化链。**不阻塞** S1 a11y、S4 Runner、S5 前端。

**回滚**：4 个 Migration 独立 down 脚本，逐个 revert。

---

### P0-2 品牌主张与代码对齐（分钟级，独立无依赖）

**实测**：Tekton/Knative 在活跃代码中 **0 处**。仅 2 处 UI 字符串：
- `orion-frontend/src/pages/Login/Components/BrandPanel.tsx:74` → `让 Tekton、Knative、Prometheus 和 K8s 协同工作`
- `orion-frontend/src/pages/EvalSetManagement/CreateEvalSetModal.tsx:54` → AI 评测集示例文本

**方案**：将两处 + README 统一为真实栈：`Go + Gin + PostgreSQL + NATS + OpenTelemetry + Prometheus`。
**验收**：`grep -rl "Tekton\|Knative" orion-frontend/src --include='*.tsx' | grep -v EvalSet` = 0。

---

### P1 —— 定向修复（4 项，可并行）

| # | 项 | 实测规模 | 方案 | 验收 |
|---|---|---|---|---|
| **P1-1** | 多租户隔离缺口 | **~15 个实现文件**（非 176） | 定向补 `tenant_id`：`ticket`/`ticketing` 的 `suspend.go`、`sla.go`、`assignment_rule.go`、`transfer.go`、`comment.go` + `visor`、`user-activity`、`semantic-search`、`pipeline-error-detail`、`datasource`、`cache-monitor`、`api-component` | 补齐后**再**上 ADR-011 第 4 步 SQL builder 编译期强制 |
| **P1-2** | Ticket 类型污染 | `Type` = 自由 string | 新增 `ticket_source`（`alert_auto`/`sla_breach`/`manual`/`inspection`/`change`）+ `alert_severity` 独立列，**数据迁移** | 旧 `Type` 值迁移率 100% |
| **P1-3** | CMDB 4 个 K8s 桩 | `service.go` 805 行内 4 方法硬编码 | `ListK8sResources`/`StartK8sSync`/`StopK8sSync` 接 `k8s.io/client-go` | `grep -c "Mock/scaffold" cmdb/service/service.go` 从 4→0 |
| **P1-4** | `alert-adapter` / `-v2` 并存 | 2 包并存 = 未完成迁移 | 收编为 1 包，废弃另一个 | 路由回归测试通过 |

**⚠️ P1-1 排序安全**：必须先补 15 个文件，**再**上编译期强制。顺序反了会立刻打断构建。

---

### P2 —— 工程化（3 项）

| # | 项 | 方案 |
|---|---|---|
| **P2-1** | 执行手册门控订正 | 修正 4 个失效路径（`errors.go`/`index.css`/`request.ts`/`.eslintrc*`）+ 所有期望值改为具体数字 |
| **P2-2** | 深色模式收口 | `isDark` 仅 **52 处 / 8 个文件** → 集中到 CSS 变量。**低成本，先做** |
| **P2-3** | 报告证据分级 | 对 73 份报告全文标记 ⭐机械计数 / ⚠️解释性判断，解释性数字需重验后才能引用 |

---

### 明确撤回（3 项）

| 撤回项 | 原因 |
|---|---|
| ❌ 「295 包归并到 150」 | Go 惯用结构就是小包；44 仓库是 Java/Maven 惯例。**语言差异，非缺陷** |
| ❌ 「样式提取优先于 a11y」 | `colors.neutral[x]` token 引用 **3,889 处**是条件表达式（`isDark ? a : b`），无法机械提取到 CSS。顺序反了 |
| ❌ 「让并发会话停在前端」 | S1 a11y / S5 前端与 P0-1（CMDB 二阶）**无依赖冲突**，可并行 |

---

### 明确不做（护城河，维持）

| 项 | 依据 |
|---|---|
| ❌ 不削减事件/Saga（EventType 97 / EventBus 28 文件 / Saga 13 文件） | NeatLogic `neatlogic-event` 仅 25 Java 文件，Event 为纯静态配置 |
| ❌ 不为对标引入 K8s/Helm/ArgoCD Runner | `neatlogic-runner` 328 Java 文件仅跑本地 subprocess |
| ❌ 不在后端做 SVG 报表生成 | `neatlogic-report` 86 Java 文件走 JFreeChart 静态输出 |
| ❌ 不重构 Incident/Problem/Change 为 ChannelType | Orion 已有 ITIL 建模；`neatlogic-itsm` 无 Ticket 类型 enum 证明这是配置化设计选择 |

---

## 4. 执行顺序（含依赖与排序安全）

```
P0-0 参照系基线固化 ──────────────────────────────┐（阻塞所有验收标准）
                                                    │
P0-1 CMDB 二阶模型（按源码重写规格）◄────────────────┘
   │  （仅阻塞 CMDB/ITSM/巡检/自动化链）
   ├─→ P1-3 K8s 桩        ├─→ 巡检/自动化接入 CI 类型
   └─→ P1-2 类型污染      └─→ ITSM 消费 ticket_source
                            P1-4 adapter 收编

P1-1 多租户：先补 15 文件 ──→ 再上 SQL builder 强制   （顺序不可反）

P0-2 品牌主张（独立，分钟级）
P2-2 深色模式（独立，8 文件）

并发会话：S1 a11y / S5 前端 ── 全程并行，无冲突
```

---

## 5. 风险登记

| # | 风险 | 概率 | 影响 | 处置 |
|---|---|---|---|---|
| R1 | 参照系基线未固化，验收标准再次不可复核 | 高（本次已发生） | 致命 | **P0-0 先行** |
| R2 | 按原 ADR-013（缺 6 类）实现，得到半能力 CMDB | 高 | 严重 | P0-1 规格已按源码重写 |
| R3 | P1-1 先上编译期强制，构建立即打断 | 中 | 阻塞 | 排序已固定：先补后强制 |
| R4 | 其余 73 份报告中未知的解释性错误 | 高 | 中 | P2-3 全文证据分级 |
| R5 | 295 包协调成本随跨域事务上升 | 中 | 低 | 不单独立项，S6 前做一次能力域归并评估 |

---

## 6. 与既有文档的修订关系

| 文档 | 需修订内容 |
|---|---|
| **ADR-013** | **规格重写**：补 `AttrType` / `validator` / `expression` / `GlobalAttr` / `RelEntity` / `unique rule` 六类 |
| **ADR-011** | 目标从"规范传递"改为"补 15 文件 + 编译期强制"两步 |
| `cmdb-upgrade-design-2026-10-03.md` | "CIType 14 属性" → 按 `CiVo` 43 + `AttrVo` 46 重写 |
| `cmdb-itsm-expert-method-level-2026-10-03.md` | 第 601 行"未直接读源码"自认已获证实；Ticket 8 类型确认不在源码 |
| `neatlogic-architecture-philosophy-2026-10-03.md` | Java 文件数 4,230 → **6,314** |
| `big-tech-expert-granularity-comparison-2026-10-11.md` | 第 1.2 节"186 文件"分层修正；撤回 295 包归并；CMDB 差距按源码重写 |

---

## 7. 复现命令

```bash
# 1. NeatLogic 仓库清单与规模（本报告的基线）
curl -s "https://api.github.com/orgs/neatlogic/repos?per_page=100" \
  | grep -o '"full_name": "neatlogic/[^"]*"' | wc -l          # 44
curl -s "https://api.github.com/repos/neatlogic/<repo>/git/trees/HEAD?recursive=1" \
  | grep -c '"path"'                                           # 路径数

# 2. 机械计数（精确可复现）
# inspect 66 API
curl -s "https://api.github.com/repos/neatlogic/neatlogic-inspect/git/trees/HEAD?recursive=1" \
  | grep -oE '"path": "[^"]*Api\.java"' | wc -l               # 66
# autoexec 194 API（报告写 193）
curl -s "https://api.github.com/repos/neatlogic/neatlogic-autoexec/git/trees/HEAD?recursive=1" \
  | grep -oE '"path": "[^"]*Api\.java"' | wc -l               # 194
# Alert 15 Mapper（报告写 22）
curl -s "https://api.github.com/repos/neatlogic/neatlogic-alert/git/trees/HEAD?recursive=1" \
  | grep -oE '"path": "[^"]*Mapper\.java"' | wc -l            # 15

# 3. 解释性验证（需读源码）
curl -s -H "Accept: application/vnd.github.raw" \
  "https://api.github.com/repos/neatlogic/neatlogic-cmdb-base/contents/src/main/java/neatlogic/framework/cmdb/dto/ci/CiVo.java" \
  | grep -cE '^    private '                                    # 43
# 同法查 AttrVo.java → 46, CiTypeVo.java → 10

# 4. Orion 侧
cd orion-platform-svc-go
grep -cE '^\s+[A-Z]\w+\s' <(grep -A25 'type CI struct' internal/cmdb/models/models.go)  # 12（去重后）
```

---

**报告结束**

- **参照系已重建**：44 仓库 / 6,314 Java 文件，替代已删除的 `/tmp/neatlogic-itom-all`
- **验证结果**：机械计数 2/2 精确；解释性计数 0/3 正确（误差 30–47% 或完全错误）
- **自我批判也被推翻 1 处**：CMDB 差距按源码重算后**比原报告更严重**（0 属性子系统 vs 5 类）
- **P0 收窄为 2 项**：P0-0 参照系基线 + P0-1 CMDB 二阶（规格按源码重写）
- **撤回 3 项**、**降 1 项**（多租户 176→15 文件）
- **边界**：仅写 Markdown 与 `/tmp` 取证，未修改任何生产代码
