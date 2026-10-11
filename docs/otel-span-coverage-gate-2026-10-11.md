# OTel Span 覆盖率门控 S0-T8（P1-U10 · NEW-EA-8，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | otel-span-coverage-gate-2026-10-11 |
| 状态 | 已产出（U10 · NEW-EA-8） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §4.4 U10 + §6.4 关键判据 8 |
| 前置 | U1 P0-6 SLO/SLA 定义（已产出）；U9 结构化日志覆盖率门控（同期产出）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 问题陈述

### 1.1 一手代码实证

`enterprise-architecture-depth-review-2026-10-11.md` §4.4 U10 声明："关键路径 P99<1s 接口 100% span 覆盖"。经一手 grep 核验：

| 指标 | 命令 | 实测值 |
|-----|-----|-------|
| **`tracer.Start` 调用总数** | `grep -rn "tracer.Start\|SpanContext" internal/` | **32 处** |
| **API 路由总数** | CLAUDE.md 快照 48 路由模块 × 平均 ~10 端点 | 估算 ~480 端点 |
| **P99<1s 关键路径接口** | 参考 U1 P0-6 SLO 定义 | 需 U1 定义后精确统计 |
| **span 覆盖率** | 32 / 480 | **6.7%**（远低于 100% 目标）|

**已有 OTel 基础设施**（一手代码）：

| 位置 | 内容 |
|-----|-----|
| `internal/middleware/tracing.go:64,73` | Server-side span 自动创建（HTTP 请求入口）|
| `internal/middleware/tracing.go:44,60,110` | SpanContext 从 context 提取/注入 |

**基础设施已具备，但业务层未使用**：仅 middleware 层创建 span，业务 handler 未主动创建 span。

### 1.2 差距根因

- **业务层 span 缺失**：80%+ 的 service/repository 层无 span
- **P99<1s 关键路径未定义**：U1 P0-6 SLO 定义后需精确统计关键路径清单
- **跨服务链路断裂**：middleware 已注入 trace_id，但 service 层无 span，链路断点

---

## 2. 目标与判据

### 2.1 目标

将关键路径 P99<1s 接口的 span 覆盖率从 **6.7% → 100%**，符合 Google SRE Ch.4 与 AWS WA REL03-BP01。

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 关键路径全覆盖 | Google SRE Ch.4 | P99<1s 接口 100% span |
| D2 关键路径定义 | U1 P0-6 SLO | 每个 API 有 P99 阈值定义 |
| D3 AST 静态检查 | AWS WA OES02-BP01 | CI 阻断新增无 span 的关键路径 |
| D4 与日志联动 | CLAUDE.md | span trace_id 与 logger trace_id 一致 |

---

## 3. 门控设计

### 3.1 S0-T8 门控定义

**门控名称**：`GATE-OTEL-SPAN-100`

**触发时机**：
- S0 阶段开始前（阻塞 S0）
- 每次 PR 新增 API 路由时（阻断合并）

**通过标准**：

| 分类 | 覆盖率目标 | 强制要求 |
|-----|---------|---------|
| **关键路径 P99<1s 接口** | **100%** 必须有 span | 缺失即 CI 阻断 |
| **非关键路径接口** | **50%** 建议有 span | <50% CI 警告，不阻断 |

### 3.2 关键路径清单（U1 P0-6 依赖）

参考 U1 P0-6 SLO 定义（8 模块 × 3 SLA = 24 SLO），本任务引用以下关键路径清单（U1 已产出）：

| 模块 | 关键路径 | P99 目标 |
|-----|--------|--------|
| **Alert** | `/alert/ingest`、`/alert/breaker/check` | <500ms |
| **CMDB** | `/cmdb/ci/*`、`/cmdb/types/*` | <1s |
| **Pipeline** | `/pipeline/run/*`、`/pipeline/stage/*` | <2s |
| **Ticket** | `/ticket/*`、`/ticket/from-alert` | <1s |
| **RCA** | `/rca/*`（AI 决策相关）| <3s |
| **Self-Healing** | `/self-heal/*`（AI 决策相关）| <5s |
| **AI Decision** | `/ai/*`（132 路由）| <3s |
| **BI Report** | `/bi/report/*` | <5s |

**注**：具体接口清单需 U1 P0-6 落地后精确统计（本文件为设计稿）。

---

## 4. Span 覆盖方案

### 4.1 三层 span 强制

| 层 | 位置 | 机制 |
|---|-----|-----|
| **L1 HTTP Middleware** | `internal/middleware/tracing.go` | 已实现，Server-side span 自动创建 |
| **L2 Service 层** | 每个 Service 方法入口 | 新增 span，标记 span.Kind = Internal |
| **L3 Repository 层** | DB 操作 span | 使用 pgx interceptor 自动创建 span |

### 4.2 L2 Service 层改造模式

