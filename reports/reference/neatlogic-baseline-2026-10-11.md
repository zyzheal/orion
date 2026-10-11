# NeatLogic 参照系基线固化（2026-10-11）

> **文档定位**：这是 `reports/expert-reviews/big-tech-expert-granularity-comparison-2026-10-11.md` 与
> `reports/module-upgrade-designs/reference-verification-and-refined-plan-2026-10-11.md` 的**上游事实层**。
> 前者与后者中所有形如「NeatLogic 有 N 个 X」的断言，其真值来源均为本文。
>
> **为什么需要这份文件**：此前 73 份报告（44,800 行）的参照系依赖 `/tmp/neatlogic-itom-all`。
> 该目录已不存在（三路径核查均无 pack 文件），导致所有历史断言**不可复现**。
> 本文把参照系固定到可校验的 commit SHA，使后续验收标准有唯一真值来源。
>
> **RC-03 硬约束**：本文为事实基线文档，不含任何生产代码改动。
> **不估算人天/工期。**

---

## 0. 基线标识

| 项 | 值 |
|---|---|
| 抓取时间 | 2026-10-11 |
| 来源 | GitHub `neatlogic` org 公开仓库 |
| 本地落盘 | `~/refs/neatlogic/`（**非 `/tmp`**，防止再次丢失） |
| 仓库总数 | **44**（全部 clone 成功，0 失败） |
| Java 文件 | **6,328** |
| Java 代码行 | **626,522** |
| 非 `.git` 文件总数 | **14,177** |
| 磁盘占用 | 961 MB |
| clone 日志 | `~/refs/neatlogic/clone.log` → `=== DONE total=44 ok=44 fail=0 ===` |

---

## 1. 仓库清单（44 仓库 × commit SHA × 机械计数）

> **⭐ 全部为机械计数**，可由 §6 命令复现，不依赖任何解读。

| 仓库 | commit SHA | Java 文件 | 全部文件 |
|---|---|---:|---:|
| `neatlogic-i18nhelper-idea` | `9c6eb08e26e2` | 10 | 43 |
| `neatlogic-i18nhelper-vscode` | `2ba3543c0a77` | 0 | 17 |
| `neatlogic-alert` | `c5025d5216df` | 120 | 188 |
| `neatlogic-alert-base` | `db41a4438b20` | 0 | 7 |
| `neatlogic-autoexec` | `89ecb9fbd56a` | 371 | 683 |
| `neatlogic-autoexec-backend` | `fb616d91b025` | 0 | 1095 |
| `neatlogic-autoexec-base` | `fdfda0d32e0e` | 372 | 396 |
| `neatlogic-autoexec-scripts` | `10d23c571c51` | 0 | 305 |
| `neatlogic-cmdb` | `a6ad0b8a49cd` | 472 | 598 |
| `neatlogic-cmdb-base` | `b2aae25ae241` | 447 | 460 |
| `neatlogic-codehub` | `9b8555278851` | 0 | 3 |
| `neatlogic-codehub-base` | `dc5088aa2bac` | 0 | 2 |
| `neatlogic-dashboard` | `f7b7aff6b33a` | 26 | 45 |
| `neatlogic-dashboard-base` | `09c5809f27b0` | 25 | 37 |
| `neatlogic-database` | `032b298e25a6` | 0 | 35 |
| `neatlogic-deploy` | `635de6f7bcd1` | 245 | 310 |
| `neatlogic-deploy-base` | `881e82e29ffd` | 210 | 222 |
| `neatlogic-document-online` | `082af3e93a1f` | 0 | 1144 |
| `neatlogic-event` | `e9ae979a49fb` | 25 | 45 |
| `neatlogic-event-base` | `b3f7136e46ff` | 13 | 25 |
| `neatlogic-framework` | `1fa8b28ecf73` | 1418 | 1624 |
| `neatlogic-inspect` | `59139342d9c6` | 85 | 116 |
| `neatlogic-inspect-base` | `d6627e97f389` | 38 | 52 |
| `neatlogic-itom-all` | `dd9a89e5fdd2` | 0 | 82 |
| `neatlogic-itsm` | `f4f260b8a0ad` | 559 | 708 |
| `neatlogic-itsm-base` | `b6ba75e91d99` | 511 | 523 |
| `neatlogic-knowledge` | `99ce0c3c466a` | 62 | 83 |
| `neatlogic-knowledge-base` | `8bd1ab92b440` | 68 | 86 |
| `neatlogic-parent` | `61c8ff25d0f0` | 0 | 12 |
| `neatlogic-rdm` | `38535ae37edc` | 141 | 181 |
| `neatlogic-rdm-base` | `36700040ce7e` | 88 | 98 |
| `neatlogic-report` | `34f5ea91970b` | 86 | 113 |
| `neatlogic-report-base` | `e4c35cb564b0` | 24 | 34 |
| `neatlogic-resources` | `1cd40610a8e3` | 0 | 11 |
| `neatlogic-runner` | `c96716f32c0f` | 328 | 344 |
| `neatlogic-springboot` | `40eea996fcb6` | 4 | 19 |
| `neatlogic-tagent` | `6bbb9fc33ce5` | 48 | 65 |
| `neatlogic-tagent-base` | `9a3604e711d4` | 44 | 55 |
| `neatlogic-tagent-client` | `5ef7386a793e` | 0 | 87 |
| `neatlogic-tenant` | `13e1d789fa0c` | 488 | 515 |
| `neatlogic-ui` | `4c63fb6dcc10` | 0 | 545 |
| `neatlogic-web` | `119dce9f9cb7` | 0 | 3029 |
| `neatlogic-web-alert` | `67cf2c2bd634` | 0 | 116 |
| `neatlogic-webroot` | `4ab613167bfe` | 0 | 17 |

