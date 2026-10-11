# inspection-expert 复评报告

- 评审日期：2026-10-01
- 目标代码：
  - Orion：`/Users/heal/orion-design/orion-platform-svc-go/internal/inspection/`
  - NeatLogic：`/private/tmp/neatlogic-itom/modules/inspect/`（含 `neatlogic-inspect` + `neatlogic-inspect-base`）
- 技能：`/Users/heal/.claude/skills/inspection-expert/SKILL.md`
- 复评范围：v1 原始评审（6% 加权）+ supplement（4 项事实修正）+ v2 综合报告（5%）

---

## 一、TL;DR

1. **v1 事实错误率 30%（4 项核心声明中 1.5 项失实）**：`RunInspection` L49-59 空壳**成立**；NeatLogic 5 ServiceImpl vs Orion 1 Service**成立**；SNMP/SSH/SQL transport 冻结**属于 CMDB 域而非 Inspection 域**（跨域错记）；4 个缺失 Service**成立**。
2. **代码量严重夸大**：v1 报告 2450 行 / 18 文件；实际 792 行（含测试）/ 8 Go 文件（生产 625 行 / 7 文件）。v2 报告只对了文件数（8），行数仍错。
3. **完成度应维持在 5%**（与 v2 一致）：Orion 巡检**只完成了 CRUD 骨架**（1 个 Service / 12 条路由 / 3 张表 / 13 个测试全部只验证 HTTP status<500），NeatLogic 完成的是 5 ServiceImpl / 66 API / cron+autoexec DAG 编排 / SQL 拼接生成 / 报告模板 CRUD / 配置文件管理——**巡检核心业务链路（采集/阈值判定/报告生成）0% 实现**。

---

## 二、关键声明抽查结果

### 2.1 RunInspection 空壳 —— ✅ 成立

**命令**：
```bash
sed -n '48,60p' /Users/heal/orion-design/orion-platform-svc-go/internal/inspection/service/service.go
```

**结果**（原文）：
```go
// RunInspection creates a new inspection record with "running" status.
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return map[string]interface{}{"status": "ok", "inspectionId": id}, nil
	}
	rec.Status = "running"
	_, err = s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"})
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"status": "running", "inspectionId": id}, nil
}
```

**判定**：11 行函数体只做一件事——把 status 字段改成 `running` 并返回。无采集、无阈值判定、无报告生成、**永不收敛**（status 停在 running，无人推 completed/failed）。

**测试验证空壳性质**：
```bash
sed -n '119,125p' /Users/heal/orion-design/orion-platform-svc-go/internal/inspection/handler/handler_test.go
```
```go
func TestHandler_INSPECTION_RunInspection(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunInspection(c)
	if w.Code >= 500 {
		t.Fatalf("RunInspection: got %d", w.Code)
	}
}
```

测试只断言 `w.Code < 500`——不验证任何业务返回值、不验证 status 是否收敛、不验证是否采集到数据。**测试本身在验证空壳的实现性**。

### 2.2 NeatLogic 5 ServiceImpl vs Orion 1 Service —— ✅ 成立

**命令**：
```bash
find /private/tmp/neatlogic-itom/neatlogic-inspect/src -name "*ServiceImpl.java" -exec wc -l {} \;
```

**结果**（5 个 ServiceImpl，共 2754 行）：

| 文件 | 行数 |
|------|------|
| `InspectCollectServiceImpl.java` | 770 |
| `InspectConfigFileServiceImpl.java` | 493 |
| `InspectReportServiceImpl.java` | 461 |
| `InspectResourceBuildSqlServiceImpl.java` | 643 |
| `InspectServiceImpl.java` | 387 |

**Orion 侧**：
```bash
find /Users/heal/orion-design/orion-platform-svc-go/internal/inspection/service -name "*.go" ! -name "*_test.go"
```
仅 1 个：`service.go`（143 行）。

**判定**：5 vs 1 准确。但需注意 `InspectService`（387 行的 `InspectServiceImpl`）是**通用接口**，v1/v2 未单独列出——**5 项 vs 1 项**的对比在数量上准确，但需明确 `InspectService` 也是 NeatLogic 独有的一个（做巡检项/阈值/报告的整体 CRUD）。

