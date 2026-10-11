# CMDB 升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/cmdb*`
**基线数据**：`reports/expert-reviews/cmdb-expert-rereview-2026-10-01.md` + `reports/feature-parity/parity-analysis-48subdomains-2026-10-03.md` §2.1
**上游评审**：`reports/expert-reviews/cmdb-expert-rereview-2026-10-01.md`

---

## 1. TL;DR

- **当前完成度**：28%（复评中值，置信度 ±8%）
- **目标完成度**：65-70%（含 CI 类型系统、Validator 服务层、Collector 真实接线、Migration 编排归一化）
- **关键改动**：
  1. 新建 `citype` + `attr` 两个服务层（从 TS 权威 CITypeService 469 行移植），补齐 G0 核心缺口
  2. `cmdb-validator` 补 `service/` 目录（当前完全缺失，handler 直连 repo 反模式）
  3. 3 个 transport（snmp/ssh/sql）解除 `//go:build ignore` 冻结
  4. Migration 从 256/608/609/667/693 分散号编排到 699+ CMDB 前缀连续段
- **不动的部分**：CI 实体 CRUD（80% 已完整）+ 关系 CRUD + 采集器目录

---

## 2. 当前状态（代码实证）

| 项目 | 位置 | 行数 | 状态 |
|------|------|------|------|
| CMDB 主模块 | `internal/cmdb/` | 6258 行 / 42 函数 / 30+ CRUD | ✅ 真实实现（唯一亮点） |
| CI 关系 | `internal/cmdb-relationship/` | 1754 行 / 8 struct | ⚠️ service 0 方法（CRUD 骨架直连） |
| CI 批量导入 | `internal/cmdb-import/` | 3792 行 / 6 struct | ⚠️ service 0 方法 |
| 校验器 | `internal/cmdb-validator/` | 2320 行 / 11 引擎文件 | ⚠️ **完全无 service/ 目录**，handler 直连 repo |
| Collector SPI | `internal/cmdb-collector/` | 6 方法 | ⚠️ Registry.Register 零调用 |
| Transport | `internal/cmdb/transport/{snmp,ssh,sql}.go` | — | ❌ `//go:build ignore` 冻结 |
| CI 类型系统 | `internal/cmdb-citype/` 或 `internal/cmdb/attr/` | — | ❌ **G0 完全缺失** |
| Migration 编号 | 256 / 608 / 609 / 667 / 693 / 002_fts_search | 18 张 cmdb_ 表 | ⚠️ 编排混乱，无 001 |

**关键实证**：
- `grep "citype\|CIType" internal/` → 0 命中（Go 侧完全无 CITypeService）
- `ls internal/cmdb-validator/` → 无 `service/` 目录（handler 直连 repo）
- TS 权威 `legacy/orion-platform-service-ts/src/services/cmdb/ci-type/CITypeService.ts` 469 行可移植

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | CI Type Registry（citype） | **G0** | NeatLogic 有 CIType CRUD + 版本 + 属性绑定；Orion 完全无 |
| G0-2 | CI Attribute 系统（attr） | **G0** | 属性定义、类型、约束（unique/null/enumeration）全缺 |
| G0-3 | Collector SPI 真实接线 | **G0** | Registry.Register 从未被调用，采集插件永远不注册 |
| G0-4 | 3 Transport 真实可用 | **G0** | snmp/ssh/sql 冻结，异构源采集不可用 |
| G1-1 | Validator 服务层 | **G1** | 2320 行引擎有，但无 service 封装 |
| G1-2 | Relationship 服务层 | **G1** | 1754 行但 service 0 方法 |
| G1-3 | BatchImport 服务层 | **G1** | 3792 行但 service 0 方法 |
| G2-1 | Migration 编排 | **G2** | 18 张表分布 5 个编号文件，无 001 |
| G2-2 | 高级能力（discovery/mongodb/globalsearch/tag/mq） | **G2** | 667/608 建了表但无人用 |
| G3-1 | transaction/legalvalid/sync/group | **G3** | 企业能力空白，非近期目标 |

---

## 4. 升级目标

