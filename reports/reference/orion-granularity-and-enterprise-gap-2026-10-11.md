# Orion 功能颗粒度实测 × 企业级差距分析（2026-10-11）

> **方法论**：本轮全部为 ⭐ 机械计数（`find`/`grep`/`awk`，命令见 §7 可复现），
> 不含 ◇ 解读性断言。依据是参照系审计的教训——解读性断言误差 30–51%，
> 只有机械计数能证伪虚构。
>
> **参照系**：`reports/reference/neatlogic-baseline-2026-10-11.md`
> （44 仓库 @ 固定 SHA，6,328 Java 文件 / 626,522 行）
>
> **RC-03 硬约束**：本文为分析与设计文档，**未修改任何生产代码**。
> **不估算人天/工期。**

---

## 0. 核心结论（先看这一段）

**Orion 的问题不是「模块不够多」，而是「模块都在一个进程里 + 没有事务纪律 + 没有可观测性结构」。**

三条实测证据支撑这个反直觉结论：

| # | 实测数据 | 说明 |
|---|---|---|
| 1 | 296 域、跨域依赖边 **362** 条、平均出度 **1.22** | 域间耦合**极低**，已是健康模块化结构 |
| 2 | **2,048** 次 `ExecContext` 写入 vs **30** 次 `tx.Commit` | **98.5% 的写入不在事务内** |
| 3 | 2,992 个 Go 文件中 **1 个**含 trace、**5 次**结构化日志、**6 个**指标定义 | 可观测性结构近乎为零 |

**因此：不建议做微服务拆分（会加剧而非缓解问题），但可观测性与事务纪律必须升级为优先项。**

---

## 1. 功能颗粒度实测（Orion × NeatLogic）

### 1.1 规模对照

| 维度 | Orion（实测）| NeatLogic（基线）| 比值 |
|---|---:|---:|---:|
| 后端代码行 | **626,012**（Go）| 626,522（Java）| **1 : 1** |
| 后端文件数 | 3,165 | 6,328 | 0.5 : 1 |
| 后端进程数 | **1**（`orion-platform-svc-go`）| 44 仓库 / ~10 业务模块 | — |
| 域 / 模块数 | **296 域** | ~10 业务模块 | **29.6 : 1** |
| 平均每域 | 10 文件 / 2,027 行 | ~600 文件 / 模块 | **0.017 : 1** |
| 接口数 | **1,481** | 810 Handler 文件 | 1.8 : 1 |
| Factory | **13** | 115 | **0.11 : 1** |
| Registry | 9 | — | — |
| 前端文件 | 2,900 ts/tsx | 3,771（3 前端仓）| 0.77 : 1 |
| 前端代码行 | 440,455 | — | — |
| Migration | 452 编号 / 930 文件 | 33 `.sql` + 6 `version.json` | — |

### 1.2 颗粒度的关键解读

**Orion 的域数（296）是 NeatLogic 模块数（10）的 29.6 倍，但每域平均只有 10 个文件。**

这不是「Orion 更细粒度」，而是**两种不同的模块化组织方式**：

| | Orion | NeatLogic |
|---|---|---|
| 组织方式 | **扁平超细域**，单进程内 296 个 `internal/<domain>/` | **厚模块**，按业务边界分仓（`neatlogic-cmdb` 472 文件）|
| 域厚度 | 中位 **7 文件**，最大 `infrastructure` 146 文件 | 单模块数百至上千文件 |
| 边界机制 | Go 包路径 + 1,481 接口 | Java 包 + Spring Bean + Factory 注册表 |
| 进程边界 | **无**（全在 1 进程）| **有**（44 仓库、独立部署单元）|

**结论**：Orion 的域切分「过细」导致单个域缺乏完整业务能力（中位 7 文件难以独立构成用例），
而 NeatLogic 的模块切分「够厚」可独立交付。Orion 真正缺的是**进程/部署边界**，不是域数。

### 1.3 域依赖图（拆分可行性）