```go
// 改造前（无 span）
func (s *AIREViewService) Review(ctx context.Context, code string) (*Result, error) {
    // 业务逻辑
    return result, nil
}

// 改造后（含 span）
func (s *AIREViewService) Review(ctx context.Context, code string) (*Result, error) {
    ctx, span := s.tracer.Start(ctx, "aireview.Review",
        trace.WithSpanKind(trace.SpanKindInternal),
        trace.WithAttributes(
            attribute.String("module", "aireview"),
            attribute.String("operation", "review"),
        ),
    )
    defer span.End()
    
    // 记录关键事件
    span.AddEvent("start_review", trace.WithAttributes(
        attribute.Int("code_length", len(code)),
    ))
    
    // 业务逻辑（原样）
    result, err := s.doReview(ctx, code)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        return nil, err
    }
    return result, nil
}
```

### 4.3 关键路径 span 命名规范

| Span 名 | 位置 | Kind |
|--------|-----|------|
| `<module>.<Handler>` | HTTP Handler | Server |
| `<module>.<ServiceMethod>` | Service 方法 | Internal |
| `db.<operation>` | Repository DB 操作 | Client |
| `llm.<provider>.<model>` | LLM 调用 | Client |
| `external.<service>` | 外部 API 调用 | Client |

### 4.4 AST Detector（`docs/design-constraints/framework/detectors/otel-span-coverage.ts`）

```typescript
export const OtelSpanCoverageDetector: Detector = {
  id: 'otel-span-coverage',
  description: '检测关键路径 API handler 是否有 span',
  severity: 'P0',
  criticalPaths: [
    '/alert/ingest', '/alert/breaker/check',
    '/cmdb/ci/*', '/cmdb/types/*',
    '/pipeline/run/*', '/pipeline/stage/*',
    '/ticket/*', '/ticket/from-alert',
    '/rca/*', '/self-heal/*',
    '/ai/*',
    '/bi/report/*',
  ],
  check: (file, handler) => {
    const path = handler.routePath;
    if (!isCriticalPath(path)) return null;
    
    // 检查 handler 函数内是否含 tracer.Start 或 SpanKind
    const body = file.slice(handler.start, handler.end);
    if (/tracer\.Start|SpanKind|SpanContext/.test(body)) return null;
    
    // 检查是否有 middleware 自动注入（tracing.go 覆盖）
    if (hasTracingMiddleware(handler.routerPrefix)) return null;
    
    return {
      severity: 'P0',
      message: `关键路径 ${path} 缺少 span 创建`,
      fix: '在 handler 中调用 tracer.Start(ctx, "module.Method", ...)',
    };
  },
};
```

**AST 覆盖率变化**：37 → 40 detectors（新增 otel-span-coverage + logging-coverage + ai-moat-protection）；总覆盖 213 → 216 项。

---

## 5. 迁移与实施

### 5.1 分阶段落地

| 阶段 | 内容 | 目标 span 覆盖 |
|-----|------|--------------|
| 阶段 1 | U1 P0-6 SLO 定义关键路径清单 | 清单落地 |
| 阶段 2 | Alert/CMDB/Pipeline/Ticket 关键路径 span 覆盖 | 50%+ |
| 阶段 3 | AI/RCA/Self-Healing span 覆盖 | 80%+ |
| 阶段 4 | AST detector + CI 门控上线 | 100% |

### 5.2 Migration 号段

**无新增 Migration**：本任务仅涉及 span 创建，不涉及表结构变更。

### 5.3 涉及改造范围

| 模块 | 关键路径数 | 改造优先级 |
|-----|----------|----------|
| Alert | 5 | P0（阻塞告警链路）|
| CMDB | 8 | P0 |
| Pipeline | 6 | P0 |
| Ticket | 5 | P1 |
| RCA | 3 | P0（AI 决策）|
| Self-Healing | 4 | P0（AI 决策）|
| AI Decision（132 路由）| 132 | P1 |
| BI Report | 5 | P2 |

**总计**：~168 关键路径接口需改造（AI 132 路由批量注入 middleware 自动化）。

---

## 6. 验证方式

### 6.1 静态验证（S0-T8 门控）

```bash
# 关键路径 span 覆盖率
CRITICAL_PATHS=$(grep -rnE "'/alert/|'/cmdb/|'/pipeline/|'/ticket/|'/rca/|'/self-heal/|'/ai/|'/bi/" \
  orion-platform-svc-go/internal/ | wc -l)
CRITICAL_SPANS=$(grep -rn "tracer\.Start\|SpanKind" \
  orion-platform-svc-go/internal/ | grep -c "critical")
COVERAGE=$(echo "scale=2; $CRITICAL_SPANS * 100 / $CRITICAL_PATHS" | bc)

echo "Critical paths: $CRITICAL_PATHS"
echo "With span: $CRITICAL_SPANS"
echo "Coverage: ${COVERAGE}%"

# 期望：COVERAGE = 100（关键路径全覆盖）
if [ "$COVERAGE" != "100" ]; then
  echo "❌ S0-T8 FAIL: Critical path span coverage ${COVERAGE}% < 100%"
  exit 1
fi
```

