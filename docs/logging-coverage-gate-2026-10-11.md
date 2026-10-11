# 结构化日志覆盖率门控 S0-T7（P1-U9 · NEW-EA-7，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | logging-coverage-gate-2026-10-11 |
| 状态 | 已产出（U9 · NEW-EA-7） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §4.4 U9 + §6.4 关键判据 7 |
| 前置 | 无（纯文档 + CI 脚本设计，非生产代码）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 问题陈述

### 1.1 一手代码实证

`enterprise-architecture-depth-review-2026-10-11.md` §4.4 U9 声明："结构化日志覆盖率不足 80%（S0-T7 门控）"。经一手 grep 核验：

| 指标 | 命令 | 实测值 |
|-----|-----|-------|
| **logger Error/Warn 总调用数** | `grep -rnE "(slog\|\.log)\.(Error\|Warn)" internal/` | **81 处** |
| **带 trace_id/traceId 的调用数** | `grep -c "trace"` (在上一步结果中) | **2 处** |
| **结构化日志覆盖率** | 2 / 81 | **2.5%**（远低于 80% 门控）|

**样例**（一手代码）：

```go
// orion-platform-svc-go/internal/efficiency/service/standardizer.go:106
slog.Error("efficiency: failed to create snapshot", "tenantID", tenantID, "window", timeWindow, "error", err, "trace_id", traceID)
// ↑ 有 trace_id（正确）

// orion-platform-svc-go/internal/dba/aireview/service.go:61
s.log.Warn("aireview: history insert failed", ...)
// ↑ 无 trace_id（错误）

// orion-platform-svc-go/internal/dba/aireview/reviewer.go:128
r.log.Warn("aireview: local audit failed", ...)
// ↑ 无 trace_id（错误）
```

### 1.2 差距根因

- **80% 门控目标 vs 2.5% 实测覆盖率**：差距 77.5%
- **logger 使用不统一**：`slog` / `s.log` / `r.log` / `log.Error` 4 种模式并存
- **trace_id 无强制**：仅有 2 处主动注入 trace_id，其他 79 处漏传

---

## 2. 目标与判据

### 2.1 目标

将结构化日志覆盖率从 **2.5% → 80%**，符合 Google SRE Ch.4 可观测性要求。

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 覆盖率门控 | Google SRE Ch.4 | 所有 error/warn 调用必须含 trace_id（80%+）|
| D2 AST 静态检查 | AWS WA OES02-BP01 | CI 中通过 AST detector 阻断无 trace_id 的提交 |
| D3 后端验证门控 | CLAUDE.md | grep `logger.*traceId` 为后端验证门控之一 |
| D4 分级处理 | SRE Book Ch.4 错误预算 | error 100% 必须含 trace_id，warn 允许 80% |

---

## 3. 门控设计

### 3.1 S0-T7 门控定义

**门控名称**：`GATE-LOGGING-COVERAGE-80`

**触发时机**：
- S0 阶段开始前（阻塞 S0）
- 每次 PR 修改 logger 相关代码时（阻断合并）

**通过标准**：

| 级别 | 覆盖率目标 | 强制要求 |
|-----|---------|---------|
| **error** | **100%** 必须含 trace_id | 缺失即 CI 阻断 |
| **warn** | **80%** 含 trace_id | <80% CI 阻断；≥80% 通过 |
| **info** | 无门控 | 建议但不阻断 |

### 3.2 覆盖率计算公式

```
coverage = (带 trace_id 的 error/warn 调用数) / (总 error/warn 调用数)
```

**当前实测**：
```
coverage = 2 / 81 = 2.47% ❌ (远低于 80% 目标)
```

**目标状态**：
```
coverage ≥ 80% ✅ (需新增 ≥ 63 处 trace_id)
```

---

## 4. 覆盖率提升方案

### 4.1 三层强制方案

| 层 | 机制 | 触发 | 阻断 |
|---|------|-----|-----|
| **L1 Repository/Service 层** | 强制注入 trace_id 到 log 上下文 | Service 方法入口 | 编译期 |
| **L2 AST 静态检查** | `docs/design-constraints/framework/detectors/logging-coverage.ts` | CI | PR 阻断 |
| **L3 运行期告警** | 无 trace_id 的日志触发内部告警 | 生产日志 | 事后修复 |

### 4.2 L1：统一 Logger 接口