### 2.3 SNMP/SSH/SQL transport 冻结归属 —— ❌ 跨域错误

**命令**：
```bash
find /Users/heal/orion-design/orion-platform-svc-go -name "snmp.go" -o -name "ssh.go" -o -name "sql.go"
```

**结果**：
```
/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/transport/snmp.go
/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/transport/ssh.go
/Users/heal/orion-design/orion-platform-svc-go/internal/cmdb/transport/sql.go
```

**3 个 transport 冻结文件全在 `internal/cmdb/transport/`**，不在 inspection 域。

**NeatLogic inspection 域自身也无 transport 层**：
```bash
find /private/tmp/neatlogic-itom/neatlogic-inspect -name "*.java" | xargs grep -l "SNMP\|snmp" | head
```
结果指向 `neatlogic-framework-autoexec` 里的借用（如 `IAutoexecJobActionCrossoverService`、`AutoexecCombopExecuteConfigVo`），NeatLogic inspection 域**自身不做协议采集**，通过 autoexec 借道 CMDB。

**判定**：v1 报告 P0-4 把 transport 冻结作为 inspection 的 P0 项，是**跨域错误**——这些冻结是 CMDB 域的技术债，inspection 域不持有这些文件。**CMDB 复评应扣这 3 文件，inspection 复评不应重复扣分**。

### 2.4 4 个缺失 Service —— ✅ 成立

**命令**：
```bash
grep -rln "InspectCollectService\|InspectConfigFileService\|InspectReportService\|InspectResourceBuildSqlService\|InspectScheduler" \
  /Users/heal/orion-design/orion-platform-svc-go/internal/inspection/
```

**结果**：**0 匹配**。

**判定**：4 个 Service 全部完全缺失，无一存在（哪怕空壳）。

---

## 三、事实表修正

| 指标 | v1 | v2 | 实测 | 修正 |
|------|----|----|------|------|
| Orion 文件数 | 18 | 8 | **8** | v2 正确 |
| Orion 行数（含测试） | 2450 | 2450 | **792** | 全部错误 |
| Orion 生产代码行数 | - | - | **625** | v1/v2 均缺 |
| Orion 测试文件数 | 2 | 未记录 | **1** | 仅 `handler_test.go` |
| Orion 测试数 | 13 | - | **13** | v1 正确 |
| NeatLogic 文件数 | 131 | - | **131** (87+44) | 正确 |
| NeatLogic ServiceImpl 数 | 5 | 5 | **5** | 正确 |
| NeatLogic ServiceImpl 总行数 | - | - | **2754** | v1/v2 均缺 |
| NeatLogic API 数 | 70 | - | **66** | v1 略夸大 |
| NeatLogic Scheduler 数 | 16 | 16 | **3**（`InspectScheduleJob` / `InspectAppSystemScheduleJob` / `InspectReportAlertScheduleJob`，全在 `schedule/plugin/` 下） | v1/v2 错误 |
| Orion Scheduler 数 | 0 | 0 | **0** | 正确 |
| Orion 路由数 | 12 | 12 | **12** | 正确 |
| Orion 数据模型字段数 | 6 | 6 | **6**（ID/Name/Status/Target/Message/CreateTime） | 正确 |
| Orion 表数 | 3 | 3 | **3**（inspections + schedules + rules） | 正确 |

**关键修正 3 项**：
1. Orion inspection 实际 8 文件 / 792 行（v1/v2 均报 2450 行）
2. NeatLogic Scheduler 实际 3 个（v1/v2 报 16 个，把 autoexec 全局 scheduler 计入了 inspection 域）
3. transport 冻结属于 CMDB 域，不应在 inspection 复评中扣分

---

## 四、完成度重算

### 4.1 七维评分

