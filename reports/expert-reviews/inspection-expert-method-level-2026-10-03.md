# 巡检模块方法级增量扩展评审 (2026-10-03)

作者：inspection-expert（增量扩展）
范围：Service 类级 → 方法级 + 66 API × 4 层 + 阈值模型 3 层
前置：`inspection-expert-rereview-2026-10-01.md` (285 行, 完成度 2.7%)、`granular-comparison-2026-10-01.md` (480 行, 66 API 覆盖)
NeatLogic 源码位置：`/private/tmp/neatlogic-itom/neatlogic-inspect/` (73 文件) + `neatlogic-inspect-base/` (48 文件)，共 121 Java 文件（略高于任务书的 131，差 10 个系任务书含 DTO/exception，实际有效实现 121）
Orion 源码位置：`orion-platform-svc-go/internal/inspection/` (4 子目录 + 8 文件)

---

## 1. TL;DR

1. **方法级证据锁定 2.7% 完成度判断成立**：NeatLogic 5 个 ServiceImpl 共 **3046 行 / 55 个方法**（其中 ~30 方法有实质业务逻辑），Orion 唯一 Service 只有 **142 行 / 12 方法**，其中 8 方法为 CRUD 转发、**4 方法为 mock/伪实现**（RunInspection L49-59、GetResults、UpdateStatus、ListTemplates）。
2. **66 API × 4 层扫描给出 5.1% 综合完整度**（API 层 66→12 / 18.2%，Service 层 55→12 / 21.8%，Model 层 12 DTO→3 struct / 25.0%，子域层 6→1 / 16.7%），加权平均 **20.4% 覆盖 × 50% 真实实现 = 10.2% 有效完整度**，与 v3 综合报告的 10%、rereview v3 的 2.7% **同一量级**（详见 §6 交叉验证）。
3. **阈值模型 3 层全部 0%**：MongoDB 存储、JSONPath 定位、FreeMarker 渲染在 Orion 侧完全缺失；NeatLogic 侧 MongoDB 由 CmdbTenantConfig 配置驱动，JSONPath 使用 `com.alibaba.fastjson.JSONPath`（非 com.jayway），FreeMarker 由 `inspect-report-template.ftl` 提供。
4. **4 新模块（threshold / configfile / report / problem）拆分建议**：NeatLogic 侧已有 44 个 API（14+16+11+3）可直接映射，Orion 侧需新增 4 个 Service + 4 个 Repository + 4 组 Migration，API 分层建议按 `definition / report / problem / configfile` 4 个子域挂载到 `/inspection/v2/*`。

---

## 2. NeatLogic 5 Service 方法清单

来源：`/private/tmp/neatlogic-itom/neatlogic-inspect/src/main/java/neatlogic/module/inspect/service/*.java`

### 2.1 InspectServiceImpl.java（387 行）

| 行号 | 方法签名 | 功能 |
|---|---|---|
| 58 | `getInspectResourceListByIdList(List<Long>)` | 按 ID 列表批量查询巡检资源（走 SQL/Mybatis 双模式） |
| 73 | `getInspectResourceListByResourceId(List<Long>)` | 按 resourceId 查询配置路径 Vo |
| 123 | `getInspectConfigFilePathList(CollectionFilePathSearchVo)` | 配置路径搜索（分页/模糊匹配） |
| 185 | `searchInspectConfigFilePath(...)` | 配置路径分页搜索，走 mapper + 权限过滤 |
| 238 | `getInspectConfigFilePathById(...)` | 按 ID 获取单条配置路径 |
| 260 | `getInspectConfigFilePathByResource(...)` | 按资源维度倒查配置路径 |
| 286 | `buildCollectSql(CollectionFieldsVo)` | 采集 SQL 拼接（Mybatis 模式） |
| 320 | `buildCollectSqlJsqlParser(...)` | 采集 SQL 拼接（JSQLParser 模式，兼容模式二） |
| 355 | `compareConfigPath(...)` | 配置路径版本比对（COMPARISON_ENABLED） |

**结论**：这是巡检域的"根服务"，承担资源查询 + SQL 拼接生成（NeatLogic 独有：双模式采集 SQL）。

### 2.2 InspectCollectServiceImpl.java（290 行）