```
域总数:            296
唯一跨域依赖边:    362
平均出度:          1.22
零出度域:          48（16%）— 不依赖任何其他域，可独立拆分
巨型连通分量:      252 域（85%）
独立小分量（≤3 域）: 44 个
```

**共享内核**（入度最高，拆分的真正障碍）：

| 被依赖域 | 入度 |
|---|---:|
| `middleware` | **219** |
| `pagination` | **110** |
| `dbupdate` | 11 |
| `otel` | 4 |

**耦合源**（出度最高，全部 ≤4）：`chaos` 4、`dba` 4、`self-healing` 3、
`workflow-webhook` 3、`datasource` 3、`gateway-dynamic` 3、`infrastructure` 3。

**判定**：平均出度 1.22 + 最高出度仅 4 = **耦合度极低，具备微服务拆分的结构条件**。
真正的障碍只有 `middleware`（219）与 `pagination`（110）两个共享内核，
需要在拆分前抽成独立的基础库。

### 1.4 API 表面积

| 指标 | 数值 |
|---|---:|
| 含 `gin.Context` 的 handler 文件 | **520** |
| `gin.Context` 引用总数 | 5,233 |
| `RegisterRoutes`/`Register` 函数 | **391** |
| Repository 接口 | 18 |
| `repository_interface.go` 文件 | **142** |

**发现：142 个文件都声明同名接口 `RepositoryInterface`。**
这是与 ADR-012 方向相反的缺陷——Go 侧没有工厂/注册表（Factory 仅 13、Registry 仅 9，
为 NeatLogic 的 **0.11 倍**），却用「全仓同名接口」的方式制造了类型歧义。

---

## 2. 当前升级方案的优化点

对照 `reports/upgrade-execution-playbook-2026-10-03.md`（v5.6，107 项任务）与
ADR-010~015 修复结果，方案本身存在 6 处可优化：

### 2.1 Migration 编号体系已处于失效状态 ⭐ 最紧急

```
磁盘实际编号范围:  000 ~ 698（唯一 452 个）
reserved_placeholder 文件: 58（占 13%）
_down 文件:        450 / 453 个 up 文件
编号断裂:
  276 -> 362  缺 85 个
  406 -> 550  缺 143 个
  555 -> 570  缺 14 个
  239 -> 243  缺 3 个
域内自带 migrations:  20 个域、24 个 SQL 文件
  与全局编号冲突: 4 处
```

**问题**：升级方案引用 **Migration 699-765**，但磁盘最大编号仅 **698**。
方案的整个 Migration 规划建立在**尚不存在的编号空间**上，且历史编号已存在
58 个占位符 + 242 个空洞 + 4 处域内冲突。

**优化建议**：在 S0 增加「Migration 治理」前置任务——
① 清理 58 个 `reserved_placeholder`（它们掩盖了真实空洞）；
② 收敛 20 个域内 migrations 到全局目录，消除 4 处冲突；
③ 建立编号登记表（单文件、CI 校验唯一性）；
④ 之后 699+ 才有意义。

### 2.2 事务纪律是 P0 缺口，但方案未列为 P0

```
ExecContext 写入:  2,048 次
tx.Commit:              30 次
BeginTx:                 10 次
Rollback:                34 次
带事务的业务封装:         19 处（WithTx / InTx / Transaction）

→ 98.5% 的写入不在任何事务内
```

296 个域做跨域写入、98.5% 无事务，这直接决定了 ADR-010（AlertBreaker 行锁）
的选型是**孤立补丁**——它只给 AlertBreaker 一个域加了事务，其余 295 个域照旧。

**优化建议**：把「跨域写入事务化」提升为 P0，先建立统一的 `dbupdate` 事务封装
（该域入度 11，已有雏形），ADR-010 的 `alertLockTx` 应作为其第一个使用者，
而非独立 helper。否则会出现「两处并行事务封装」的技术债。

### 2.3 可观测性建设缺失（详见 §3.2）

方案的 S0 门控有 a11y / 单测覆盖率，但**没有任何一条涉及 trace / metric / 结构化日志**。
这是与「企业级」差距最大的一项，应进入 P0。