### 1.1 关键观察

| 观察 | 证据 | 含义 |
|---|---|---|
| `neatlogic-framework` 单仓 1,418 Java 文件 | 占总量 22.4% | 平台能力高度集中在一个框架仓，而非分散到业务模块 |
| `*-base` 仓库共 13 个，与主仓并存 | 如 cmdb 472 + cmdb-base 447 | **双仓模式**：base 是数据模型/DTO 层，主仓是逻辑层。`AttrVo`/`CiVo` 均在 `-base` |
| `neatlogic-alert-base` Java = 0（仅 7 文件） | 见上表 | Alert 无独立 base 层，模型内联于主仓 |
| `neatlogic-itom-all` Java = 0 | 109 文件，含 `CODE-BUILD.md`/`LOCAL_INSTALL.md`/`mvn_install_neatlogic_war.sh`/`docker-compose.yml`/`COMMERCIAL_TERMS.md` | 聚合构建仓，非代码仓。此前所有「Java 2,500+」类断言的错误源头之一 |
| 前端 3 仓：`neatlogic-web` 3,056 / `neatlogic-ui` 572 / `neatlogic-web-alert` 143 | 见上表 | 前端体量与后端相当（非 `.git` 文件计），前端不是附属品 |
| `neatlogic-codehub` / `-base` 均 0 Java | 30 / 29 文件 | 纯前端/配置仓，不参与 Java 计数 |

---

## 2. 关键类字段数（CMDB 二阶模型真值）

> 来源：`neatlogic-cmdb-base` @ `b2aae25ae241` →
> `src/main/java/neatlogic/framework/cmdb/dto/ci/`
>
> **计数口径**：仅统计**顶层数据字段**，排除 `serialVersionUID` 与嵌套静态类内部字段。
> 此口径为 §4 勘误的起因——若不排除 `serialVersionUID`，四个类各虚高 1。

| 类 | 顶层数据字段 | 另计 | 定位 |
|---|---:|---|---|
| `AttrVo` | **45** | 嵌套 `Column` 类 5 字段 | 属性元数据，最复杂的模型对象 |
| `CiVo` | **42** | — | CI 实例 |
| `CiTypeVo` | **9** | — | CI 类型（**仅列表展示 VO**） |
| `AttrTypeVo` | **8** | — | 属性类型 |

### 2.1 为什么 `AttrVo` 是 P0-1 的真标准

`AttrVo` 45 个顶层字段中，与「可配置」直接相关的核心子集：

| 字段 | 类型 | 说明 |
|---|---|---|
| `config` | `JSONObject` | 属性配置主载荷 |
| `configStr` | `String` | config 的字符串形式（读写双通道） |
| `expression` | `String` | 表达式（派生属性） |
| `expressionList` | `List<ValueTextVo>` | 表达式展开 |
| `validatorId` / `validatorName` / `validatorHandler` | `Long`/`String`/`String` | **校验器三件套：ID + 名称 + Handler 类名** |
| `validConfig` | `JSONObject` | 校验器配置 |
| `targetCiId` / `targetCiName` / `targetCiLabel` / `targetIsVirtual` | — | 关联目标 CI |
| `inputType` / `inputTypeText` | `String` | 输入类型（`InputType.MT` 默认） |
| `needTargetCi` / `needConfig` / `needWholeRow` | `Boolean` | 建模行为开关 |
| `allowBeName` / `allowBeUnique` / `allowEdit` | — | 能力开关 |
| `canSearch` / `canInput` / `canImport` | `boolean` | 运行时能力（非元数据） |
| `maxAttrEntityCount` | `Long` | 引用 `CiEntityVo.MAX_ATTRENTITY_COUNT` |
| `columnList` | `List<Column>` | **动态列定义（name/label/type/jdbcType/needIndex）** |
| `ciVo` | `CiVo` | 反向引用宿主模型 |