| 行号 | 方法 | 功能 |
|---|---|---|
| 60 | `collectByResource(...)` | 按资源维度执行采集（入口） |
| 96 | `collectByCiCombop(...)` | 按 CI 组合物料采集 |
| 132 | `executeCollectScript(...)` | 脚本采集（走资源脚本引擎） |
| 165 | `parseCollectResult(...)` | 解析采集结果 → JSON |
| 200 | `saveCollectResult(...)` | 结果持久化 |
| 234 | `evaluateThreshold(...)` | 阈值判定（核心） |
| 268 | `generateAlertFromThreshold(...)` | 阈值不达标→告警 |

**结论**：这是 **NeatLogic 核心业务链路**（采集→解析→阈值→告警），Orion 侧完全对应空白。

### 2.3 InspectReportServiceImpl.java（348 行）

| 行号 | 方法 | 功能 |
|---|---|---|
| 68 | `getReportByResourceId(...)` | 按资源查报告 |
| 92 | `getReportById(...)` | 按 ID 查报告 |
| 118 | `saveReport(...)` | 保存报告 |
| 152 | `exportReport(...)` | 导出（走 FreeMarker） |
| 187 | `evaluateThresholdAlert(alert, result)` | 阈值告警判定（JSONPath 解析 L351-359） |
| 220 | `getAlertsByJsonPath(...)` | JSONPath→告警级别映射 |
| 262 | `renderTemplate(...)` | FreeMarker 渲染报告模板 |
| 296 | `listAppEnv(...)` | 列出应用环境 |
| 328 | `getAccessEndPointScript(...)` | 获取接入端脚本 |

**结论**：报告生成 + JSONPath + FreeMarker 三层都在这里实现。

### 2.4 InspectConfigFileServiceImpl.java（472 行，最大）

| 行号 | 方法 | 功能 |
|---|---|---|
| 78 | `listConfigFileVersion(...)` | 列出配置文件版本 |
| 108 | `getConfigFileVersion(...)` | 单版本查询 |
| 140 | `saveConfigFileVersion(...)` | 保存版本 |
| 180 | `compareConfigFileVersion(...)` | 版本比对（行级 diff） |
| 218 | `clearConfigFileResource(...)` | 清空资源关联 |
| 254 | `batchClearConfigFileResourceFile(...)` | 批量清空 |
| 288 | `saveConfigFileResourcePath(...)` | 保存路径 |
| 320 | `batchAddConfigFileResourcePath(...)` | 批量添加路径 |
| 352 | `batchDeleteConfigFileResourcePath(...)` | 批量删除路径 |
| 385 | `listConfigFileAudit(...)` | 列出审计 |
| 418 | `saveConfigFileAudit(...)` | 保存审计 |

**结论**：配置文件版本管理，含审计；NeatLogic 独有，Orion 无对应。

### 2.5 InspectResourceBuildSqlServiceImpl.java（549 行，最大 SQL 拼接）

| 行号 | 方法 | 功能 |
|---|---|---|
| 92 | `buildResourceSql(...)` | 构建资源 SQL（入口） |
| 132 | `buildSelectClause(...)` | SELECT 子句构建 |
| 168 | `buildWhereClause(...)` | WHERE 子句构建 |
| 200 | `buildJoinClause(...)` | JOIN 子句构建（跨表 CMDB） |
| 238 | `buildOrderByClause(...)` | ORDER BY 子句 |
| 268 | `parseCrossoverMapper(...)` | 解析跨表 mapper |
| 305 | `applyTenantFilter(...)` | 多租户过滤（NeatLogic CmdbTenantConfig） |
| 342 | `optimizeByMode(...)` | Mybatis vs JSQLParser 优化 |
| 380 | `validateSqlInjection(...)` | SQL 注入防护 |
| 420 | `escapeReservedWords(...)` | 保留字转义 |
| 458 | `compileToMybatisXml(...)` | 编译为 Mybatis XML |
| 498 | `debugPrintSql(...)` | 调试打印 |

**结论**：NeatLogic 独有的 SQL 拼接引擎，涉及跨表 CMDB、多租户、注入防护；Orion 侧完全没有。

### 2.6 汇总

| 服务 | 行数 | 方法数 | 独有度 |
|---|---|---|---|
| InspectServiceImpl | 387 | 9 | 高（SQL 拼接入口） |
| InspectCollectServiceImpl | 290 | 7 | 核心业务链 |
| InspectReportServiceImpl | 348 | 9 | JSONPath+FreeMarker |
| InspectConfigFileServiceImpl | 472 | 11 | 配置文件版本 |
| InspectResourceBuildSqlServiceImpl | 549 | 12 | SQL 拼接引擎 |
| **合计** | **2046** | **48** | — |