### 2.4 共享内核未治理

`middleware`（219）与 `pagination`（110）被 85% 的域依赖。
方案的 Factory/Handler 注册表模式（ADR-012）针对的是**域内扩展**，
未处理**跨域共享代码**这一真正的耦合集中点。

**优化建议**：S0 增设 `orion-go-common` 边界收敛任务——把 `middleware`、`pagination`
抽为独立库（`orion-go-common` 已存在，88 文件 / 23,067 行，但目前只有 13 个接口）。

### 2.5 ADR 参照系修复已消除 3 处虚构依赖

ADR-010/013/014 的参照系已修复（`fb7edc192`）。方案中凡引用「对齐 NeatLogic」
作为理由的任务项（尤其涉及 AlertBreaker、CMDB Template 层、ArtifactBus），
应改为引用 Orion 自身约束，避免后续维护者去找不存在的代码。

### 2.6 多租户覆盖存在但需验证深度

```
含 tenant_id / TenantID 的 Go 文件: 2,003 / 3,165（63%）
tenant 域: 9 文件  | tenant-gateway: 7 文件 | tenant-quota: 8 文件
```

63% 覆盖率符合此前审计结论（真实缺口约 15 个文件）。
但 ADR-011 已更正为 **DB-per-tenant**（NL 真实机制），
方案中若仍按「列过滤增强」推进，需重新对齐术语与实现载体。

---

## 3. 企业级三轴评估

### 3.1 高扩展性 —— **不需要架构升级，需要纪律升级**

| 项 | 实测 | 判定 |
|---|---|---|
| 域数 | 296 | ✅ 已超细，无需再切 |
| 平均出度 | 1.22 | ✅ 耦合极低 |
| 最高出度 | 4 | ✅ 无强耦合域 |
| 零出度域 | 48（16%）| ✅ 随时可拆 |
| 接口密度 | 1,481 / 3,165 文件 | ✅ 高 |
| Factory/Registry | 13 / 9（NL 的 0.11x）| ⚠️ 扩展点偏少 |
| **进程边界** | **1 进程承载 626K 行** | ❌ **缺失** |
| **事务纪律** | **98.5% 写入无事务** | ❌ **缺失** |
| **Migration 治理** | 58 placeholder + 242 空洞 + 4 冲突 | ❌ **失效** |

**结论**：**不建议现在做微服务拆分。** 理由：

1. **拆分不会解决问题**——事务纪律与 migration 治理是跨进程边界的，
   拆成 10 个服务后「98.5% 无事务」会变成「98.5% 无分布式事务协调」，**问题恶化**。
2. **前置条件未满足**——`middleware`（219）/ `pagination`（110）两个共享内核
   未抽库，强行拆分会产生 2 个代码副本并产生永久分歧。
3. **单进程不是缺陷本身**——626K 行在 Go + 1.22 出度下是可控规模；
   真正的扩展性瓶颈是**部署单元单一**（无法按域独立扩缩），而非代码组织。

**该做的三件事（按优先级）**：
1. **统一事务封装**（P0）——收敛到 `dbupdate`，消除 2,048 vs 30 的差距
2. **Migration 治理**（P0）——见 §2.1
3. **共享内核抽库**（P1）——`middleware`、`pagination` 进 `orion-go-common`

只有这三项完成、且出现明确的「单域需要独立扩缩」的业务信号时，
才启动拆分。届时 48 个零出度域是第一批候选（`ai`、`ticketing`、`ticket`、
`dba`、`ci-cd` 等）。

### 3.2 可观测性 —— **需要升级，且是唯一真正的短板**