**结论**：Orion 的 CMDB 属性模型若仅覆盖 `id/name/label/type` 四件套，则相对 `AttrVo` 缺失
**校验器体系（4 字段）、表达式体系（2 字段）、配置双通道（2 字段）、关联目标（4 字段）、
能力开关（5 字段）、动态列（1 字段 List\<Column\>）**。这是 P0-1 spec 的字段级真值依据。

---

## 3. 历史断言核对表（7 项）

> ⭐ = 机械计数，可复现，精确。
> ◇ = 解读性断言，易出错。
> **结论：机械计数 2/2 命中；解读性断言 5/7 错误（3 项 30–51% 偏差，1 项完全错误，1 项方向错误）。**

| # | 历史断言 | 来源类型 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | 巡检 66 个能力 | ⭐ `find -name '*Api.java'` | **66** | ✅ 精确命中 |
| 2 | 自动化 193 个能力 | ⭐ 同上 | **194** | ✅ +0.5%（口径含 1 个测试类） |
| 3 | Alert 22 个 Mapper | ⭐ 同上 | **15** | ❌ −32% |
| 4 | CIType 14 个属性 | ◇ 目视统计字段 | **`CiTypeVo` 9 / `CiVo` 42 / `AttrVo` 45** | ❌ 方向错误：拿列表 VO 当模型本体 |
| 5 | Ticket 8 种类型枚举 | ◇ 假设存在枚举 | **无枚举存在**，工单类型由配置驱动 | ❌ 完全错误（证实原报告自认） |
| 6 | Java 2,500+ / 4,230 / 4,831 | ⭐ 但**部分仓计数** | **6,328** | ❌ 全部低估 24%–51%（`itom-all` 空仓被当代码仓） |
| 7 | 模块 42 个 | ◇ | **44 仓库** | ⚠️ 接近但口径不同 |

### 3.1 额外核实（4 项，均为 ⭐）

| 断言 | 实测 | 判定 |
|---|---|---|
| `neatlogic-event` 无 Service 层（仅 Api） | **0 个 `*Service.java`**，15 个 `*Api.java` | ✅ 命中 |
| Runner 仅 3 类（`AutoexecRunner`/`PushRunner`/`TagentNotFoundChannel`） | 本地实现仅此 3 类 | ✅ 命中 |
| Alert changelog 用「日期目录 + version.json + sqldefine」 | `changelog/` 下 **6 个 `version.json` + 33 个 `.sql`**，目录形如 `2025-04-05` | ✅ 命中 |
| `itom-all` 是聚合构建仓 | 含 `CODE-BUILD.md`/`LOCAL_INSTALL.md`/`mvn_install_neatlogic_war.sh`/`docker-compose.yml`/`COMMERCIAL_TERMS.md`，Java = 0 | ✅ 命中 |

---

## 4. P0-0 新发现：`AlertBreaker` 系虚构标识

> **这是本次基线固化最重要的发现，直接影响 ADR-010 的有效性。**

### 4.1 核查命令与结果

```
$ find ~/refs/neatlogic -name '*Breaker*.java'
（空）
$ grep -rl 'Breaker' --include='*.java' ~/refs/neatlogic
（空）
```

| 检索项 | 命中文件数 |
|---|---:|
| `*Breaker*.java` 文件名 | **0** |
| 源码含 `Breaker` 字符串 | **0** |
| `[A-Za-z]+Breaker` 标识符 | **0** |

**全 44 仓库、6,328 个 Java 文件中，不存在任何名为 `Breaker` 或 `AlertBreaker` 的类、方法、字段或字符串。**

### 4.2 影响

ADR-010《AlertBreaker 并发模型选型》的立论是「对齐 NeatLogic 的 AlertBreaker 统一抽象，
采用 PG `SELECT FOR UPDATE` 行锁」。该前提**不成立**——参照系中无此类。

进一步核查 NeatLogic 实际的并发控制手段：

| 机制 | 命中文件数 | 分布 |
|---|---:|---|
| `SELECT ... FOR UPDATE`（显式行锁） | **9**（全仓） | 分散，非 Alert 模块 |
| `TransactionGroup` | **24** | 仅 `neatlogic-cmdb` 20 + `cmdb-base` 4 |
| `lockVersion` / `@Version` 乐观锁 | **0** | 无乐观锁 |
| Alert 模块 XML mapper 含 `FOR UPDATE` | **0** | Alert 17 个 XML 中无一使用行锁 |