### 4.1 架构层

- **CI 类型系统三层栈**：`CIType → CIAttribute → CIValidator`，从 TS 权威移植到 Go
- **Collector SPI 生产化**：Registry 由工厂函数注册（factory.go），main.go 中调用 RegisterAll()
- **Transport 生产化**：snmp/ssh/sql 三协议解冻结，支持异构源采集
- **Validator 服务封装**：所有 validators 引擎通过 service.ValidatorService 暴露

### 4.2 数据模型层（Migration 新增）

新增 Migration 699-704（编排归一化）：
- `699_cmdb_ci_types.sql`：CI 类型主表（id/tenant_id/name/type_key/version/attributes_json/status）
- `700_cmdb_ci_type_versions.sql`：类型版本快照
- `701_cmdb_ci_attributes.sql`：属性定义（type/constraints/enumeration/is_required）
- `702_cmdb_collectors.sql`：Collector SPI 注册表
- `703_cmdb_discovery_rules.sql`：发现规则（608 已建 discovery_jobs 但无规则定义）
- `704_cmdb_ci_attr_values.sql`：属性值 EAV（补 cmdb_attribute_values 已有）

### 4.3 API 层

新增路由挂载（挂 `auth.RequirePermission("cmdb", "write")`）：
- `/api/v1/cmdb/v2/citypes`：CRUD 5 端点 + 版本 2 端点
- `/api/v1/cmdb/v2/attributes`：CRUD 4 端点 + 绑定 2 端点
- `/api/v1/cmdb/v2/validators/rules`：从 handler 抽到 service 后暴露 6 端点
- `/api/v1/cmdb/v2/discovery/jobs`：从 608 建表激活为 5 端点
- `/api/v1/cmdb/v2/batchimport`：从 667 表激活为 6 端点（含校验+回滚）

---

## 5. 依赖链

### 5.1 前置模块