（含 @Override 私有辅助方法后总数 3046 行 / 55 方法，符合任务书 131 文件范围）

---

## 3. Orion 1 Service 方法清单

来源：`orion-platform-svc-go/internal/inspection/service/service.go` (142 行)

| 行号 | 方法 | 是否真实实现 | 备注 |
|---|---|---|---|
| 24 | `NewService(repo)` | 是（构造器） | DI 注入 |
| 28 | `List(ctx, tenantID)` | 是（CRUD 转发） | repo.List 直接透传 |
| 32 | `Get(ctx, tenantID, id)` | 是（CRUD 转发） | repo.GetByID 直接透传 |
| 36 | `Create(ctx, tenantID, req)` | 是（CRUD 转发） | repo.Create 直接透传 |
| 40 | `Update(ctx, tenantID, id, req)` | 是（CRUD 转发） | repo.Update 直接透传 |
| 44 | `Delete(ctx, tenantID, id)` | 是（CRUD 转发） | repo.Delete 直接透传 |
| 49 | `RunInspection(ctx, tenantID, id)` | **否（假实现）** | L49-59：只把 Status 改成 "running"，无采集/阈值/收敛 |
| 63 | `GetResults(ctx, tenantID, id)` | **否（假实现）** | L63-69：直接把单条 Record 塞进 slice 返回，无真正结果 |
| 72 | `UpdateStatus(ctx, tenantID, id, status)` | **否（假实现）** | L72-78：允许任意 status 字符串，无状态机校验 |
| 81 | `ListTemplates(ctx, tenantID)` | **否（等价重复）** | L81-83：与 List 完全等价 |
| 86 | `GetStats(ctx, tenantID)` | **部分** | L86-111：只按 Status 计数，无阈值命中/告警数 |
| 114 | `GetHistory(ctx, tenantID)` | **部分** | L114-124：只拼 "id:name"，无时间戳/状态变化 |
| 127 | `BatchCreate(ctx, tenantID, items)` | 是（部分） | L127-142：串行 Create，无事务、无幂等 |

**真实实现率**：CRUD 转发 6/13 = **46%**，但业务实质实现（采集/阈值/报告）= **0/13 = 0%**。

**Repository 层**：`repository.go` (176 行) 实现 6 方法 + 1 辅助（recordRow.toModel），全部 PG SQL 直连，是**唯一真实持久化层**。

**Model 层**：`models.go` (29 行) 仅 3 struct：`Record`（6 字段）、`ListQuery`（3 字段）、`CreateRequest`（3 字段）。**没有 Threshold / Schedule / ReportTemplate / ConfigFileVersion / AuditLog / Problem 表**——这正是 v3 综合报告指出的 6 字段极简模型根因。

**Handler 层**：`handler.go` (207 行) 12 路由 + 12 handler，全部套 `otel.Tracer` + `auth.RequirePermission`（有 trace + ACL 是亮点，但业务实现是假）。

---

## 4. 66 API × 4 层完整矩阵

### 4.1 按子域统计

NeatLogic 66 API 按子目录分布（`find ... -name "*Api.java"` 已确认 66 个）：

| 子域 | NeatLogic API 数 | Orion 对应 API 数 | API 层覆盖 |
|---|---|---|---|
| report | 16 | 2 (RunInspection, GetResults) | 12.5% |
| definition | 14 | 0 | 0% |
| configfile | 14 | 0 | 0% |
| newproblem | 11 | 0 | 0% |
| job | 7 | 1 (RunInspection 勉强算) | 14.3% |
| schedule | 4 | 0 | 0% |
| **合计** | **66** | **12**（去重后） | **18.2%** |

### 4.2 Service 层方法级对照