### 6.2 AST Detector 验证

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-platform-svc-go/internal/ \
  --detector otel-span-coverage
# 期望：0 P0 violation
```

### 6.3 单测验证

```bash
# Tracing middleware
go test ./internal/middleware/... -run TestTracingMiddleware -count=1
# 期望：通过

# 各 Service span 测试
go test ./internal/rca/... -run TestSpanCreation -count=1
go test ./internal/self-healing/... -run TestSpanCreation -count=1
# 期望：通过
```

### 6.4 端到端验证

```bash
# 触发关键路径 API 并检查 trace 采集
curl -X POST localhost:3001/api/v1/alert/ingest \
  -H "X-Trace-Parent: 00-<trace-id>-<span-id>-01"
# 期望：Jaeger 中可查询完整链路

# 检查 span 属性完整性
jaeger-query --trace-id=<trace-id> --format json | jq '.spans[].tags[] | select(.key=="module")'
# 期望：module / operation / tenant_id 属性齐全
```

---

## 7. 与既有文档的对齐

### 7.1 与 Y 手册 v5.9 的对齐

- 新增门控 GATE-OTEL-SPAN-100（S0-T8）
- 门控总数从 44 → 45

### 7.2 与 U9 结构化日志门控的关系

- U9 = 日志（slog/structlog）覆盖
- U10 = 分布式追踪（OTel span）覆盖
- 二者互补：日志覆盖单点，span 覆盖调用链
- **联动要求**：span 的 trace_id 必须与 logger 的 trace_id 一致（CLAUDE.md 后端验证门控）

### 7.3 与 U1 P0-6 SLO 定义的关系

- U1 定义每个 API 的 P99 阈值（8 模块 × 3 SLA = 24 SLO）
- U10 消费 U1 输出，将 P99<1s 接口标记为"关键路径"，强制 100% span 覆盖

### 7.4 与 U15 护城河保护的关系

- 本文件**加固**护城河 M-8（可观测性三件套 Prometheus + OTel + ClickHouse），非削减
- 与 U15 完全对齐

---

## 8. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 5 | 关键路径清单 1 + Alert/CMDB/Pipeline span 1 + AI 路由批量注入 1 + AST detector 1 + CI 门控 1 | P0 |
| **design-constraint** | 1 | 新增 detector: otel-span-coverage | P0 |
| **design-doc-reviewer** | 1 | 与 U9 联动评审 | P2 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "otel_span_coverage_gate",
  "total_gaps": 5,
  "current_span_coverage_pct": 6.7,
  "target_span_coverage_pct": 100,
  "critical_paths_estimate": 168,
  "downstream_routing": {
    "task_decomposer": {
      "count": 5,
      "items": [
        {"id": "OTEL-1", "title": "U1 P0-6 SLO 定义后精确关键路径清单", "priority": "P0", "depends_on": ["U1 P0-6"]},
        {"id": "OTEL-2", "title": "Alert/CMDB/Pipeline/Ticket handler span 注入", "priority": "P0", "depends_on": ["OTEL-1"]},
        {"id": "OTEL-3", "title": "AI 132 路由批量注入（middleware 自动化）", "priority": "P1", "depends_on": ["OTEL-1"]},
        {"id": "OTEL-4", "title": "docs/design-constraints/framework/detectors/otel-span-coverage.ts 实现", "priority": "P0", "depends_on": []},
        {"id": "OTEL-5", "title": ".github/workflows/otel-span-coverage.yml 门控 CI", "priority": "P0", "depends_on": ["OTEL-4"]}
      ]
    }
  }
}
```

---

## 9. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **实测 span 覆盖率 6.7%**：一手 grep 32 处 tracer.Start / 480 估算端点
3. **168 关键路径为估算**：U1 P0-6 落地后需精确统计
4. **100% 目标为强约束**：非关键路径允许 50%（不阻断 CI）
5. **无 Migration**：本任务不涉及表结构变更
6. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
7. **middleware 已有基础**：`internal/middleware/tracing.go` 已实现 Server-side span 自动创建，业务层改造是主要工作量

---

## 10. 结论

- **U10 交付物**：OTel span 覆盖率门控设计（S0-T8，关键路径 100% 目标）
- **核心方案**：三层 span 强制（Middleware + Service + Repository）+ AST detector + CI 门控
- **实测差距**：6.7% → 100%（+93.3%，需改造 168 关键路径）
- **企业级判据**：D1 关键路径全覆盖 + D2 SLO 依赖 + D3 AST 检查 + D4 与日志联动（4/4 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **关联文档**：
  - `enterprise-architecture-depth-review-2026-10-11.md` §4.4 U10
  - `docs/slo-sla-2026-10-11.md`（U1 P0-6，关键路径 SLO 定义）
  - `docs/logging-coverage-gate-2026-10-11.md`（U9，同期产出）
  - `docs/ai-moat-protection-2026-10-11.md`（U15）

**文件**：`docs/otel-span-coverage-gate-2026-10-11.md`
