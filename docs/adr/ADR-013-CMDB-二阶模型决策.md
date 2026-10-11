# ADR-013: CMDB 二阶模型决策

| 元数据 | |
|--------|------|
| 状态 | 提议中（Proposed）|
| 提出日期 | 2026-10-03 |
| 决策日期 | 待确认 |
| 提出人 | 架构团队 |
| 决策人 | 待确认 |
| 关联模块 | CMDB |
| 前置依赖 | ADR-005 数据库选型（PG 14+）、ADR-011 多租户存储隔离 |
| 关联风险 | R-P0-07（CMDB 二阶模型迁移破坏现有 cmdb_cis）、CC 风险登记册 §1.5 |
| 参考对标 | NeatLogic 4 层模型（NL-1 一手：Type → Template → Instance → Transaction）|

---

## 1. 背景与问题

### 1.1 Orion 现状（单层模型）

当前 Orion CMDB 使用**单层 CI 模型**：

```sql
CREATE TABLE cmdb_cis (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    ci_type TEXT,           -- 'Server' / 'Application' / 'Database' 等（自由字符串）
    name TEXT,
    properties JSONB,      -- 属性自由展开
    ...
);
```

**问题**：
1. `ci_type` 是自由字符串，无枚举约束
2. `properties` JSONB 无法做字段级校验 / 索引
3. 无法表达"Server 应该有 memory 属性"这种类型约束
4. 无法表达"应用 → 服务器"的关联拓扑

### 1.2 NeatLogic 一手（4 层模型）

NL-1 一手代码扫描发现 NeatLogic 使用**Type → Template → Instance → Transaction** 4 层：

```java
// Layer 1: Type（类型定义）
public class CIType {
    private Long id;
    private String name;         // 'Server', 'Database', ...
    private String description;
    private List<CIAttribute> attributes;  // 属性定义
}

// Layer 2: Template（配置模板）
public class CITemplate {
    private Long id;
    private CIType type;
    private String templateName; // 'Windows Web Server'
    private List<CIAttribute> attributes;  // 模板属性（继承 Type）
}

// Layer 3: Instance（实际实例）
public class CI {
    private Long id;
    private CITemplate template;  // 从哪个模板创建
    private List<CIAttribute> attributeValues;  // 属性实际值
}

// Layer 4: Transaction（变更事务）
public class TransactionGroup {
    private Long id;
    private List<CIChange> changes;  // 批量变更
    private ApprovalStatus status;
}
```

**核心能力**：
- ✅ 类型系统强约束（`CIType.attributes` 定义必须字段）
- ✅ 模板复用（`CITemplate` 减少重复配置）
- ✅ 变更事务化（`TransactionGroup` 支持批量回滚）
- ✅ 关联拓扑（`CI` 可指向其他 `CI`）

### 1.3 决策驱动问题

**Q1**：Orion 是否需要 4 层模型？
- 若"是"：Migration 破坏面大（R-P0-07 阻塞）
- 若"否"：能力天花板低（无法深度对标 ServiceNow/iTop）

**Q2**：是否需要 Type 抽象？
- 若"是"：可以做字段级约束
- 若"否"：现有 `ci_type` 字符串够用

**Q3**：是否需要 TransactionGroup？
- 若"是"：批量变更可回滚
- 若"否"：单个 CI 变更即可

### 1.4 决策目标

- 决策 CMDB 数据模型演进路径
- 明确与现有 `cmdb_cis` 表的兼容策略
- 定义 Migration 699-704 的最终结构

---

## 2. 备选方案对比

### 2.1 方案 A：4 层模型（NeatLogic 完整方案）