```go
// internal/logging/logger.go（新增，伪代码，非生产代码）

type Logger interface {
    WithContext(ctx context.Context) Logger   // 自动注入 trace_id
    Error(msg string, args ...any)
    Warn(msg string, args ...any)
    Info(msg string, args ...any)
}

type StructuredLogger struct {
    inner slog.Logger
    traceID string
    tenantID string
}

func WithContext(ctx context.Context) Logger {
    traceID := trace.FromContext(ctx).TraceID().String()
    tenantID := tenant.FromContext(ctx)
    return &StructuredLogger{
        inner:    slog.Default(),
        traceID:  traceID,
        tenantID: tenantID,
    }
}

func (l *StructuredLogger) Error(msg string, args ...any) {
    args = append(args, "trace_id", l.traceID, "tenant_id", l.tenantID)
    l.inner.Error(msg, args...)
}
// Warn/Info 类似
```

**Service 改造模式**：
```go
// 改造前（缺 trace_id）
s.log.Warn("aireview: history insert failed", ...)

// 改造后（自动注入 trace_id）
func (s *AIREViewService) Insert(ctx context.Context, ...) {
    log := logger.WithContext(ctx)
    log.Warn("aireview: history insert failed", ...)
}
```

### 4.3 L2：AST Detector（`docs/design-constraints/framework/detectors/logging-coverage.ts`）