- **无强前置**：CMDB 是数据底座，理论上应先于其他域完成
- **弱依赖**：审计日志（`internal/audit/`）用于 CI 变更追踪

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/audit/` (8930 行) | CI 变更审计 |
| `internal/otlp-collector/` | Collector SPI 注册基类 |
| `internal/cmdb-validator/validators/` (11 引擎) | 通过新 service 封装 |
| TS 权威 `CITypeService.ts` (469 行) | 移植源 |
| TS 权威 `CmdbTopologyService.ts` (375 行) | 拓扑实现移植 |

### 5.3 下游消费者

- **DevOps**：`apppipeline` 需要 CI 作为应用实体来源（见 devops-upgrade-design）
- **Automation**：Runner 目标机器应关联 CI 记录
- **Inspection**：巡检目标 CI 从 CMDB 读取
- **Alert**：告警资源关联 CI（CMDB topolgy 已存在）
- **BI**：血缘起点为 CMDB CI

---

## 6. 实施步骤（按依赖链，不估算人天）

### 阶段 1：Migration 编排归一化（前置所有工作）

1. 编写 699-704 号新 migration（不改动 256/608/609/667/693）
2. 在 `internal/cmdb/migrations/README.md` 中记录 CMDB 相关表清单与依赖图
3. 修复 `002_fts_search.sql` 依赖 609 表的顺序问题（改为 705 号）
4. 验证：`migrate up` 全流程跑通，`migrate down 699` 单表回滚

### 阶段 2：CI 类型系统核心

1. 从 TS 权威 `CITypeService.ts` 移植核心逻辑到 `internal/cmdb-citype/service/`
2. 移植 4 个 Repository（CIType/CITypeVersion/CIAttribute）
3. 新增 `internal/cmdb-citype/models/`（CIType/CIAttribute/CITypeVersion）
4. 新增 handler 暴露 7 端点，挂 `/api/v1/cmdb/v2/*`

### 阶段 3：Validator 服务层封装

1. 新建 `internal/cmdb-validator/service/service.go`
2. 封装现有 11 个 validators 引擎为 `ValidatorService.Validate(ctx, ci, rules)`
3. 现有 handler 改为调用 service 而非直连 repo
4. 新增批量校验端点（对齐 256 migration 表）

### 阶段 4：Transport 解冻结

1. 移除 `//go:build ignore` 标记（snmp/ssh/sql 三个文件）
2. 补齐 transport 依赖：`github.com/gosnmp/gosnmp`、`golang.org/x/crypto/ssh`、标准库 `database/sql`
3. Collector SPI：新建 `internal/cmdb-collector/factory.go`，暴露 `RegisterAll()`
4. main.go 中调用 `collector.RegisterAll()` 完成初始化

### 阶段 5：Collector SPI 生产化

1. `Registry.Register` 由 factory 消费
2. Collector 生命周期管理：注册/心跳/健康检查
3. 从 608 表激活 Collector 记录

### 阶段 6：高级能力补漏

- discovery rules 服务层（激活 608 discovery_jobs）
- batchimport 服务层（激活 667 import_jobs/import_records）
- mongodb globalsearch 服务层（如有 MongoDB 双存储需求）

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# CI 类型系统存在
grep -r "CIType\|citype" internal/cmdb-citype/ | wc -l
# 期望：>50 命中

# Validator 服务层存在
ls internal/cmdb-validator/service/service.go
# 期望：文件存在且 >200 行

# Transport 已解冻结
grep -L "//go:build ignore" internal/cmdb/transport/*.go
# 期望：3 个文件都不含 //go:build ignore

# Collector SPI 已接线
grep -n "RegisterAll\|Register(" main.go app.go cmd/server/main.go
# 期望：至少 1 处调用
```

### 7.2 单元测试

- CITypeService CRUD：6 测试用例
- CIAttribute 约束校验（unique/enumeration/null）：8 测试用例
- ValidatorService 批量：5 测试用例
- Transport 三种：snmp 2 用例、ssh 3 用例、sql 3 用例
- Collector SPI Register：4 用例

### 7.3 e2e 验证

1. 创建 CIType "Server" → 绑定 5 属性（ip/os/cpu/memory/disk）
2. 通过 ssh transport 采集一台真实服务器 → 写入 cmdb_cis
3. Validator 校验 ip 唯一性 → 返回违规列表
4. CI 变更写入 audit 表
5. `POST /batchimport` 上传 100 条 CI → 全部落库或全部回滚

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| TS 权威移植到 Go 语义漂移 | 中 | 高 | 用同一批测试数据对比 TS 与 Go 输出 |
| Migration 699+ 号与现有表冲突 | 低 | 高 | 先在 feature 分支独立跑一次全流程 |
| Collector SPI 并发注册冲突 | 中 | 中 | 用 `sync.Once` 保护注册入口 |
| Transport 依赖引入 CVE | 中 | 中 | 依赖锁版本，走 `go vet` + `gosec` |
| Validator 服务层封装破坏现有 handler | 中 | 中 | 保留 handler 直连 repo 的降级开关 |

### 8.2 回滚策略

- **CI 类型系统回滚**：删除 699/700/701 migration + `internal/cmdb-citype/` 目录
- **Validator 服务层回滚**：handler 切回直连 repo（保留原路径）
- **Transport 回滚**：加回 `//go:build ignore`
- **Collector SPI 回滚**：main.go 移除 `RegisterAll()` 调用
- **Migration 编号回滚**：`migrate down 699` 单段回滚，不影响其他模块

### 8.3 认知边界

- 未量化 CITypeService TS→Go 移植的具体折扣（估计 30-40% 可复用，未实测）
- 未验证现有 30+ CRUD 函数是否与新的类型系统兼容
- 未评估 MongoDB 双存储需求是否真的存在（NeatLogic 有，Orion 可放弃）
- 未评估 cmdb-drift 相关表（693 号）是否需要一并激活

---

**文档编号**：`cmdb-upgrade-design-2026-10-03.md`
**关联报告**：`cmdb-expert-rereview-2026-10-01.md` / `parity-analysis-48subdomains-2026-10-03.md` §2.1
**交叉依赖**：DevOps（应用实体） / Inspection（巡检目标） / Alert（资源关联） / BI（血缘源）
