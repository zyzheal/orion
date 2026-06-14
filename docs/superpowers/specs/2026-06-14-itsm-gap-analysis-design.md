# ITSM 模块缺失分析与补全设计

**日期**: 2026-06-14
**状态**: 草稿
**范围**: Incident, Problem, SLA, Change, ServiceCatalog 5 个 ITSM 模块

---

## 1. 现状评估

ITSM 5 个模块的 **功能实现度约 95%**：

| 模块 | 后端端点 | DB 表 | 前端页面 | Repository | Service |
|------|---------|-------|---------|-----------|---------|
| Incident | 20 | 4 (incidents, timeline, postmortems, escalations) | ✅ | ✅ | ✅ |
| Problem | 15 | 3 (problems, known_errors, timeline_events) | ✅ | ✅ | ✅ |
| SLA | 16 | 3 (definitions, tracking, breach_events) | ✅ | ✅ | ✅ |
| Change | 16 | 4 (change_requests, cab_meetings, timeline, rfcs) | ✅ | ✅ | ✅ |
| ServiceCatalog | 13 | 3 (catalog_services, catalog_requests, request_timeline) | ✅ | ✅ | ✅ |

**总计**: 80 个后端端点, 17 张 DB 表（含 timeline/events 事件溯源表）, 5 个前端页面, 全部使用 PostgreSQL Repository 模式。

## 2. 识别的 5 类缺失

### 缺失 1: 测试覆盖率 (~0%)

**现状**: Incident 模块已有 `IncidentRepository.test.ts` (334 行, 18 cases) 和 `IncidentService.test.ts` (660 行, 45+ cases)。其余 4 个模块（Problem, SLA, Change, ServiceCatalog）无任何测试文件。

**影响**: 无法防止回归，重构风险高。

### 缺失 2: 跨模块关联

**现状**: Incident ↔ Problem, Problem ↔ Change 的关联关系在 API 中有定义，但前端缺少深度串联（如从 Problem 详情直接跳转到关联 Incident 列表并高亮）。

**影响**: 用户需要手动在不同页面间切换，操作链路断裂。

### 缺失 3: 通知集成

**现状**: SLA 有 `isBreached` 字段和告警触发机制，但未接入统一通知服务。升级规则 (escalation) 有数据结构但未实现通知推送。

**影响**: SLA 违约时无法自动通知相关人员。

### 缺失 4: 审批工作流

**现状**: Change 模块有 `approvalStatus` 字段，ServiceCatalog 有审批流程定义，但未接入统一审批引擎。

**影响**: 变更审批需要手动处理，无法自动化。

### 缺失 5: Ticketing 桥接

**现状**: Incident 和 Ticket 是独立实体。无法从 Incident 一键创建 Ticket，也无法在 BI 报表中关联 ITSM 数据。

**影响**: 运维流程断裂，数据孤岛。

---

## 3. 分批实施方案

### Batch 1: 测试覆盖 (优先级 P0)

**目标**: 为 5 个 ITSM 模块补充完整测试覆盖。

**方法**: Test-after（代码已存在），遵循现有测试模式：
- **Mode A (Repository)**: mock `pool.query` + `jest.fn()`，验证 SQL 和参数
- **Mode B (Service)**: Mock Repository 对象，验证业务逻辑（状态转换、关联操作）

**测试文件清单**:

| # | 文件路径 (`orion-platform-service/src/services/` 下) | 行数估算 | 测试内容 |
|---|---------------------------------------------------|---------|---------|
| 1 | `incident/__tests__/IncidentService.test.ts` (补充已有) | ~200 | 补充状态转换矩阵、SLA关联、批量操作（已有 660 行/45 cases） |
| 2 | `problem/__tests__/ProblemRepository.test.ts` (新建) | ~300 | CRUD、筛选、分页、KEDB查询 |
| 3 | `problem/__tests__/ProblemService.test.ts` (新建) | ~350 | 根因分析流程、KnownError关联、状态转换 |
| 4 | `sla/__tests__/SLARepository.test.ts` (新建) | ~400 | SLA策略CRUD、违约查询、统计聚合 |
| 5 | `sla/__tests__/SLAService.test.ts` (新建) | ~450 | SLA计算引擎、违约判定、升级触发 |
| 6 | `change/__tests__/ChangeRepository.test.ts` (新建) | ~400 | 变更CRUD、审批状态、关联查询 |
| 7 | `change/__tests__/ChangeService.test.ts` (新建) | ~450 | 变更风险评估、审批流程、回滚逻辑 |
| 8 | `service-catalog/__tests__/CatalogRepository.test.ts` (新建) | ~300 | 目录项CRUD、分类查询 |
| 9 | `service-catalog/__tests__/CatalogService.test.ts` (新建) | ~350 | 服务请求流程、审批触发、SLA绑定 |
| 10 | `incident/__tests__/IncidentRepository.test.ts` (补充已有) | ~400 | 补充关联查询、时间线、批量操作测试 |