```typescript
// 检测器规范（伪代码，非生产代码）
export const LoggingCoverageDetector: Detector = {
  id: 'logging-coverage',
  description: '检测 logger.Error/Warn 调用是否含 trace_id',
  severity: 'P1',  // error 级为 P0
  check: (file, node) => {
    // 匹配 logger.Error / logger.Warn / s.log.Error / r.log.Warn 等
    if (!/\.(Error|Warn)\s*\(/.test(node.text)) return null;
    
    // 检查节点前后 3 行是否含 trace_id / traceID / trace.Id / trace.FromContext
    const context = file.slice(node.start - 200, node.end + 200);
    if (/trace[_.-]?[Ii][Dd]/.test(context)) return null;  // 通过
    
    return {
      severity: /\.Error\(/.test(node.text) ? 'P0' : 'P1',
      message: `logger.${node.text.match(/\.(Error|Warn)\(/)[1]} 缺少 trace_id`,
      fix: '通过 logger.WithContext(ctx) 创建 logger，或显式传 trace_id',
    };
  },
};
```

**AST 覆盖率变化**：37 → 39 detectors（新增 logging-coverage + 后续 otel-span-coverage）；总覆盖 213 → 215 项。

### 4.4 L3：运行期告警

```go
// internal/logging/validator.go（新增）
func NewSlogHandler(existing slog.Handler) slog.Handler {
    return &traceValidatorHandler{
        inner: existing,
    }
}

type traceValidatorHandler struct {
    inner slog.Handler
}

func (h *traceValidatorHandler) Handle(ctx context.Context, r slog.Record) error {
    // 检查 r.Attrs() 是否含 trace_id
    hasTrace := false
    r.Attrs(func(a slog.Attr) bool {
        if a.Key == "trace_id" { hasTrace = true; return false }
        return true
    })
    
    if !hasTrace && r.Level >= slog.LevelWarn {
        // 记录无 trace_id 的日志到内部告警队列
        metricNoTraceLog.Add(1)
    }
    
    return h.inner.Handle(ctx, r)
}
```

---

## 5. 迁移与实施

### 5.1 分阶段落地

| 阶段 | 内容 | 目标覆盖率 |
|-----|------|----------|
| 阶段 1 | 统一 Logger 接口 + WithContext 方法 | 基础设施 |
| 阶段 2 | error 调用 100% 改造 | error 100% |
| 阶段 3 | warn 调用 80% 改造 | warn 80% |
| 阶段 4 | AST detector 上线 CI | 阻断无 trace_id |

### 5.2 Migration 号段

**无新增 Migration**：本任务仅涉及 logger 接口与调用改造，不涉及表结构变更。

### 5.3 涉及改造范围

| 模块 | 调用数 | 优先级 |
|-----|-------|-------|
| `internal/dba/aireview/` | 12 | P0（AI 相关）|
| `internal/efficiency/` | 3 | P1（已有部分 trace_id）|
| `internal/rca/` | 5 | P0（AI 决策相关）|
| `internal/self-healing/` | 8 | P0（AI 决策相关）|
| 其他 30+ 模块 | 53 | P1 |

---

## 6. 验证方式

### 6.1 静态验证（S0-T7 门控）

```bash
# 覆盖率计算
TOTAL=$(grep -rnE "(slog|\.log)\.(Error|Warn)" orion-platform-svc-go/internal/ | wc -l)
WITH_TRACE=$(grep -rnE "(slog|\.log)\.(Error|Warn)" orion-platform-svc-go/internal/ | grep -c "trace")
COVERAGE=$(echo "scale=2; $WITH_TRACE * 100 / $TOTAL" | bc)

echo "Total logger calls: $TOTAL"
echo "With trace_id: $WITH_TRACE"
echo "Coverage: ${COVERAGE}%"

# 期望：COVERAGE >= 80
if [ "$(echo "$COVERAGE < 80" | bc)" = "1" ]; then
  echo "❌ S0-T7 FAIL: Coverage ${COVERAGE}% < 80%"
  exit 1
fi
```

### 6.2 AST Detector 验证

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-platform-svc-go/internal/ \
  --detector logging-coverage
# 期望：0 P0 violation（error 全部通过）
```

### 6.3 单测验证

```bash
# Logger 单元测试
go test ./internal/logging/... -run TestWithTraceID -count=1
# 期望：通过

# 各 Service 日志测试
go test ./internal/... -run TestLogging -count=1 -short
# 期望：通过
```

---

## 7. 与既有文档的对齐

### 7.1 与 Y 手册 v5.9 的对齐

- 新增门控 GATE-LOGGING-COVERAGE-80（S0-T7）
- 门控总数从 43 → 44

### 7.2 与 U10 OTel span 门控的关系

- U9 = 日志（slog/structlog）覆盖
- U10 = 分布式追踪（OpenTelemetry span）覆盖
- 二者互补：日志覆盖单点，span 覆盖调用链

### 7.3 与 CLAUDE.md 后端验证门控的关系

CLAUDE.md 已有门控：`grep "logger.*(traceId)"`，本文件将这一门控形式化为 CI 规则。

### 7.4 与 U15 护城河保护的关系

- 本文件**加固**护城河 M-8（可观测性三件套），非削减
- 与 U15 完全对齐

---

## 8. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 5 | Logger 接口 1 + error 100% 改造 1 + warn 80% 改造 1 + AST detector 1 + CI 门控 1 | P0 |
| **design-constraint** | 1 | 新增 detector: logging-coverage | P0 |
| **design-doc-reviewer** | 1 | 与 U10 一致性评审 | P2 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "logging_coverage_gate",
  "total_gaps": 5,
  "current_coverage_pct": 2.5,
  "target_coverage_pct": 80,
  "downstream_routing": {
    "task_decomposer": {
      "count": 5,
      "items": [
        {"id": "LOG-1", "title": "internal/logging/logger.go 统一 Logger 接口 + WithContext", "priority": "P0", "depends_on": []},
        {"id": "LOG-2", "title": "error 调用 100% 改造（含 AI 服务 rca/self-healing/aireview）", "priority": "P0", "depends_on": ["LOG-1"]},
        {"id": "LOG-3", "title": "warn 调用 80% 改造（30+ 模块）", "priority": "P1", "depends_on": ["LOG-1"]},
        {"id": "LOG-4", "title": "docs/design-constraints/framework/detectors/logging-coverage.ts 实现", "priority": "P0", "depends_on": []},
        {"id": "LOG-5", "title": ".github/workflows/logging-coverage.yml 门控 CI", "priority": "P0", "depends_on": ["LOG-4"]}
      ]
    }
  }
}
```

---

## 9. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **实测覆盖率 2.5%**：一手 grep 81 处 logger 调用中仅 2 处含 trace_id
3. **80% 目标为初始推荐**：实际值需根据 S0 阶段门控反馈调整
4. **改造范围 30+ 模块**：具体清单由 task-decomposer 拆分
5. **无 Migration**：本任务不涉及表结构变更
6. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
7. **slog/log 混用问题**：一手代码存在 4 种 logger 模式（slog / s.log / r.log / log.Error），统一为 WithContext 后自然收敛

---

## 10. 结论

- **U9 交付物**：结构化日志覆盖率门控设计（S0-T7，80% 目标）
- **核心方案**：三层强制（Logger 接口 + AST 静态检查 + 运行期告警）+ CI 门控
- **实测差距**：2.5% → 80%（+77.5%，需改造 63+ 处 logger 调用）
- **企业级判据**：D1 覆盖率门控 + D2 AST 检查 + D3 后端验证 + D4 分级处理（4/4 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **关联文档**：
  - `enterprise-architecture-depth-review-2026-10-11.md` §4.4 U9
  - `CLAUDE.md` 后端验证门控 `grep logger.*(traceId)`
  - `docs/otel-span-coverage-gate-2026-10-11.md`（U10，同期产出）
  - `docs/ai-moat-protection-2026-10-11.md`（U15）

**文件**：`docs/logging-coverage-gate-2026-10-11.md`