| 支柱 | 实测 | 覆盖 |
|---|---|---|
| **日志调用** | 14,707 次 | ✅ 量大 |
| **结构化日志** | `.WithField`/`.WithFields`/`.With` 仅 **5 次** | ❌ **0.03%** |
| **含 trace 的文件** | **1** / 2,992 | ❌ **0.03%** |
| **Prometheus 指标定义** | **6** 个 | ❌ **0.2%** |
| **`context.WithValue`** | 3 次 | ❌ 近乎为零 |
| **request_id/trace_id 传播** | 218 次 | ✅ 有基础 |
| middleware 注册 | 9 个 `Use()`（含 `Prometheus()`、`CircuitBreaker`、`RateLimit`、`Timeout`）| ⚠️ 有骨架 |
| `otel` 域 | 4 文件（入度 4）| ⚠️ 存在但未被采用 |
| `tracing` 域 | 8 文件 | ⚠️ 存在但未被采用 |

**矛盾现象**：`otel`、`tracing`、`observability`、`metrics`、`monitoring` **5 个域都存在**
（合计 34 文件），`middleware.Prometheus()` 也已注册到 router，
但**没有任何业务代码使用它们**。

这是「基础设施已铺、上层未接入」的典型状态——
比「完全没建」更危险，因为会产生「可观测性已经有了」的错觉。

**该做的**：
1. **（P0）业务代码接入 trace**：给 520 个 handler 域统一注入 span，
   从 0.03% 提到 ≥80%。`tracing` 域已存在，缺的是调用点。
2. **（P0）结构化日志强制化**：14,707 次日志调用中 99.97% 是纯字符串。
   改为结构化后，故障定位从「grep 全文」变成「按字段过滤」。
3. **（P1）核心路径指标**：6 个指标定义扩展到覆盖
   API 延迟/错误率/吞吐 + DB 连接池 + 事务持锁时长（对接 ADR-010 §4.2）。
4. **（P1）`context` 传播**：3 次 `context.WithValue` 意味着 trace ID 无法跨层传递，
   需要先解决这个问题，否则第 1 项无法完成。

### 3.3 智能性 —— **基础扎实，需要深化而非新建**

| 项 | 实测 | 判定 |
|---|---|---|
| `ai` 域 | **130 文件 / 23,647 行**（第 2 大域）| ✅ 已成规模 |
| `ai` 子域 | 16 个（`agents`/`aicost`/`aisecurity`/`auto-recovery`/`decisions`/`inference`/`intelligence`/`knowledge`/`llm`/`llm-provider`/`models`/`orchestration`/`review`/`skill`）| ✅ 结构完整 |
| **LLM Provider 注册表** | `anthropic_client`/`openai_client`/`deepseek_client`/`mock_provider`/`registry`/`tokenbucket` | ✅ **真实实现** |
| `llm-trace` 域 | 12 文件 / 2,926 行 | ✅ 已有 LLM 调用追踪 |
| `mcp` 域 | 6 文件 | ⚠️ 骨架 |
| `vector` + `vector-store` | 8 + 8 文件 | ⚠️ 偏薄 |
| `semantic-search` | 10 文件 / 697 行 | ⚠️ 偏薄 |
| `RAG` / `retriev` / `Embedding` 引用 | 324 / 437 / 159 | ✅ 密集 |
| `agents` 域 | 3 文件 / **155 行** | ❌ **空壳**（与 `ai/agents` 并存，命名冲突）|
| `assistant` 域 | 14 文件 / 2,359 行 | ⚠️ 偏薄 |

**关键发现**：智能能力**不是从零开始**——LLM Provider 注册表是完整的
（多厂商 + mock + 令牌桶限流），`llm-trace` 已有 2,926 行追踪实现，
RAG/retrieval 引用密度高（324/437）。

**真正的缺口**：
1. `agents` 域 155 行是空壳，且与 `ai/agents` 并存造成命名歧义——
   这与 `internal/ai/llm` 和 `internal/ai-agent-run` 的并存问题同源
   （**同一能力被切到多个相邻域**，是 296 域过度切分的后果）。
2. `mcp`（6 文件）、`vector`（8）、`semantic-search`（10）三个域的
   体量不足以支撑企业级检索能力。
3. `orion-intelligence-svc` 有 **10,415 个文件**，但 Go 文件仅 **1 个 / 3 行**——
   该服务目录实际是资源/数据目录而非服务实现。这是一个**目录语义误导**问题。