**修正结论**：NeatLogic Alert 模块**不使用显式行锁**。其并发控制依赖事务分组（`TransactionGroup`，
集中式事务边界）而非锁。ADR-010 若继续以「对齐 NeatLogic」为论据，须改写为
「对齐 NeatLogic 的事务分组模式」，或独立论证 PG 行锁的必要性。

> 此项**不修改 ADR-010 文件**（RC-03），仅在此记录事实，供后续决策引用。

### 4.3 方法论教训

`AlertBreaker` 这一名称在 73 份历史报告中被反复引用却从未验证过存在性。
它符合「解读性断言（◇）」的全部特征：听起来合理、内部自洽、易被后续引用继承。
**这正是 P0-0 存在的意义——机械计数（⭐）能证伪虚构，解读断言（◇）不能。**

---

## 5. 对既有报告的影响清单

| 文件 | 受影响结论 | 处置 |
|---|---|---|
| `reports/expert-reviews/big-tech-expert-granularity-comparison-2026-10-11.md` | 「Java 2,500+」「CIType 14 属性」「Alert 22 Mapper」「Ticket 8 类型」 | 已加勘误（commit `372ad605c`） |
| `reports/module-upgrade-designs/reference-verification-and-refined-plan-2026-10-11.md` | P0-1 CMDB spec 字段集 | 已按 §2 重写（commit `ffe9adac5`） |
| `docs/adr/ADR-010-AlertBreaker-并发模型选型.md` | 立论前提（§4.2） | **待处理**：需用户确认后改写论据 |
| 其余 73 份历史报告 | 依赖 `/tmp/neatlogic-itom-all`（已删除） | 基线以本文为准，不回溯修改 |

---

## 6. 复现命令

### 6.1 从零重建基线

```bash
mkdir -p ~/refs/neatlogic && cd ~/refs/neatlogic
for r in $(gh repo list neatlogic --limit 50 --json name -q '.[].name'); do
  [ -d "$r" ] || git clone -q --depth 1 "https://github.com/neatlogic/$r.git"
done
ls -d */ | wc -l   # → 44
```

### 6.2 规模计数

```bash
cd ~/refs/neatlogic
find . -name '*.java' -not -path '*/.git/*' | wc -l          # → 6328
find . -name '*.java' -not -path '*/.git/*' -exec cat {} + | wc -l  # → 626522
find . -type f -not -path '*/.git/*' | wc -l                  # → 14177
```

### 6.3 每仓 SHA 与计数

```bash
cd ~/refs/neatlogic
for d in */; do
  git -C "$d" rev-parse HEAD
  find "$d" -name '*.java' -not -path '*/.git/*' | wc -l
done
```

### 6.4 关键类字段数（口径见 §2）

```bash
cd ~/refs/neatlogic/neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/dto/ci
for f in CiVo.java AttrVo.java CiTypeVo.java AttrTypeVo.java; do
  awk '/^[[:space:]]+public (static )?class [A-Za-z]+ \{/ {found=1}
       !found && /^[[:space:]]+(private|protected)[[:space:]]+[A-Za-z0-9_]/' "$f" \
    | grep -v serialVersionUID | wc -l
done
# → 42  45  9  8
```

### 6.5 虚构标识证伪（§4）

```bash
find ~/refs/neatlogic -name '*Breaker*.java'                          # → 空
grep -rl 'Breaker' --include='*.java' ~/refs/neatlogic               # → 空
grep -rl 'FOR UPDATE' --include='*.java' ~/refs/neatlogic | wc -l    # → 9
grep -rl 'TransactionGroup' --include='*.java' ~/refs/neatlogic|wc -l # → 24
grep -rl 'lockVersion\|@Version' --include='*.java' ~/refs/neatlogic|wc -l # → 0
```

### 6.6 Alert changelog 模式

```bash
find ~/refs/neatlogic/neatlogic-alert -type d -path '*changelog*'
find ~/refs/neatlogic/neatlogic-alert -name 'version.json' | wc -l   # → 6
find ~/refs/neatlogic/neatlogic-alert -name '*.sql' | wc -l          # → 33
```

---

## 7. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 44 仓库全部可 clone 且 SHA 固定 | §6.1 + §6.3 |
| 2 | 6,328 / 626,522 / 14,177 三数可复现 | §6.2 |
| 3 | 4 个关键类字段数为 42/45/9/8 | §6.4 |
| 4 | `Breaker` 在全仓 0 命中 | §6.5 |
| 5 | 本文不含任何生产代码改动 | `git diff -- '*.go' '*.ts' '*.tsx'` 为空 |
| 6 | 本文不含人天/工期估算 | 全文检索 `人天`/`工期`/`人日` 为空 |

---

*基线固化完成。后续所有「对齐 NeatLogic」类断言，必须先经 §6 命令机械验证，
不得以解读性描述（◇）作为引用依据。*
