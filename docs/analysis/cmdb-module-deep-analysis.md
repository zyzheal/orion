# CMDB 模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/cmdb/`

---

## 模块概览

CMDB 模块实现了完整的配置管理数据库，支持 CI（配置项）CRUD、关系管理、版本历史、拓扑图生成、服务依赖链分析、影响分析、K8s 自动发现与对账、CI 类型设计器等能力。采用 PostgreSQL Repository 持久化，集成 NATS 事件总线。

### 核心文件

| 文件 | 职责 |
|------|------|
| `CmdbService.ts` | CI CRUD、关系管理、版本管理、回滚 |
| `CmdbTypes.ts` | CI/Relation/Version 类型定义 |
| `TopologyService.ts` | 拓扑图生成、深度限制 BFS、服务依赖链、影响分析 |
| `CmdbEventPublisher.ts` | 向 NATS 发布 CI/Relation/Version 事件 |
| `RelationRuleEngine.ts` | CI 类型间关系白名单验证（37 条规则） |
| `K8sReconciliationService.ts` | K8s ↔ CMDB 定时对账（5 分钟） |
| `K8sWatchClient.ts` | K8s Watch 客户端，指数退避重连 |
| `ci-type/CITypeService.ts` | CI 类型设计器：CRUD、schema 验证、版本化 |
| `ci-type/CITypeRepository.ts` | ci_metadata_schema 表数据访问 |
| `ci-type/CIAttributeRepository.ts` | ci_type_attributes 表数据访问 |
| `ci-type/CITypeVersionRepository.ts` | ci_type_versions 表数据访问 |

---

## 架构设计

### 数据模型

**CI 主表 `cmdb_ci`**：
- 主键：`id UUID`
- 唯一约束：`(tenant_id, ci_id)`
- 核心字段：`ci_id`（业务键）、`ci_type`、`name`、`status`、`environment`、`tags JSONB`、`attributes JSONB`、`version INTEGER`
- 软删除：`deleted_at`
- 租户隔离：`tenant_id UUID`

**关系表 `cmdb_ci_relation`**：
- 字段：`from_ci_id`、`to_ci_id`、`relation_type`、`description`
- 9 种关系类型：DEPENDS_ON / HOSTED_ON / CONNECTS_TO / BELONGS_TO / USES / CONTAINS / VERSION_OF / DEPLOYED_TO / MONITORED_BY

**版本历史表 `cmdb_ci_version`**：
- 字段：`ci_id`、`version`、`changes TEXT`、`data JSONB`

**审计日志表 `cmdb_audit_log`**：
- 表已建（迁移 305），但**无 Repository 或 Service 逻辑写入**

### CI 类型体系（14 种）
APPLICATION / SERVICE / DATABASE / SERVER / CONTAINER / K8S_CLUSTER / K8S_DEPLOYMENT / K8S_POD / NETWORK / LOAD_BALANCER / STORAGE / MIDDLEWARE / PIPELINE / ENVIRONMENT

### 拓扑查询逻辑

**TopologyService** 实现三种拓扑能力：
1. **getTopology**：拉取全量 CI（limit 1000）+ 全量关系，构建 nodes/edges，支持 BFS 深度限制
2. **getServiceDependencies**：从指定 CI 递归收集依赖链（最大深度 10）
3. **getImpactAnalysis**：反向收集所有依赖当前 CI 的节点，计算影响级别

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| CI 创建/查询/更新/删除 | ✅ | 支持属性 schema 验证，自动 version++ |
| CI 列表查询 | ✅ | 支持 ciType/status/environment/tags/search/order/limit/offset |
| CI 版本历史/回滚 | ✅ | getVersions / restoreToVersion |
| 关系创建/删除/查询 | ✅ | 带规则引擎验证 + 重复检查 |
| 拓扑图 | ✅ | getTopology，BFS 深度限制 |
| 服务依赖链 | ✅ | getServiceDependencies，递归深度 10 |
| 影响分析 | ✅ | getImpactAnalysis，反向依赖收集 |
| CI 类型设计器 | ✅ | CITypeService：类型 CRUD、属性管理、schema 验证、版本化 |
| 关系规则引擎 | ✅ | 37 条白名单规则，支持通配符 |
| K8s 自动发现 | ✅ | K8sWatchClient：Watch Namespace/Deployment/Pod/Service/ConfigMap |
| K8s 对账 | ✅ | K8sReconciliationService：5 分钟定时对账 |
| 事件发布 | ✅ | CmdbEventPublisher：5 种事件 |
| 审计日志 | ❌ | 表已建但无写入逻辑 |
| 批量操作 | ❌ | 无批量创建/更新/删除 API |
| CI 导入/导出 | ❌ | 无批量导入导出功能 |
| 内存模式租户隔离 | ❌ | 内存 fallback 无租户隔离 |