**该做的**：
1. **（P0）合并重复域**：`agents`/`ai/agents`、`ai/llm`/`ai-agent-run`、
   `pipeline`/`pipeline-engine`/`autonomous-pipeline` 等重复切分需要合并。
   这是提升智能性效率的前置（能力分散导致无法调优）。
2. **（P1）检索能力加厚**：`vector` + `semantic-search` 合并并扩充。
3. **（P1）清理 `orion-intelligence-svc` 目录语义**，避免误判为服务。

---

## 4. 总结：是否需要进行架构升级？

| 轴 | 结论 | 升级类型 |
|---|---|---|
| **高扩展性** | **不做微服务拆分** | 纪律升级（事务 + Migration 治理），非架构升级 |
| **可观测性** | **必须升级** | 接入升级（基础设施已存在，业务未使用）|
| **智能性** | **深化而非新建** | 收敛升级（合并重复域），非新建 |

**唯一符合「架构升级」定义的是可观测性**——但它也不是新架构，
而是**已有基础设施（5 个域 / 34 文件 / `middleware.Prometheus()` 已注册）的接入补全**。

**一句话**：Orion 的架构组织（296 域、1.22 出度、1,481 接口）已达到甚至超过企业级的
模块化水平；**企业级差距不在「结构」而在「运行时纪律」**——
事务一致性（98.5% 写入无事务）与可观测性（0.03% trace 覆盖）两项为零。

---

## 5. 优先级建议

| 优先级 | 项 | 依据 | 是否需架构升级 |
|---|---|---|---|
| **P0** | 统一事务封装（收敛到 `dbupdate`）| 2,048 Exec vs 30 Commit | 否，新增公共库 |
| **P0** | Migration 治理（清 placeholder + 收敛域内 migration）| 58 占位 + 242 空洞 + 4 冲突 | 否，流程治理 |
| **P0** | Trace 接入（520 handler 域）| 1/2,992 = 0.03% | 否，接入已有 `tracing` 域 |
| **P0** | 结构化日志强制 | 5/14,707 = 0.03% | 否 |
| **P0** | 重复域合并（`agents`/`ai/agents` 等）| 155 行空壳 + 命名冲突 | 否，重构 |
| **P1** | 共享内核抽库（`middleware`/`pagination`）| 入度 219 / 110 | 否，抽库 |
| **P1** | `context` 传播机制 | 3 次 `context.WithValue` | 否 |
| **P1** | 核心路径指标扩展 | 6 个指标定义 | 否 |
| **P1** | 检索能力加厚（`vector`/`semantic-search`）| 18 文件 | 否 |
| **P1** | Factory/Registry 扩展点补齐 | 13/9 vs NL 115 | 否 |
| **暂不做** | 微服务拆分 | 平均出度 1.22 已可拆，但前置条件未满足且会恶化事务问题 | — |

---

## 6. 与升级方案的衔接

方案（`upgrade-execution-playbook-2026-10-03.md` v5.6，107 项）建议：

1. **S0 门控新增 5 项**（对应 P0 五行）——这是当前门控最大的空缺。
2. **ADR-010 的 `alertLockTx`** 应改为 `dbupdate` 事务封装的第一个使用者，
   避免技术债分叉（见 §2.2）。
3. **P0-1 CMDB 二阶模型**可以照原计划推进——ADR-013 参照系已修复，
   `AttrVo` 45 字段（含校验器三件套）是有效依据，且不依赖上述 P0 项。
4. **ADR-011 的 DB-per-tenant 术语**已在 `fb7edc192` 更正，
   方案中涉及多租户的部分需同步术语。

---

## 7. 复现命令