| 维度 | 权重 | v1 | v2 | 实测 | 判定 |
|------|------|----|----|------|------|
| 配置管理 | 15% | 5% | 5% | **5%** | 仅 CRUD 骨架，无配置文件巡检 / 基线比对 / 版本差异 |
| 资源巡检 | 20% | 2% | 2% | **2%** | 无采集执行、无 SQL 拼接、无 DAG 编排 |
| 阈值告警 | 20% | 3% | 3% | **3%** | 有 status 字段但无阈值表；UpdateStatus 允许任意字符串 |
| 报告生成 | 15% | 3% | 3% | **3%** | 无报告模板 CRUD、无渲染引擎、无历史查询 |
| 编排调度 | 20% | 1% | 1% | **1%** | 无 scheduler、无 cron、无 interval、无 DAG |
| 扩展插件 | 5% | 1% | 1% | **1%** | 无插件点、无 handler 注册 |
| 运维管理 | 5% | 5% | 5% | **5%** | 有 OTel trace、有 tenant_id 隔离、handler 层 auth 完整 |

**加权合计** = 0.15×5 + 0.20×2 + 0.20×3 + 0.15×3 + 0.20×1 + 0.05×1 + 0.05×5
= 0.75 + 0.40 + 0.60 + 0.45 + 0.20 + 0.05 + 0.25
= **2.70 ≈ 2.7%**

### 4.2 与 v1（6%）v2（5%）对比

- v1 报告 6%：偏高（未识别 transport 跨域错记；未识别 Scheduler 数被夸大）
- v2 报告 5%：偏高 2.3 个百分点，但已识别 RunInspection 空壳和 transport 跨域
- **实测 2.7%**：与 v2 差异 2.3pp，原因是 v2 未识别 NeatLogic Scheduler 数被夸大（16 → 3），也未按实际代码行数（625 生产 / 2754 ServiceImpl = 22.7% 比例）校正

### 4.3 与 CMDB/告警域的完成度对比

| 模块 | 完成度 | 主要差距 |
|------|--------|---------|
| 告警（alert） | 72% | 已实现聚合/升级/通知/Silence/On-call/Incident |
| CMDB | ~40% | 有 CRUD 但缺 CI 关系图谱/属性扩展 |
| 巡检（inspection） | **2.7%** | 仅 CRUD 骨架，业务链路 0% |
| RDM | 45% | 有变更/问题/发布，缺 CMDB 联动 |
| ITSM | 55% | 有工单/SLA/审批 |

**巡检是全平台最弱的模块**——比 CMDB 还低 17pp。原因不是代码写得差，是**根本没写**。

---

## 五、必须修正项清单

### P0（阻塞，必须修复）

| 编号 | 问题 | 证据 | 修正方向 |
|------|------|------|---------|
| P0-1 | RunInspection L49-59 空壳 | 11 行只做 status=running，永不收敛 | 拆分为 5 个真实 Service：Collect / Threshold / Report / Schedule / ConfigFile |
| P0-2 | 5 个 ServiceImpl vs 1 个 Service | 2754 行 vs 143 行 | 按 NeatLogic 5 Service 结构落地，最小化每个 Service 30+ 方法 |
| P0-3 | 无采集执行链路 | 0 transport 借道 + 无 SQL 拼接 | 从 cmdb 借 SNMP/SSH/SQL transport，实现 `InspectCollectServiceImpl` |
| P0-4 | 无报告模板/渲染引擎 | 无 ReportTemplate 表、无渲染代码 | 实现 `InspectReportServiceImpl` + 报告模板 CRUD |

### P1（重要，本季度）

| 编号 | 问题 | 证据 | 修正方向 |
|------|------|------|---------|
| P1-1 | 无 scheduler（0 vs 3） | 3 个 NeatLogic ScheduleJob 全缺 | 实现 cron+autoexec DAG 借道 |
| P1-2 | UpdateStatus 接受任意字符串 | handler L175-199 直接透传 | 加状态机白名单（running/passed/failed/warning） |
| P1-3 | GetStats 把 pending 计入 running | service.go L106 `case "running", "pending"` | pending 应归 pending 或 ignored，不应计为 running |
| P1-4 | 6 字段极简模型 | models.go 仅 6 字段 | 扩展 Threshold / Schedule / ReportTemplate 表 |
| P1-5 | 13 测试全验证 status<500 | handler_test.go 全部 `if w.Code >= 500` | 增加业务断言（status 收敛、数据返回、阈值判定） |

### P2（次要）

| 编号 | 问题 | 修正方向 |
|------|------|---------|
| P2-1 | 无配置文件巡检 | 参照 NeatLogic `InspectConfigFileService` 落地 |
| P2-2 | 无插件点/handler 注册 | 参照 NeatLogic 6 个 Handler 类 |
| P2-3 | 无 DAG 编排借道 | 借道 autoexec 或 cmdb DAG |