---

## API 端点清单

约 **25 个端点**，覆盖：
- CI CRUD（/cmdb/cis, /cmdb/cis/:id, /cmdb/cis/by-id/:ciId）
- 关系管理（/cmdb/cis/:ciId/relations, /cmdb/relations）
- 版本管理（/cmdb/cis/:ciId/versions, /cmdb/cis/:ciId/versions/restore）
- 拓扑分析（/cmdb/topology, /cmdb/topology/:ciId/dependencies, /cmdb/topology/:ciId/impact）
- K8s 集成（/cmdb/hosts, /cmdb/k8s, /cmdb/k8s/sync/start, /cmdb/k8s/sync/stop）
- 健康检查（/cmdb/health）

---

## 缺失功能

| 缺失项 | 严重程度 | 说明 |
|--------|----------|------|
| 审计日志写入 | P0 | 表已建但无写入逻辑 |
| 内存存储双轨运行 | P0 | 生产环境若未初始化 database 将回退到内存 Map |
| 批量操作 API | P1 | 无批量创建/更新/删除 CI 或关系的 API |
| CI 导入/导出 | P1 | 无 JSON/CSV 导入导出 |
| 拓扑性能优化 | P1 | getTopology 硬编码 limit 1000，大数据量 OOM |
| 内存模式租户隔离 | P1 | 内存 fallback 无租户隔离 |
| 关系类型管理 API | P2 | 规则引擎支持但无 API 管理接口 |
| CI 类型设计器 API | P2 | CITypeService 未挂载路由 |
| CI 归档/恢复 | P2 | 只有软删除，无正式归档/恢复流程 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| 内存存储双轨运行 | 生产环境回退到内存 Map | 移除内存 fallback 或添加启动校验 |
| 重复控制器 | CmdbController.ts 与 cmdb-routes.ts 功能重复 | 统一路由路径 |
| 审计表未使用 | cmdb_audit_log 表孤岛 | 在 createCI/updateCI/deleteCI 中增加审计写入 |
| 硬编码 createdBy: 'system' | 忽略请求头 x-user-id | 从请求头读取 |
| TopologyService 性能 | N+1 查询 | 改为批量查询关系，增加缓存 |
| K8sWatchClient resourceVersion 内存态 | 重启后丢失 | 持久化到 Redis 或数据库 |
| CI 状态枚举不一致 | DECOMMISSIONED vs INACTIVE | 统一状态枚举值 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| 事件总线（NATS） | CmdbEventPublisher 发布 5 种事件 | ✅ |
| 监控告警 | MONITORED_BY 关系类型 | ⚠️ 部分集成 |
| Pipeline/CI-CD | DEPLOYED_TO / USES 关系类型 | ⚠️ 有接口不完整 |
| K8s 集群管理 | K8sWatchClient + K8sReconciliationService | ✅ |
| RBAC 权限 | authenticateUser + requirePermission | ✅ |

---

## 建议优先级

1. **P0**: 启用审计日志写入
2. **P0**: 移除或隔离内存存储
3. **P1**: 统一路由路径，删除重复控制器
4. **P1**: 修复硬编码 createdBy
5. **P1**: TopologyService 性能优化
6. **P1**: 补全 CI Type 路由