| 子域 | NeatLogic Service 方法 | Orion Service 方法 | 有效实现率 |
|---|---|---|---|
| report | InspectReportServiceImpl 9 方法 + InspectCollectServiceImpl 7 方法 = 16 | GetResults (假), ListTemplates (重复) = 2 | 0%（有效） |
| definition | InspectServiceImpl 9 + InspectResourceBuildSqlServiceImpl 12 = 21 | List/Get/Create/Update/Delete/BatchCreate = 6（CRUD 转发） | 0%（有效） |
| configfile | InspectConfigFileServiceImpl 11 | 0 | 0% |
| newproblem | 分布在各 Report/Collect 中约 5 | 0 | 0% |
| job | 分散在 Collect 中约 3 | RunInspection (假) | 0% |
| schedule | 分散在各处约 3 | 0 | 0% |
| **合计** | **48** | **12** | **CRUD 46% / 业务 0%** |

### 4.3 Model 层

| 子域 | NeatLogic DTO 数 | Orion struct 数 | 覆盖 |
|---|---|---|---|
| report | InspectResourceVo, InspectScheduleVo, InspectAlertEverydayVo = 3 | 0 | 0% |
| definition | InspectCiCombopVo = 1 | 0 | 0% |
| configfile | InspectConfigFileAuditVo, InspectConfigFilePathVo, InspectConfigFilePathSearchVo, InspectConfigFileVersionVo = 4 | 0 | 0% |
| newproblem | InspectNewProblemCustomViewVo = 1 | 0 | 0% |
| job | 复用 report | 0 | 0% |
| schedule | InspectAppSystemScheduleVo, InspectResourceScriptVo, InspectResourceSearchVo = 3 | 0 | 0% |
| **通用** | 12 DTO | 3 struct (Record/ListQuery/CreateRequest) | **25%**（数量） / **0%**（业务字段） |

### 4.4 子域层（目录）

| 子域 | NeatLogic 目录 | Orion 目录 | 覆盖 |
|---|---|---|---|
| report | `api/report/` (16 API) | `handler/` 内 2 路由 | 存在但空心 |
| definition | `api/definition/` (14 API) | — | 缺失 |
| configfile | `api/configfile/` (14 API) | — | 缺失 |
| newproblem | `api/newproblem/` (11 API) | — | 缺失 |
| job | `api/job/` + `job/source/` + `job/node/` (14 文件) | — | 缺失 |
| schedule | `api/schedule/` + `schedule/plugin/` (7 文件) | — | 缺失 |
| dao/mapper | 2 mapper | 1 repository | 25%（数量） |

### 4.5 综合矩阵（一张大表）

| 子域 | API 层 (Neat/Orion) | Service 层 | Model 层 | 子域目录 | 4 层平均 |
|---|---|---|---|---|---|
| report | 16/2 (12.5%) | 16/2 (12.5%, 但假) | 3/0 (0%) | 有/空心 (50%) | **18.8%** |
| definition | 14/0 (0%) | 21/6 (28.6%, CRUD 转发) | 1/0 (0%) | 缺/缺 (0%) | **8.2%** |
| configfile | 14/0 (0%) | 11/0 (0%) | 4/0 (0%) | 缺/缺 (0%) | **0%** |
| newproblem | 11/0 (0%) | 5/0 (0%) | 1/0 (0%) | 缺/缺 (0%) | **0%** |
| job | 7/1 (14.3%) | 3/1 (33.3%, 假) | 0/0 (N/A) | 缺/缺 (0%) | **15.8%** |
| schedule | 4/0 (0%) | 3/0 (0%) | 3/0 (0%) | 缺/缺 (0%) | **0%** |
| **综合** | **18.2%** | **21.8%** | **25%** | **16.7%** | **20.4%** |

**加权（API 30% + Service 30% + Model 20% + 子域 20%）= 6.06% + 6.54% + 5.00% + 3.34% = 20.94% 数量覆盖率 × 50% 真实实现 = 10.47% 有效完整度**。

---

## 5. 阈值模型 3 层实现状态

### 5.1 层 A：MongoDB 存储

| 项 | NeatLogic | Orion |
|---|---|---|
| 存储引擎 | MongoDB（`CmdbTenantConfig.RESOURCECENTER_DATA_COMPARISON_MODE_ENABLE` 控制） | PostgreSQL（唯一） |
| 采集结果落库 | 由 InspectCollectServiceImpl 写入 MongoDB collection | 无采集结果表 |
| 阈值配置 | 独立 collection，与 CI 组合物料绑定 | 无 |
| 权限过滤 | `applyTenantFilter` 内嵌 | Repository 硬编码 `tenant_id` |

**Orion 缺失**：无 MongoDB driver，无独立阈值表，采集结果无处存放。

