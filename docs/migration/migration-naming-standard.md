# 迁移文件命名规范 (Migration Naming Convention)

> 统一 3 种命名模式，为 Phase 5 Go 微服务迁移提供标准。

## 现状分析

扫描 `blueprints/` 下 **135 个** SQL 迁移文件，发现 **3 种命名模式**：

| 模式 | 示例 | 数量 | 占比 |
|------|------|------|------|
| **A: SIMPLE_NUM** `NNN_description.sql` | `001_create_tables.sql`, `002_add_budget_optimization_utilization.sql` | 41 | 30.4% |
| **B: PREFIXED_NUM** `module_NNN_description.sql` | `pipeline_001_create_pipeline_tables.sql`, `deploy_003_create_environments_and_logs.sql` | 74 | 54.8% |
| **C: OTHER** 混合/不标准 | `001-platform-core-base-schema.sql`, `001_init_visor_tables.sql` | 20 | 14.8% |

### 模式 B 的 module 前缀分布

| Module | 文件数 | 范围 |
|--------|--------|------|
| pipeline | 5 | 001-004 |
| deploy | 4 | 001-004 |
| build | 3 | 001-003 |
| approval | 2 | 001-002 |
| canary | 1 | 001 |
| runner | 1 | 001 |
| ticket | 1 | 001 |
| pipeline-template | 1 | 001 |

### 模式 A 的典型特征

单模块服务（如 `orion-finops-svc-go`, `orion-monitor-svc-go`）只用 `NNN_` 前缀，
因为模块上下文已在目录名中体现，无需重复。

### 模式 C 的不规范项

| 文件 | 问题 |
|------|------|
| `001-platform-core-base-schema.sql` | 使用 `-` 分隔符而非 `_`，包含多余描述 |
| `001_init_visor_tables.sql` | `init` 是模糊动作，缺乏具体描述 |
| `001_init.sql` (38份) | 过于通用，无法从文件名判断内容 |
| `*.down.sql` | Rollback 文件命名不一致 |

## 统一规范

### 规范规则 (v1.0)

**所有迁移文件采用以下命名格式：**

```
NNN_description.sql
```

**规则：**

1. **序号**: 3 位数字，从 `001` 开始，每个服务模块独立编号
2. **分隔符**: 使用单个下划线 `_`
3. **描述**: 全小写，单词用下划线分隔，必须包含 `动词_表名`
4. **回滚文件**: 同文件名 + `.down.sql` 后缀

### 动词规范

| 动作 | 动词 | 示例 |
|------|------|------|
| 创建表 | `create_` | `001_create_pipeline_tables.sql` |
| 添加列 | `add_col_` | `002_add_col_deleted_at_to_pipelines.sql` |
| 添加索引 | `add_idx_` | `003_add_idx_pipelines_status.sql` |
| 添加约束 | `add_fk_` | `004_add_fk_pipeline_runs_pipeline_id.sql` |
| 修改列 | `alter_col_` | `005_alter_col_pipelines_config_type.sql` |
| 删除列 | `drop_col_` | `006_drop_col_pipelines_legacy_id.sql` |
| 重命名 | `rename_` | `007_rename_pipelines_config_to_payload.sql` |

### 禁止项

- 禁止使用 `-` 作为分隔符
- 禁止 `init.sql` / `init_tables.sql` 等无描述文件
- 禁止序号跳跃（001, 003 — 缺失 002）
- 禁止大写字符
- 禁止模块前缀（如 `pipeline_001_`），模块上下文由目录决定

## 转换映射

### 模式 B → 标准格式

```
CI-CD 模块 (blueprints/orion-ci-cd-svc-go/migrations/)
  pipeline_001_create_pipeline_tables.sql       → 001_create_pipeline_tables.sql
  pipeline_002_create_template_trigger_...sql   → 002_create_template_trigger_version_rbac_gate_tables.sql
  deploy_001_create_deploy_tables.sql           → 001_create_deploy_tables.sql
  build_001_create_build_tables.sql             → 001_create_build_tables.sql
  canary_001_create_canary_tables.sql           → 001_create_canary_tables.sql
  runner_001_create_runner_tables.sql           → 001_create_runner_tables.sql
  ticket_001_create_ticket_tables.sql           → 001_create_ticket_tables.sql
```

> 注意：CI-CD 服务因多模块混合，转换时需要合并序号，避免重复。

### 模式 C → 标准格式

```
blueprints/orion-platform-core/migrations/
  001-platform-core-base-schema.sql  → 001_create_platform_core_schema.sql

blueprints/orion-visor-svc/migrations/
  001_init_visor_tables.sql  → 001_create_visor_tables.sql

blueprints/orion-monitor-svc/migrations/
  001_init.sql  → 001_create_monitor_tables.sql
```

### 模式 A → 已合规

41 个 `NNN_description.sql` 文件无需修改（除 `001_init.sql` 需重命名为具体描述）。

## 执行策略

| 阶段 | 内容 | 涉及文件 |
|------|------|---------|
| Phase 1 | 标准化 CI-CD 多模块命名（去 module_ 前缀） | 18 个文件 |
| Phase 2 | 标准化其他不规范命名 | ~20 个文件 |
| Phase 3 | 新增迁移文件严格遵循规范 | 所有新文件 |

## 参考

- Flyway 命名规范: `V{timestamp}__{description}.sql`
- golang-migrate 推荐: `NNN_description.sql`
- 本项目采用 golang-migrate 风格，因 Go 微服务主要使用此工具