**表结构**：
```sql
-- Layer 1: 类型定义
CREATE TABLE cmdb_ci_types (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,           -- 'Server', 'Database', ...
    description TEXT,
    attributes JSONB NOT NULL,   -- [{name, type, required, default}, ...]
    UNIQUE (tenant_id, name)
);

-- Layer 2: 模板
CREATE TABLE cmdb_ci_templates (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    type_id UUID REFERENCES cmdb_ci_types(id),
    name TEXT NOT NULL,           -- 'Windows Web Server'
    attribute_defaults JSONB,     -- 模板默认值
    UNIQUE (tenant_id, name)
);

-- Layer 3: 实例（重构 cmdb_cis）
CREATE TABLE cmdb_cis_v2 (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    template_id UUID REFERENCES cmdb_ci_templates(id),
    name TEXT NOT NULL,
    attribute_values JSONB NOT NULL,  -- 属性实际值
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Layer 4: 变更事务
CREATE TABLE cmdb_transaction_groups (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'draft',  -- 'draft', 'pending', 'approved', 'applied', 'rollback'
    changes JSONB NOT NULL,       -- [{ci_id, field, old_value, new_value}, ...]
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**优点**：
- ✅ 与 NeatLogic 1:1 对齐
- ✅ 类型系统强约束
- ✅ 模板复用
- ✅ 变更事务化（批量回滚）
- ✅ 未来可做 CMDB 深度能力（拓扑图、变更审计、字段级血缘）

**缺点**：
- ❌ **破坏性大**：现有 `cmdb_cis` 表完全重构
- ❌ Migration 704 是 P0 风险
- ❌ 所有读取 cmdb_cis 的模块需改造
- ❌ 客户升级风险高（数据迁移脚本需仔细）
- ❌ 实施复杂度高（约 2000+ 行代码变更）

**Migration 策略**：
- 新建 4 表 + 旧表保留（双写过渡）
- 数据回填脚本（旧 ci_type → 新 ci_types）
- 2 周过渡期后切读新表

### 2.2 方案 B：3 层模型（省略 Transaction）

**表结构**：
```sql
CREATE TABLE cmdb_ci_types (...);  -- 同方案 A
CREATE TABLE cmdb_ci_templates (...);  -- 同方案 A
-- 无 cmdb_transaction_groups
-- cmdb_cis_v2 简化（不含变更审计）
```

**优点**：
- ✅ 保留类型系统
- ✅ 简化事务化（依赖现有 audit 表）
- ✅ Migration 中等复杂度

**缺点**：
- ⚠️ 无批量变更能力
- ⚠️ 与 NL 建模部分偏离（缺 Transaction 层）
- ⚠️ 未来做深度能力仍需扩展

### 2.3 方案 C：2 层模型（渐进式，仅 Type 抽象）

**表结构**：
```sql
-- Layer 1: 类型定义（新增）
CREATE TABLE cmdb_ci_types (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    attributes JSONB NOT NULL,
    UNIQUE (tenant_id, name)
);

-- Layer 2: 实例（现有 cmdb_cis 扩展）
ALTER TABLE cmdb_cis 
  ADD COLUMN type_id UUID REFERENCES cmdb_ci_types(id);

-- 保留 ci_type 字段（兼容）
-- 保留 properties JSONB（兼容）
```

**优点**：
- ✅ **迁移友好**：现有 `cmdb_cis` 保留，仅加 `type_id` 外键
- ✅ 提供类型系统能力（字段级约束可选）
- ✅ Migration 简单（1 张新表 + 1 个 ALTER）
- ✅ 兼容现有代码（`ci_type` 字段保留）
- ✅ 渐进式引入（未来可升级到方案 B/A）

**缺点**：
- ❌ 无模板复用（需未来扩展）
- ❌ 无变更事务（依赖 audit）
- ❌ 与 NL 4 层建模偏离
- ⚠️ 类型系统是"可选"的（type_id 可为 NULL）

### 2.4 方案 D：保持单层（Orion 现状）

**优点**：
- ✅ 零改动
- ✅ 兼容所有现有代码
- ✅ Migration 简单

**缺点**：
- ❌ 无类型系统
- ❌ 无模板
- ❌ 无变更事务
- ❌ 能力天花板低（无法对标 ServiceNow/iTop）
- ❌ R-P0-07 风险仍然存在（不做二阶模型就无法深度 CMDB）

---

## 3. 决策

### 3.1 选定方案

**方案 C：2 层模型（渐进式）**

理由：
1. **迁移友好**：不破坏现有 `cmdb_cis`，仅加 `type_id` 外键（可 NULL）
2. **风险可控**：R-P0-07 从 P0 降至 P1（因为无破坏性迁移）
3. **渐进式演进**：未来可升级到方案 B（加模板）或方案 A（加事务）
4. **能力足够**：类型系统是 CMDB 深度能力的核心，2 层已提供
5. **实施简单**：1 张新表 + 1 个 ALTER + 数据回填脚本

### 3.2 关键设计决定

#### 3.2.1 Migration 结构

**Migration 700**：`cmdb_ci_types` 表创建
```sql
CREATE TABLE cmdb_ci_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    attributes JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_cmdb_ci_types_tenant ON cmdb_ci_types(tenant_id);
CREATE INDEX idx_cmdb_ci_types_attributes_gin ON cmdb_ci_types USING GIN(attributes);
```

**Migration 701**：`cmdb_cis` 加 type_id 外键
```sql
ALTER TABLE cmdb_cis
  ADD COLUMN type_id UUID REFERENCES cmdb_ci_types(id);