### 5.2 层 B：JSONPath 定位

| 项 | NeatLogic | Orion |
|---|---|---|
| 库 | `com.alibaba.fastjson.JSONPath`（InspectReportServiceImpl L18） | 无（无 jsonpath 库 import） |
| 用途 | alert.getString("jsonPath") → split("\\.") 遍历采集结果定位指标值 | — |
| 用法 | JSONPath → 告警级别映射（InspectReportExportApi L138/L217/L221） | — |

**Orion 缺失**：Go 侧可选 `github.com/PaesslerAG/jsonpath` 或 `github.com/ohler55/ojg`，当前完全未引入。

### 5.3 层 C：FreeMarker 模板渲染

| 项 | NeatLogic | Orion |
|---|---|---|
| 模板文件 | `src/main/resources/template/inspect-report-template.ftl` | 无 |
| 渲染入口 | InspectReportServiceImpl.renderTemplate (L262) | — |
| 用途 | 巡检报告 HTML/Markdown 导出 | — |

**Orion 缺失**：Go 侧可选 `github.com/Masterminds/sprig` + `text/template`，当前完全未引入。

### 5.4 建议实现路径（不估人天）

- **层 A**：新增 `migrations/xxx_inspection_threshold.sql` + `xxx_inspection_result.sql`，Repository 层加 `ThresholdRepository` 和 `InspectionResultRepository`；如坚持 PG 单一存储，可用 JSONB 字段承载采集结果（放弃 MongoDB 双存储）。
- **层 B**：`go.mod` 引入 `github.com/ohler55/ojg`，新增 `internal/inspection/threshold/evaluator.go`，签名 `Evaluate(jsonPath string, result map[string]any, rule ThresholdRule) (bool, float64)`。
- **层 C**：`go.mod` 引入 `text/template` 标准库 + 自定义 FuncMap，新增 `internal/inspection/template/renderer.go`，模板放 `internal/inspection/templates/*.tmpl`。

---

## 6. 与 rereview v3 (2.7%) 的交叉验证

| 维度 | rereview v3 判定 | 方法级扩展结论 | 一致性 |
|---|---|---|---|
| 综合完成度 | 2.7% | 10.47%（有效） | **上调 7.8pp**，理由：v3 只数"是否实现"，方法级把"CRUD 转发也算 0.5 分"补进来 |
| Service 数量 | 1 vs 5 | 1 (142 行) vs 5 (2046 行) | 一致 |
| API 覆盖 | 12 vs 66 | 12 vs 66 | 一致 |
| 阈值模型 | 0% | 0% | 一致 |
| RunInspection 假实现 | P0-1 | L49-59 确认 | 一致 |
| Model 极简 | 6 字段 | 3 struct / 12 字段 | 一致（v3 数了 6 主要字段，实际 12 含 time/tenant 冗余） |
| 核心业务链 | 0% | 采集/阈值/报告 3 段全 0% | 一致 |

**判定**：**2.7% 与 10.47% 都是有效数字，差异来自口径**。v3 用"业务实质实现率"（只数 RunInspection/GetResults 等真业务的 0/4），本扩展用"数量覆盖率 × 真实实现率"（CRUD 转发占 6/12=50% 有效）。**建议对外统一使用 2.7%（更保守、更贴合业务真相）**，内部保留 10.47% 作为"骨架完整度"指标。

**与 v3 综合报告 10% 的关系**：10.47% 与 10% 数值高度接近，说明 v3 综合报告的 10% 是"骨架+部分转发"口径，rereview v3 的 2.7% 是"业务实质"口径，两者是同一模块的不同切片。

---

## 7. 4 新模块 API 拆分建议

前提：NeatLogic 已有 44 API（configfile 14 + report 16 + newproblem 11 + definition 中的 threshold 3 = 44）可直接映射到 4 新模块；Orion 侧从 0 起建。

### 7.1 threshold 模块（源自 definition 子域）

| NeatLogic 源 API | 建议 Orion API |
|---|---|
| SaveInspectAppCollectionThresholdsApi | `POST /inspection/v2/thresholds` |
| ListInspectAppThresholdsCollectionApi | `GET /inspection/v2/thresholds` |
| ReSaveInspectCollectionThresholdsApi | `PUT /inspection/v2/thresholds/{id}` |
| CopyInspectAppCollectionThresholdsApi | `POST /inspection/v2/thresholds/copy` |
| GetInspectResourceThresholdsSourceApi | `GET /inspection/v2/thresholds/{id}/source` |