**总计**: 10 个测试文件 (8 新建 + 2 补充), ~3600 行代码

**测试优先级**:
- **P0**: Repository CRUD 基础测试 (文件 2,3,4,5,6,7,8,9)
- **P0**: Service 核心业务逻辑 (文件 1,3,5,7,9)
- **P1**: 统计/时间线/边缘场景 (文件 1,4,10 中的高级场景)

### Batch 2: 跨模块关联增强 (优先级 P1)

**目标**: 实现 ITSM 模块间的深度关联导航。

**功能点**:
1. Problem 详情页 → 关联 Incident 列表（可点击跳转并高亮）
2. Change 详情页 → 关联 Problem 列表
3. Incident 详情页 → 关联 Problem / Change 列表
4. 反向关联：从 Incident 创建 Problem 时自动建立双向链接

**涉及文件**:
- 前端: 各详情页增加关联 Tab/Section
- 后端: 关联查询 API 优化（JOIN 查询减少 N+1）

### Batch 3: 通知集成 (优先级 P1)

**目标**: SLA 违约和升级规则接入通知服务。

**功能点**:
1. SLA 违约时自动发送通知（邮件/WebSocket）
2. 升级规则触发通知（接近违约 → 预警，已违约 → 告警）
3. 变更审批状态变更通知

**涉及文件**:
- 后端: SLAService 增加通知钩子，接入 `NotificationService`
- 后端: ChangeService 审批状态变更时触发通知

### Batch 4: 审批工作流集成 (优先级 P2)

**目标**: 变更管理和服务目录接入统一审批引擎。

**功能点**:
1. Change 创建时根据风险等级自动发起审批
2. ServiceCatalog 服务请求自动走审批流程
3. 审批结果回调更新 Change/Request 状态

### Batch 5: Ticketing 桥接 (优先级 P2)

**目标**: Incident 与 Ticket 系统打通。

**功能点**:
1. 从 Incident 一键创建 Ticket（自动填充字段）
2. Ticket 状态变更同步回 Incident
3. BI 报表支持 ITSM + Ticket 联合查询

---

## 4. 实施顺序与依赖

```
Batch 1 (测试) ──→ 无依赖，立即开始
    │
    ├──→ Batch 2 (关联) ──→ 依赖测试覆盖
    │
    ├──→ Batch 3 (通知) ──→ 依赖测试覆盖
    │
    └──→ Batch 4 (审批) ──→ 依赖 Batch 2 (关联)
            │
            └──→ Batch 5 (桥接) ──→ 依赖 Batch 2 + Batch 3
```

## 5. 验收标准

### Batch 1
- [ ] 10 个测试文件全部通过 (`npm run test`)
- [ ] 每个 Repository 测试覆盖 CRUD + 筛选 + 分页
- [ ] 每个 Service 测试覆盖核心业务逻辑 + 状态转换
- [ ] 测试覆盖率达到 80%+ (行覆盖)

### Batch 2
- [ ] 各详情页关联 Tab 可正常显示关联数据
- [ ] 点击关联项可跳转到对应详情页
- [ ] 反向关联创建时双向链接正确

### Batch 3
- [ ] SLA 违约时 WebSocket 通知到达前端
- [ ] 升级规则触发时通知相关人员
- [ ] 通知内容包含实体链接

### Batch 4
- [ ] Change 创建时根据风险等级自动发起审批
- [ ] 审批通过/拒绝后状态正确更新

### Batch 5
- [ ] Incident 可一键创建 Ticket
- [ ] Ticket 状态同步回 Incident
- [ ] BI 报表可联合查询

---

## 6. 技术约束

1. **测试模式**: 严格遵循现有 Mode A (Repository) / Mode B (Service) 模式
2. **Design Token**: 前端组件必须使用 `@/tokens` 体系
3. **Repository 模式**: 所有数据库操作必须通过 Repository，禁止直接 SQL
4. **错误处理**: 使用 `OrionError` + 错误码，禁止裸 `throw new Error`
5. **TDD**: Batch 2-5 新功能必须遵循 TDD（先写测试，再实现）