CREATE INDEX idx_cmdb_cis_type_id ON cmdb_cis(type_id);
```

**Migration 702**：数据回填脚本（可选）
```sql
-- 为现有 CI 数据创建对应的 type_id
-- 假设：现有 ci_type 字段值即为新类型名
INSERT INTO cmdb_ci_types (tenant_id, name, attributes)
SELECT DISTINCT 
    tenant_id, 
    ci_type AS name, 
    '[]'::JSONB AS attributes  -- 空属性定义，用户可后续补充
FROM cmdb_cis
WHERE ci_type IS NOT NULL
ON CONFLICT (tenant_id, name) DO NOTHING;

UPDATE cmdb_cis c
SET type_id = t.id
FROM cmdb_ci_types t
WHERE c.tenant_id = t.tenant_id
  AND c.ci_type = t.name
  AND c.type_id IS NULL;
```

#### 3.2.2 `cmdb_ci_types.attributes` 结构

```json
[
  {"name": "memory", "type": "int", "required": true, "default": 8192, "unit": "MB"},
  {"name": "cpu", "type": "int", "required": true, "default": 4, "unit": "core"},
  {"name": "os", "type": "string", "required": true, "enum": ["Linux", "Windows", "macOS"]},
  {"name": "ip", "type": "string", "required": false, "format": "ipv4"}
]
```

**校验**：
- Repository 层在插入 `cmdb_cis` 时校验 `properties` 与 `type_id` 的 `attributes` 是否匹配
- 未匹配则返回 400 Validation Error

#### 3.2.3 Repository 接口

```go
type CITypeRepository interface {
    Create(ctx context.Context, tenantID string, t *CIType) (*CIType, error)
    GetByID(ctx context.Context, tenantID, id string) (*CIType, error)
    ListByTenant(ctx context.Context, tenantID string) ([]CIType, error)
    Update(ctx context.Context, tenantID string, t *CIType) error
    Delete(ctx context.Context, tenantID, id string) error
}

type CIRelatedToTypeRepository interface {
    // 新增：获取 CI 及其类型信息
    GetWithType(ctx context.Context, tenantID, ciID string) (*CI, *CIType, error)
    
    // 新增：按类型列出 CI
    ListByType(ctx context.Context, tenantID, typeID string) ([]CI, error)
}
```

#### 3.2.4 兼容策略

- **`ci_type` 字段保留**：所有现有代码继续读取
- **`type_id` 字段可选**：可为 NULL（兼容旧数据）
- **`attributes` 校验可选**：若 `type_id` 为 NULL 则跳过校验
- **Migration 回填**：一次性为所有旧数据补 type_id

### 3.3 演进路径

```
当前: 单层（cmdb_cis）
    │
    ├─ 阶段 1（本 ADR）: 2 层（加 cmdb_ci_types）
    │   └─ 迁移友好，风险低
    │
    ├─ 阶段 2（未来）: 3 层（加 cmdb_ci_templates）
    │   └─ 模板复用，降低配置成本
    │
    └─ 阶段 3（远期）: 4 层（加 cmdb_transaction_groups）
        └─ 变更事务化，支持批量回滚