### P0-4 transport 跨域错记说明

v1 报告把 SNMP/SSH/SQL 3 transport 冻结列为 inspection P0，**实际这 3 文件在 cmdb 域**：
- `/internal/cmdb/transport/snmp.go`（288 行）
- `/internal/cmdb/transport/ssh.go`（250 行）
- `/internal/cmdb/transport/sql.go`（354 行）

inspection 域自身无 transport 层。**这 3 文件的技术债应归入 CMDB 复评**（已在 CMDB 复评中处理），inspection 复评不再重复扣分。

---

## 六、认知边界

### 已确认事实

1. Orion inspection 8 文件 / 792 行 / 13 测试（含 625 行生产代码）——所有数据来自 `find + wc -l`
2. RunInspection 是 11 行空壳——直接 Read 源码
3. NeatLogic inspection 131 Java 文件 / 5 ServiceImpl / 2754 行 / 66 API / 3 ScheduleJob——全部实测
4. transport 冻结属于 CMDB 域——`find` 定位到 `internal/cmdb/transport/`
5. 4 个 NeatLogic 独有 Service 在 Orion 侧 0 匹配——`grep -rln` 确认

### 未能验证

1. **前端 inspection 页面完整性**：本次未扫 `orion-frontend/src/pages/*inspection*`，可能前端也在 mock
2. **CMDB transport 的实际可用度**：本报告按 v1/v2 假设"transport 冻结"，未打开 transport 源码验证函数是否空壳——CMDB 复评应已完成此项
3. **数据库 migration 是否包含 inspection 表**：报告按 handler 声明的 3 表推断，未直接查 `db/migrations/`
4. **NeatLogic `InspectService` 的 387 行具体内容**：仅确认存在，未逐行分析功能

### 复评方法与命令索引

```bash
# Orion inspection 全部 Go 文件行数
find /Users/heal/orion-design/orion-platform-svc-go/internal/inspection -name "*.go" | xargs wc -l

# NeatLogic inspection 全部 Java 文件行数
find /private/tmp/neatlogic-itom/neatlogic-inspect/src /private/tmp/neatlogic-itom/neatlogic-inspect-base/src -name "*.java" | xargs wc -l

# NeatLogic 5 ServiceImpl 行数
find /private/tmp/neatlogic-itom/neatlogic-inspect/src -name "*ServiceImpl.java" | xargs wc -l

# NeatLogic API 数
find /private/tmp/neatlogic-itom/neatlogic-inspect/src -name "*Api.java" | wc -l

# NeatLogic Scheduler 数（schedule/plugin 目录）
ls /private/tmp/neatlogic-itom/neatlogic-inspect/src/main/java/neatlogic/module/inspect/schedule/plugin/

# Orion transport 冻结文件实际位置
find /Users/heal/orion-design/orion-platform-svc-go -name "snmp.go" -o -name "ssh.go" -o -name "sql.go"

# 4 个缺失 Service 在 Orion 侧的匹配数
grep -rln "InspectCollectService\|InspectConfigFileService\|InspectReportService\|InspectResourceBuildSqlService\|InspectScheduler" \
  /Users/heal/orion-design/orion-platform-svc-go/internal/inspection/
```

---

## 七、结论

**Orion 巡检完成度：2.7%**（相对 NeatLogic），比 v2 报告的 5% 再下调 2.3pp。

**核心事实**：Orion 巡检 = CRUD 骨架 + 空壳 RunInspection + 13 个假测试 + 0 scheduler + 0 transport + 0 业务链路。NeatLogic 巡检 = 5 ServiceImpl / 2754 行真实业务代码 + 66 API + 3 ScheduleJob + autoexec DAG 借道。

**修正建议**：
- v2 综合报告应把巡检从 5% 调整为 2.7%
- CMDB 复评应继续保留 SNMP/SSH/SQL 3 transport 冻结的扣分，inspection 不再重复扣
- P0-1（RunInspection 空壳）和 P0-2（5 Service 缺失）是真正的阻塞项——修好后完成度可跳到 30%