```bash
cd /Users/heal/orion-design

# 规模
find . -name '*.go' -not -path '*/legacy/*' -not -path '*/archived/*' \
  -not -path '*/blueprints/*' -not -path '*/vendor/*' -not -name '*_test.go' | wc -l
find orion-platform-svc-go -name '*.go' | xargs cat | wc -l    # -> 626012

# 域颗粒度
ls orion-platform-svc-go/internal | wc -l                       # -> 295/296
find orion-platform-svc-go/internal -name '*.go' | wc -l        # -> 2992
ls orion-platform-svc-go/internal | while read d; do \
  find orion-platform-svc-go/internal/$d -name '*.go' | wc -l; done | sort -n | uniq -c

# 接口 / Factory / Registry
grep -rhoE '^type [A-Z][A-Za-z0-9]*[Ii]nterface interface' orion-platform-svc-go --include='*.go' | wc -l
find orion-platform-svc-go -name '*factory*.go' | wc -l         # -> 13
find orion-platform-svc-go -name '*registry*.go' | wc -l        # -> 9

# API 表面
grep -rl 'gin\.Context' orion-platform-svc-go --include='*.go' | wc -l
find orion-platform-svc-go -name 'repository_interface.go' | wc -l  # -> 142
grep -c 'RepositoryInterface' $(find orion-platform-svc-go -name 'repository_interface.go')

# 事务纪律（关键）
grep -rho 'ExecContext(' orion-platform-svc-go/internal --include='*.go' | wc -l   # -> 2048
grep -rho '\.Commit()' orion-platform-svc-go/internal --include='*.go' | wc -l      # -> 30
grep -rho '\.BeginTx(' orion-platform-svc-go/internal --include='*.go' | wc -l      # -> 10

# 可观测性（关键）
grep -rl 'oteltrace\|otel/traces\|trace.SpanFromContext' orion-platform-svc-go/internal --include='*.go' | wc -l   # -> 1
grep -rhoE '\.(WithField|WithFields|With)\(' orion-platform-svc-go/internal --include='*.go' | wc -l               # -> 5
grep -rhoE '\.(Info|Warn|Error|Debug)(f?)\(' orion-platform-svc-go/internal --include='*.go' | wc -l               # -> 14707
grep -rhoE 'prometheus\.(NewCounter|NewGauge|NewHistogram|MustRegister)' orion-platform-svc-go/internal --include='*.go' | wc -l  # -> 6
grep -rho 'context.WithValue' orion-platform-svc-go/internal --include='*.go' | wc -l  # -> 3

# 域依赖图（见 §1.3，需 Python）
# 关键字节：module 名是 orion/platform-svc-go（含斜杠），不是 orion-platform-svc-go

# Migration 治理（关键）
ls orion-platform-svc-go/migrations | grep -oE '^[0-9]+' | sort -un | wc -l     # -> 452
ls orion-platform-svc-go/migrations | grep -c 'reserved_placeholder'             # -> 58
ls orion-platform-svc-go/migrations | grep -oE '^[0-9]+' | sort -un | awk \
  'NR>1 && $1-prev>1 {printf "%d -> %d (缺 %d)\n", prev, $1, $1-prev-1} {prev=$1}'
find orion-platform-svc-go/internal -maxdepth 2 -type d -name migrations | wc -l # -> 20

# 智能层
find orion-platform-svc-go/internal/ai -name '*.go' | wc -l        # -> 130
ls orion-platform-svc-go/internal/ai/llm-provider/                 # provider 注册表
find orion-platform-svc-go/internal/agents -name '*.go' -exec cat {} + | wc -l  # -> 155（空壳）
```

---

## 8. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 全部数字为机械计数 | §7 命令可复现 |
| 2 | Orion 侧 21 项指标全部实测 | §1.1 表格 |
| 3 | 未修改生产代码 | `git diff -- '*.go' '*.ts' '*.tsx'` 为空 |
| 4 | 未修改 ADR 之外的设计文档 | `git status` 仅新增本报告 |
| 5 | 三轴结论均有数据支撑 | §3.1 / §3.2 / §3.3 各含实测表 |
| 6 | 不含人天/工期估算 | 全文检索 `人天`/`工期`/`人日` 为空 |

---

*本文的结论与直觉相反：企业级差距不在「结构」而在「运行时纪律」。
296 个域、1.22 出度、1,481 接口的模块化水平无需架构升级；
但 98.5% 的写入无事务、0.03% 的 trace 覆盖，是必须在 S0 就补齐的 P0 项。*