```

**触发升级条件**：
- 阶段 2：客户提出"我想用模板批量创建 CI"（预计 S3 阶段）
- 阶段 3：客户提出"批量变更 CI 需要回滚"（预计 S6 阶段）

### 3.4 与 NeatLogic 的对齐细节

| 层 | NeatLogic | Orion ADR-013 |
|----|-----------|---------------|
| Type | ✅ | ✅（本 ADR 阶段 1）|
| Template | ✅ | ⏸ 未来阶段 2 |
| Instance | ✅ | ✅（现有 cmdb_cis）|
| Transaction | ✅ | ⏸ 未来阶段 3 |

---

## 4. 风险与缓解

### 4.1 已知风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 现有 CI 数据 type_id 回填失败 | 中 | 中 | 回填脚本幂等 + 事务包裹 + 备份原表 |
| 类型系统校验破坏现有写入 | 低 | 中 | Repository 层可选校验（type_id 为 NULL 时跳过）|
| 客户不填 type_id | 中 | 低 | 保持向后兼容（type_id 可 NULL）|
| 未来升级到方案 A 破坏 | 低 | 高 | 分阶段迁移（阶段 2、3 独立 ADR）|

### 4.2 监控指标

| 指标 | 类型 | 阈值 |
|------|------|------|
| `cmdb_ci_type_coverage_ratio` | Gauge | 未设置 type_id 的 CI 比例 > 30% 告警 |
| `cmdb_ci_type_validation_errors_total` | Counter | > 10/min 告警 |
| `cmdb_ci_type_backfill_failed_total` | Counter | > 0 告警 |

---

## 5. 影响面

### 5.1 对风险登记册的影响

- **R-P0-07**（CMDB 二阶模型迁移破坏现有 cmdb_cis）：本 ADR 选择方案 C（渐进式），**从 P0 降至 P2**（因为无破坏性迁移）
- 新增 **R-P2-18**：类型系统校验破坏现有写入（低-中）
- 新增 **R-P2-19**：type_id 回填脚本失败（低-中）

### 5.2 对执行阶段的影响

| 阶段 | 影响 | 门控 |
|------|------|------|
| S0 | 新增 Migration 700-702 | 必过 |
| S1 CMDB | CITypeRepository 落地 + 单测 | 必过 |
| S2-S6 | 现有 CI 读取兼容（ci_type + type_id）| 无变化 |

### 5.3 对 AA 数据模型设计的影响

- Migration 700-704 需重新分配：
  - **700**：cmdb_ci_types 表（原方案：cmdb_ci_type_system 完整 4 层）
  - **701**：cmdb_cis 加 type_id（原方案：cmdb_ci_properties 展开表）
  - **702**：数据回填脚本（新）
  - **703-704**：预留（阶段 2 模板 / 阶段 3 事务）

---

## 6. 相关 ADR

- **ADR-005** 数据库选型（PG 14+，JSONB 支持）
- **ADR-011** 多租户存储隔离（Schema-per-tenant 增强路径）
- **ADR-012** Factory+Handler 注册表（未来 CI 类型扩展可用 Factory 模式）

---

## 7. 参考

- NL-1 一手证据：`reports/expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md` §CMDB
- v5 综合报告：`cross-review-synthesis-2026-10-03-v5.md` §CMDB
- AA 数据模型：`reports/module-upgrade-designs/data-model-migration-design-2026-10-03.md` Migration 699-704
- 风险登记册：`risk-fallback-design-2026-10-03.md` R-P0-07

---

**文档编号**：`ADR-013-CMDB-二阶模型决策.md`
**下一步**：本 ADR 决策批准 → 更新 AA 数据模型 Migration 700-702 → 更新 CC 风险登记册 R-P0-07 状态