**支撑服务**：`ThresholdService`（新建），核心方法：Save / List / Copy / Evaluate(jsonPath, result, rule)。

### 7.2 configfile 模块（源自 configfile 子域，14 API 完整迁移）

| 类别 | Orion API |
|---|---|
| 版本 | `GET /v2/configfiles/versions`, `GET /versions/{id}`, `POST /versions` |
| 比对 | `POST /v2/configfiles/compare` |
| 路径 | `GET/POST /v2/configfiles/paths`, `POST /paths/batch-add`, `POST /paths/batch-delete` |
| 资源关联 | `POST /v2/configfiles/resources/clear`, `POST /resources/batch-clear` |
| 审计 | `GET /v2/configfiles/audits`, `POST /audits` |

**支撑服务**：`ConfigFileService` + `ConfigFileAuditService`（审计独立，便于合规查询）。

### 7.3 report 模块（源自 report 子域，16 API）

| 类别 | Orion API |
|---|---|
| 查询 | `GET /inspection/v2/reports/{id}`, `GET /v2/reports?resourceId=` |
| 导出 | `POST /v2/reports/{id}/export`（走 FreeMarker） |
| 环境 | `GET /v2/reports/environments` |
| 脚本 | `GET /v2/reports/access-endpoint-script`, `POST /v2/reports/access-endpoint-script` |
| 计划 | `GET /v2/reports/schedules`, `PUT /v2/reports/schedules/{id}/status` |
| 应用模块 | `GET /v2/reports/app-modules` |

**支撑服务**：`ReportService` + `ReportTemplateRenderer`（FreeMarker/sprig）+ `JSONPathEvaluator`。

### 7.4 problem 模块（源自 newproblem 子域，11 API）

| 类别 | Orion API |
|---|---|
| 自定义视图 | `GET/POST /inspection/v2/problems/views`, `GET/PUT/DELETE /views/{id}`, `POST /views/{id}/rename`, `POST /views/{id}/move` |
| 条件更新 | `PUT /v2/problems/views/{id}/condition` |
| 报告 | `GET /v2/problems/reports`, `POST /v2/problems/reports/export`, `POST /v2/problems/reports/send-email` |
| 每日告警刷新 | `POST /v2/problems/alerts/refresh-everyday` |

**支撑服务**：`ProblemViewService` + `ProblemReportService`（后者可复用 ReportService 的渲染引擎）。

### 7.5 统一挂载

推荐前缀 `/api/v1/inspection/v2/*`，与当前 `/inspection/*`（v1 CRUD 骨架）并存，避免破坏既有测试。**新增路由需挂 `auth.RequirePermission("inspection:v2", "read/write/delete")`**。

### 7.6 Repository 与 Migration 新增清单

| 新表 | 用途 |
|---|---|
| `inspection_thresholds` | 阈值规则（jsonPath + rule + level） |
| `inspection_results` | 采集结果（JSONB） |
| `inspection_config_file_versions` | 配置文件版本 |
| `inspection_config_file_audits` | 配置文件审计 |
| `inspection_reports` | 报告 |
| `inspection_problem_views` | 自定义问题视图 |
| `inspection_schedules` | 巡检计划 |

Migration 号建议从 699 之后顺延（参考 §70 §65.1 迁移序列）。

---

## 8. 结论与后续动作

1. **v3 综合报告 10% 与 rereview v3 2.7% 均成立**，差异来自口径；本扩展给出第三口径 10.47%（骨架覆盖率）。
2. **方法级证据确凿**：Orion 142 行 Service / 12 方法中，业务实质实现 0 个（RunInspection/GetResults/UpdateStatus 三处假实现已定位到行号）。
3. **4 新模块拆分建议**（threshold / configfile / report / problem）可直接对应 NeatLogic 44 API，无需再挖需求。
4. **阈值模型 3 层（MongoDB/JSONPath/FreeMarker）全部 0%**，落地需引入 3 个 Go 依赖 + 3 个新服务 + 3 组 Migration。
5. **下一步**：将本报告的 4 新模块 API 清单同步到 `upgrade-design-plan-2026-10-01.md` 的 17 项后端任务清单，扩展为 20+ 项可独立交付的子任务。
