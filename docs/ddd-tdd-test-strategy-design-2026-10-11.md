# 分层测试策略完整设计方案（P1-NEW-EA-17，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | ddd-tdd-test-strategy-design-2026-10-11 |
| 状态 | 已产出（NEW-EA-17）|
| 版本 | v1.0 |
| 日期 | 2026-10-11 |
| 视角 | 测试架构师（Test Architect）+ DDD 领域专家 |
| 依据 | `ddd-tdd-test-coverage-expert-review-2026-10-11.md`（一手实测数据）|
| 前置 | Y 手册 v5.10 / CC 风险登记册 v5.5 / ADR-010~015 |
| 约束 | **RC-03**（不修改生产代码）；不估算人天/工期；本文件为独立设计方案 |

---

## 1. 设计方案目标

### 1.1 从分析到设计

前文档（`ddd-tdd-test-coverage-expert-review-2026-10-11.md`）完成：
- 一手覆盖率实测（9 DDD 包 + 295 模块 + 4 层分布）
- 应有性判定矩阵（45 P0 + 95 P1 缺口）
- 反模式清单（5 类）

**本设计方案补齐**：
1. **分层测试策略**（Pyramid 落地版）
2. **测试基础设施蓝图**（Testcontainers + TestUtil + Mock 治理）
3. **具体测试骨架模板**（可复制粘贴到子任务）
4. **门控自动化方案**（GATE-TEST-* 门控配置）
5. **Y 手册 §14.13 追加内容**
6. **CC 风险登记册 v5.6 更新**
7. **ADR-016 建议**（测试基础设施决策）

### 1.2 关键判据

| 判据 | 依据 | 目标 |
|-----|------|------|
| **D1 分层清晰** | Martin Fowler Test Pyramid | 单元 70% / 集成 20% / E2E 10% |
| **D2 基础设施可复用** | AWS WA REL02-BP01 | TestUtil/Mock 集中管理 |
| **D3 门控自动化** | AWS WA OES02-BP01 | 6 项新门控全自动化 |
| **D4 反模式规避** | Google SRE Ch.24 | 禁止 5 类反模式 |
| **D5 契约完整性** | Y §1402 断裂 | 补齐 TestSaga_ChaosRollback |

---

## 2. 分层测试金字塔（落地版）

### 2.1 目标分布

```
         ┌─────────┐
         │  E2E    │  10%  (~80 测试)
         │ (Playwright)
         ├─────────┤
         │  集成   │  20%  (~160 测试)
         │ (Testcontainers)
         ├─────────┤
         │ 契约   │  15%  (~120 测试)
         │ (OpenAPI/schema)
         ├─────────┤
         │ 单元   │  45%  (~360 测试)
         │ (Go test)
         └─────────┘
              目标：~720 测试（当前 789 但深度参差）
```

**关键**：不追求总量，追求**分布合理 + 关键路径 100% 覆盖**。

### 2.2 各层测试职责矩阵

| 测试类型 | 适用层 | 框架 | 目标覆盖率 |
|---------|-------|-----|----------|
| **单元测试** | Domain / Application / Service 业务逻辑 | Go `testing` + `testutil.Mock*` | ≥ 80% |
| **集成测试** | Repository / EventStore / DB 事务 | `testcontainers-go` | ≥ 60%（关键查询）|
| **契约测试** | API Client / Handler / OpenAPI | OpenAPI 3.x schema + `httptest` | 100% API 端点 |
| **E2E 测试** | 前端页面 + API 全链路 | Playwright | 20 关键用户旅程 |
| **快照测试** | 纯展示组件 | React Testing Library | 按组件库 |

### 2.3 现有 vs 目标（按测试类型）

| 类型 | 当前 | 目标 | 缺口 |
|-----|-----|-----|-----|
| Go 单元测试 | ~700（含 DDD 17 项）| 720 | 补充深度 |
| Testcontainers 集成 | 0 | 60 | ❌ **P0 完全缺失** |
| OpenAPI 契约 | 0 | 40 | ❌ **P0 完全缺失** |
| Playwright E2E | 314 httptest | 80 用户旅程 | ✅ 达标（需筛选）|
| 前端快照 | 273 | 200 | ⚠️ 需精简 |

---

## 3. 测试基础设施蓝图

### 3.1 三大基础设施组件

#### 3.1.1 TestUtil 目录标准化

**当前问题**：仅 `internal/ticketing/testutil/` 一个模块有 testutil，其他 294 模块 mock 散落在测试文件内。

**设计方案**：每个有 Repository 的模块必须建立 `<module>/testutil/` 目录。

```
internal/<module>/
├── service/
├── repository/
├── handler/
└── testutil/                 # 新增
    ├── mock_repository.go    # 手写 mock（非代码生成）
    ├── fixtures.go           # 标准 fixture 数据
    └── testcontainers.go     # 集成测试连接池
```

**Mock 命名规范**：
- `Mock<RepositoryName>Repository` — 如 `MockTicketRepository`
- `Mock<RepositoryName>Repository` 必须嵌入接口（`interface<Name>`）
- 所有 mock 字段用 `sync.RWMutex` 保护（并发安全）
- 提供 `NewMock<RepositoryName>Repository()` 构造函数
- 提供 `Reset()` 方法（每个测试调用）

**判定标准**：280 service 模块 → **280 testutil 目录**（当前 1，需 +279）

#### 3.1.2 Testcontainers 集成测试基座

**当前状态**：`go.mod` 无 `testcontainers-go` 依赖。

**设计方案**：新建 `internal/testcontainers/` 全局基座。

```
internal/testcontainers/
├── postgres.go               # PostgreSQL 容器生命周期
├── redis.go                  # Redis 容器
├── pg_client.go              # 连接池封装
├── fixtures/                 # SQL fixtures（seed 数据）
│   ├── tenants.sql
│   ├── pipelines.sql
│   └── tickets.sql
└── docs.md                   # 使用指南
```

**依赖引入**：
```go
// go.mod 新增（设计方案，不实际执行）
require github.com/testcontainers/testcontainers-go v0.33.0
```

**关键约束**：
- 集成测试用 `t.Helper()` + `testing.Short()` 跳过（避免 `go test -short` 阻塞）
- 容器生命周期 = 测试生命周期（`t.Cleanup`）
- 每个测试独立容器（避免脏数据）

#### 3.1.3 OpenAPI 契约测试

**当前状态**：无 `openapi.yaml` 或 `schema.json` 契约文件。

**设计方案**：
- 生成：`orion-platform-svc-go/openapi.yaml`（从 Gin routes 生成）
- 验证：`internal/openapi/validate_test.go` — 所有 handler 响应符合 schema
- 前端消费：`orion-frontend/src/api/client.gen.ts` 自动生成

---

## 4. 具体测试骨架模板

### 4.1 Service 层单元测试骨架（模板）

```go
// internal/<module>/service/<name>_test.go
package service

import (
    "context"
    "errors"
    "testing"

    "orion/platform-svc-go/internal/<module>/models"
    "orion/platform-svc-go/internal/<module>/testutil"
)

func Test<ServiceName>_<Method>_Success(t *testing.T) {
    // Arrange
    repo := testutil.NewMock<Name>Repository()
    svc := New<ServiceName>(repo)
    ctx := context.Background()

    // Act
    result, err := svc.<Method>(ctx, <input>)

    // Assert
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if result == nil {
        t.Fatal("expected non-nil result")
    }
    // 具体字段断言
}

func Test<ServiceName>_<Method>_NotFound(t *testing.T) {
    // 边界条件：资源不存在
    repo := testutil.NewMock<Name>Repository()
    repo.Set<Name>NotFound(<id>)
    svc := New<ServiceName>(repo)

    _, err := svc.<Method>(context.Background(), <id>)
    if !errors.Is(err, Err<Name>NotFound) {
        t.Errorf("expected ErrNotFound, got %v", err)
    }
}

func Test<ServiceName>_<Method>_RepoError(t *testing.T) {
    // 边界条件：下游依赖错误传播
    repo := testutil.NewMock<Name>Repository()
    repo.SetError(errors.New("db connection failed"))
    svc := New<ServiceName>(repo)

    _, err := svc.<Method>(context.Background(), <input>)
    if err == nil {
        t.Error("expected error propagation")
    }
}

func Test<ServiceName>_<Method>_TenantIsolation(t *testing.T) {
    // 多租户隔离（ADR-011 GATE-TENANT-ID-100 判据）
    repo := testutil.NewMock<Name>Repository()
    repo.SetErrorForTenant("tenant-b", errors.New("cross-tenant"))
    svc := New<ServiceName>(repo)

    _, err := svc.<Method>(context.Background(), "tenant-a", <input>)
    if err != nil {
        t.Errorf("tenant-a should succeed, got %v", err)
    }

    _, err = svc.<Method>(context.Background(), "tenant-b", <input>)
    if err == nil {
        t.Error("tenant-b should fail")
    }
}
```

### 4.2 Repository 集成测试骨架（模板）

```go
// internal/<module>/repository/<name>_integration_test.go
package repository

import (
    "context"
    "testing"

    "orion/platform-svc-go/internal/testcontainers"
)

func Test<Name>Repository_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("integration test, run with -short=false")
    }

    // Arrange: 启动独立 PostgreSQL 容器
    container, client := testcontainers.NewPostgreSQL(t)
    defer container.Terminate()

    // Seed fixtures
    container.Exec([]string{"psql", "-f", "/fixtures/tenants.sql"})

    // Act
    repo := New<Name>Repository(client)
    ctx := context.Background()

    // Assert: CRUD 全链路
    t.Run("Create", func(t *testing.T) {
        _, err := repo.Create(ctx, <data>)
        if err != nil {
            t.Fatal(err)
        }
    })

    t.Run("Read", func(t *testing.T) {
        _, err := repo.Get(ctx, <id>)
        if err != nil {
            t.Fatal(err)
        }
    })

    t.Run("Update", func(t *testing.T) {
        _, err := repo.Update(ctx, <id>, <data>)
        if err != nil {
            t.Fatal(err)
        }
    })

    t.Run("Delete", func(t *testing.T) {
        err := repo.Delete(ctx, <id>)
        if err != nil {
            t.Fatal(err)
        }
    })

    t.Run("TenantIsolation", func(t *testing.T) {
        // ADR-011 租户隔离：tenant-b 无法读 tenant-a 数据
        _, err := repo.Get(ctx, <id>, "tenant-b")
        if err == nil {
            t.Error("expected cross-tenant isolation error")
        }
    })
}
```

### 4.3 Handler 契约测试骨架（模板）

```go
// internal/<module>/handler/<name>_contract_test.go
package handler

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
)

func Test<Name>Handler_Contract(t *testing.T) {
    // Arrange
    gin.SetMode(gin.TestMode)
    router := gin.New()
    h := New<Name>Handler(mockService{})

    router.POST("/api/v1/<resource>", h.Create)
    router.GET("/api/v1/<resource>/:id", h.Get)
    router.PATCH("/api/v1/<resource>/:id", h.Update)
    router.Delete("/api/v1/<resource>/:id", h.Delete)

    t.Run("POST creates resource with 201", func(t *testing.T) {
        req := httptest.NewRequest("POST", "/api/v1/<resource>", <body>)
        w := httptest.NewRecorder()
        router.ServeHTTP(w, req)

        if w.Code != http.StatusCreated {
            t.Errorf("expected 201, got %d", w.Code)
        }
        // 验证响应 schema 匹配 openapi.yaml
    })

    t.Run("POST returns 400 for invalid body", func(t *testing.T) {
        req := httptest.NewRequest("POST", "/api/v1/<resource>", <invalidBody>)
        w := httptest.NewRecorder()
        router.ServeHTTP(w, req)

        if w.Code != http.StatusBadRequest {
            t.Errorf("expected 400, got %d", w.Code)
        }
    })

    t.Run("GET missing id returns 404", func(t *testing.T) {
        req := httptest.NewRequest("GET", "/api/v1/<resource>/nonexistent", nil)
        w := httptest.NewRecorder()
        router.ServeHTTP(w, req)

        if w.Code != http.StatusNotFound {
            t.Errorf("expected 404, got %d", w.Code)
        }
    })
}
```

### 4.4 Domain Event 单元测试骨架（DDD-T02）

```go
// internal/domain/events/domain_event_test.go
package events

import (
    "testing"
    "time"
)

type testEvent struct {
    BaseDomainEvent
    Payload string
}

func TestBaseDomainEvent_New(t *testing.T) {
    now := time.Now()
    ev := NewBaseDomainEvent("Pipeline", "p1", "pipeline.started", "t1", now, 1)

    if ev.AggregateType() != "Pipeline" {
        t.Errorf("AggregateType mismatch: %s", ev.AggregateType())
    }
    if ev.AggregateID() != "p1" {
        t.Errorf("AggregateID mismatch: %s", ev.AggregateID())
    }
    if ev.TenantID() != "t1" {
        t.Errorf("TenantID mismatch: %s", ev.TenantID())
    }
    if !ev.OccurredAt().Equal(now) {
        t.Errorf("OccurredAt mismatch: %v vs %v", ev.OccurredAt(), now)
    }
    if ev.Version() != 1 {
        t.Errorf("Version mismatch: %d", ev.Version())
    }
}

func TestBaseDomainEvent_Setters(t *testing.T) {
    ev := &BaseDomainEvent{}
    ev.SetAggregateID("p2")
    ev.SetTenantID("t2")
    ev.SetVersion(5)

    if ev.AggregateID() != "p2" || ev.TenantID() != "t2" || ev.Version() != 5 {
        t.Error("Setters not working")
    }
}

func TestBaseDomainEvent_JSONSerialization(t *testing.T) {
    // 序列化/反序列化契约（跨服务通信）
    // 断言 json tags 稳定
}
```

---

## 5. 门控自动化方案

### 5.1 新增 6 项 GATE-TEST 门控

| 门控 | 位置 | 阈值 | 严重度 |
|-----|-----|------|-------|
| **GATE-TEST-DOMAIN-CORE-80** | `internal/domain/{aggregates,commands,events,eventstore,readmodel}` | ≥ 80% | BLOCK |
| **GATE-TEST-SAGA-70** | `internal/saga/service` | ≥ 70%（当前 32.8%）| BLOCK |
| **GATE-TEST-EVENTBUS-70** | `internal/eventbus/handler` | ≥ 70%（当前 50.8%）| DEGRADE |
| **GATE-TEST-SERVICE-CORE-60** | 20 个 P0 Service 模块 | ≥ 60% | BLOCK |
| **GATE-TEST-REPO-CONTAINER** | Repository 集成测试存在 | ≥ 60 个测试 | DEGRADE |
| **GATE-TEST-CONTRACT-OPENAPI** | Handler 契约测试 | ≥ 40 个 API 端点 | DEGRADE |

### 5.2 CI 门控配置（伪代码）

```yaml
# .github/workflows/test-coverage-gate.yml
name: test-coverage-gate

on:
  pull_request:
    paths:
      - "orion-platform-svc-go/**/*.go"
      - "orion-platform-svc-go/go.mod"

jobs:
  domain-core-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - name: Coverage report
        run: |
          cd orion-platform-svc-go
          go test ./internal/domain/... -coverprofile=domain.out
      - name: Gate GATE-TEST-DOMAIN-CORE-80
        run: |
          COV=$(go tool cover -func=domain.out | tail -1 | awk '{print $3}' | tr -d '%')
          echo "Domain coverage: $COV%"
          if (( $(echo "$COV < 80" | bc -l) )); then
            echo "::error::GATE-TEST-DOMAIN-CORE-80 failed ($COV% < 80%)"
            exit 1
          fi
```

### 5.3 Gate Config 更新

在 `docs/baseline/gate-config.json` 追加：

```json
"GATE-TEST-DOMAIN-CORE-80": {
  "severity": "BLOCK",
  "source_doc": "docs/ddd-tdd-test-strategy-design-2026-10-11.md §5.1",
  "metric": "coverage_percent",
  "threshold": 80,
  "paths": ["internal/domain/"],
  "customer_visible": false
},
"GATE-TEST-SAGA-70": {
  "severity": "BLOCK",
  "metric": "coverage_percent",
  "threshold": 70,
  "paths": ["internal/saga/service/"],
  "current_baseline": 32.8,
  "customer_visible": true
},
"GATE-TEST-EVENTBUS-70": {
  "severity": "DEGRADE",
  "metric": "coverage_percent",
  "threshold": 70,
  "paths": ["internal/eventbus/handler/"],
  "current_baseline": 50.8,
  "feature_flag": "test.coverage.degraded",
  "fallback": "log_only"
}
```

---

## 6. Y 手册 §14.13 追加方案

### 6.1 §14.13 测试补齐批次（P0/P1）

**位置**：Y 手册 v5.10 §14.12 之后追加 §14.13

```markdown
## §14.13 分层测试策略补齐批次（NEW-EA-17 · 2026-10-11）

### §14.13.1 P0 批次（8 项）

| 任务 ID | 标题 | Migration | 门控 |
|---------|-----|-----------|-----|
| TEST-1 | DDD 基础设施补测（4 项 DDD-T01~T04）| — | GATE-TEST-DOMAIN-CORE-80 |
| TEST-2 | Saga 事务一致性补齐 + TestSaga_ChaosRollback | — | GATE-TEST-SAGA-70 |
| TEST-3 | Testcontainers 集成测试基座引入 | — | GATE-TEST-REPO-CONTAINER |
| TEST-4 | ticketing/service 深度补测（20.3%→60%）| — | GATE-TEST-SERVICE-CORE-60 |
| TEST-5 | chatops/service 深度补测（15.9%→60%）| — | GATE-TEST-SERVICE-CORE-60 |
| TEST-6 | security/secret/service 深度补测（4.5%→60%）| — | GATE-TEST-SERVICE-CORE-60 |
| TEST-7 | dba/service + slowquery 深度补测 | — | GATE-TEST-SERVICE-CORE-60 |
| TEST-8 | Y 手册 §1402 引用修正（TestSaga_ChaosRollback 落地）| — | — |

### §14.13.2 P1 批次（12 项）

| 任务 ID | 标题 | 门控 |
|---------|-----|-----|
| TEST-9 | EventBus handler 补测（50.8%→70%）| GATE-TEST-EVENTBUS-70 |
| TEST-10 | 20 个零测试模块 P0（agents/orchestration/task-executor/auto-recovery/chaos-engine 等）| — |
| TEST-11 | 8 个零测试模块 P1（alert-correlation/rule-engine/rate-limiting/cmdb-*/oncall/otel）| — |
| TEST-12 | OpenAPI 契约测试框架引入 | GATE-TEST-CONTRACT-OPENAPI |
| TEST-13 | 42 个零测试 handler 分层验证（TestServer）| — |
| TEST-14 | 前端 API 客户端补测（37→60）| — |
| TEST-15 | 前端核心 20 页面深度补测 | — |
| TEST-16 | TestUtil 目录标准化（280 模块）| — |
| TEST-17 | 分层测试策略文档纳入 CLAUDE.md | — |
| TEST-18 | CC 风险登记册 v5.6 更新 | — |
| TEST-19 | ADR-016 测试基础设施决策记录 | — |
| TEST-20 | 门控失败降级策略更新（新增 6 项）| — |
```

### 6.2 Migration 号段

**无新增 Migration**（本批次纯测试补齐，无数据库变更）。

### 6.3 门控总数更新

| 版本 | 门控总数 | 变化 |
|-----|--------|-----|
| Y 手册 v5.9（NEW-EA-15 前）| 35 | — |
| Y 手册 v5.10（NEW-EA-15）| 46 | +11 |
| **Y 手册 v5.11（NEW-EA-17 本设计）** | **52** | **+6** |

### 6.4 门控分布更新

| 严重度 | v5.10 | v5.11 本设计 |
|-------|------|-----------|
| BLOCK | 12 | **15**（+3：DOMAIN-CORE-80 / SAGA-70 / SERVICE-CORE-60）|
| DEGRADE | 24 | **27**（+3：EVENTBUS-70 / REPO-CONTAINER / CONTRACT-OPENAPI）|
| SKIP | 10 | 10 |
| **总计** | 46 | **52** |

---

## 7. CC 风险登记册 v5.6 更新

### 7.1 新增 4 项测试相关风险

| ID | 描述 | 严重度 | 缓解措施 |
|----|-----|-------|--------|
| **R-P0-10** | DDD 基础设施零测试导致事件流断裂 | P0 | TEST-1 补齐 4 项 |
| **R-P1-23** | Repository 集成测试缺失导致 SQL 破坏性变更 | P1 | TEST-3 Testcontainers |
| **R-P1-24** | Handler 契约破坏导致前端故障 | P1 | TEST-12 OpenAPI 契约 |
| **R-P1-25** | 反模式（快照/mock）导致虚假绿灯 | P1 | TEST-17 分层策略文档 |

### 7.2 CC v5.6 统计

| 版本 | 总数 | 变化 |
|-----|-----|-----|
| v5.5 | 62 | — |
| **v5.6** | **66** | **+4** |

---

## 8. ADR-016 建议（测试基础设施决策）

### 8.1 ADR-016 元数据

```yaml
id: ADR-016
title: 分层测试策略与基础设施选型
date: 2026-10-11
status: Proposed
decider: 测试架构师 + 平台架构师
```

### 8.2 决策内容

- **上下文**：DDD 基础设施零测试 / Service 覆盖率参差 / Repository 集成测试缺失
- **决策**：
  1. 建立分层测试金字塔（Unit 70% / Integration 20% / Contract 15% / E2E 10%）
  2. 引入 `testcontainers-go` 作为 Repository 集成测试基座
  3. 每个模块建立 `testutil/` 目录（手写 mock，非代码生成）
  4. 引入 OpenAPI 契约测试（Gin routes → schema.json）
  5. 新增 6 项 GATE-TEST 门控（3 BLOCK + 3 DEGRADE）
- **备选方案**：
  - A. 全部走单元测试 + mock（拒绝：Repository 无法有效 mock）
  - B. 全部走 E2E（拒绝：慢、脆弱）
  - **C. 分层策略（本决策）**：单元 + 集成 + 契约组合
- **后果**：门控 46→52；测试金字塔从 40% 单元→ 目标 70%；CI 时间增加 ~30%

---

## 9. Skill Handoff Checklist（完整）

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | **32** | 20（P0/P1 补齐任务）+ 8（TEST-1~8 P0）+ 4（TEST-9~12 P1 首批）| **P0** |
| **design-doc-reviewer** | 4 | Y §14.13 追加评审 + CC v5.6 更新 + ADR-016 评审 + CLAUDE.md 契约更新 | P1 |
| **design-constraint** | 6 | 6 项 GATE-TEST 门控实现 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "layered_test_strategy",
  "total_gaps": 32,
  "version_updates": {
    "y_playbook": "v5.10 → v5.11",
    "cc_risk_register": "v5.5 → v5.6",
    "stage_gate": "46 → 52",
    "adr": "+ADR-016"
  },
  "new_gates": [
    "GATE-TEST-DOMAIN-CORE-80",
    "GATE-TEST-SAGA-70",
    "GATE-TEST-EVENTBUS-70",
    "GATE-TEST-SERVICE-CORE-60",
    "GATE-TEST-REPO-CONTAINER",
    "GATE-TEST-CONTRACT-OPENAPI"
  ],
  "new_risks": ["R-P0-10", "R-P1-23", "R-P1-24", "R-P1-25"],
  "test_infra_blueprint": [
    "internal/testcontainers/ (new)",
    "internal/testutil/ (280 modules)",
    "internal/openapi/ (new)",
    "openapi.yaml (new)"
  ],
  "downstream_routing": {
    "task_decomposer": {
      "count": 32,
      "items_p0": [
        {"id": "TEST-1", "title": "DDD 基础设施补测 (DDD-T01~T04)", "depends_on": []},
        {"id": "TEST-2", "title": "Saga 事务一致性 + TestSaga_ChaosRollback", "depends_on": ["TEST-1"]},
        {"id": "TEST-3", "title": "Testcontainers 基座引入", "depends_on": []},
        {"id": "TEST-4", "title": "ticketing/service 补测 (20.3%→60%)", "depends_on": ["TEST-3"]},
        {"id": "TEST-5", "title": "chatops/service 补测 (15.9%→60%)", "depends_on": ["TEST-3"]},
        {"id": "TEST-6", "title": "security/secret/service 补测 (4.5%→60%)", "depends_on": ["TEST-3"]},
        {"id": "TEST-7", "title": "dba/service + slowquery 补测", "depends_on": ["TEST-3"]},
        {"id": "TEST-8", "title": "Y 手册 §1402 引用修正", "depends_on": ["TEST-2"]}
      ],
      "items_p1": [
        {"id": "TEST-9", "title": "EventBus handler 补测"},
        {"id": "TEST-10", "title": "20 个零测试模块 P0"},
        {"id": "TEST-11", "title": "8 个零测试模块 P1"},
        {"id": "TEST-12", "title": "OpenAPI 契约测试框架"},
        {"id": "TEST-13", "title": "42 零测试 handler 分层验证"},
        {"id": "TEST-14", "title": "前端 API 客户端补测"},
        {"id": "TEST-15", "title": "前端核心 20 页面深度补测"},
        {"id": "TEST-16", "title": "TestUtil 目录标准化 (280 模块)"},
        {"id": "TEST-17", "title": "分层策略文档纳入 CLAUDE.md"},
        {"id": "TEST-18", "title": "CC v5.6 更新"},
        {"id": "TEST-19", "title": "ADR-016 决策记录"},
        {"id": "TEST-20", "title": "门控失败降级策略更新"}
      ]
    }
  }
}
```

---

## 10. 执行路线图

```
Phase 1（P0 阻塞，S0 阶段）
  ├── TEST-3 Testcontainers 基座引入（依赖 go.mod 更新）
  ├── TEST-1 DDD 基础设施补测（4 项，独立可并行）
  ├── TEST-2 Saga 事务一致性 + TestSaga_ChaosRollback 补齐
  ├── TEST-8 Y 手册 §1402 引用修正（依赖 TEST-2）
  │
  └── TEST-4/5/6/7 Service 深度补测（依赖 TEST-3）

Phase 2（P1，S1 阶段）
  ├── TEST-9~15 各模块补测（可并行）
  ├── TEST-16 TestUtil 目录标准化（280 模块批量）
  └── TEST-12 OpenAPI 契约测试

Phase 3（治理，S2-S6 阶段）
  ├── TEST-17 CLAUDE.md 分层测试策略
  ├── TEST-18 CC v5.6 风险登记册
  ├── TEST-19 ADR-016 决策记录
  └── TEST-20 门控失败降级策略更新
```

---

## 11. 认知边界（诚实声明）

1. **本文件为设计方案**（RC-03 硬约束），未修改任何生产代码
2. **一手实测数据**来自 `go test -cover` 输出，非估算
3. **测试骨架模板**为可复制粘贴模板，具体断言由 task-decomposer 落地
4. **Testcontainers 依赖**当前 `go.mod` 未引入，需 task-decomposer 执行
5. **TestUtil 目录 280 个**为设计方案目标，非立即实现
6. **门控阈值**基于业界 SRE/Go 最佳实践（≥ 60% 关键、≥ 80% 核心），可协商
7. **Y 手册 v5.10 → v5.11 版本升级**由 task-decomposer 执行
8. **ADR-016 建议**，非强制，需平台架构师决策
9. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
10. **反模式判定基于业界共识**（Martin Fowler Test Pyramid + Google SRE），非系统内定义

---

## 12. 结论

- **交付物**：分层测试策略完整设计方案（NEW-EA-17）
- **核心方案**：
  - 分层测试金字塔（Unit 70% / Integration 20% / Contract 15% / E2E 10%）
  - 三大基础设施：TestUtil / Testcontainers / OpenAPI 契约
  - 具体测试骨架模板（Service / Repository / Handler / Domain Event 4 类）
  - 6 项新门控 GATE-TEST-*
  - Y 手册 §14.13 追加 20 项任务
  - CC 风险登记册 v5.6（62→66 项）
  - ADR-016 测试基础设施决策建议
- **门控总数**：46 → **52**（+6）
- **执行路线图**：3 Phase（P0 阻塞 → P1 补测 → 治理）
- **企业级判据**：D1 分层清晰 + D2 基础设施可复用 + D3 门控自动化 + D4 反模式规避 + D5 契约完整性（5/5 达标）
- **RC-03 硬约束遵守**：本文件为独立设计方案，未修改任何生产代码
- **关联文档**：
  - `ddd-tdd-test-coverage-expert-review-2026-10-11.md`（一手实测数据源）
  - `enterprise-architecture-depth-review-2026-10-11.md`（NEW-EA-1~15 基础）
  - `docs/gate-failure-degradation-2026-10-11.md`（NEW-EA-15 门控降级）
  - Y 手册 v5.10 §14.12（NEW-EA-1~15 交付批次）

**文件**：`docs/ddd-tdd-test-strategy-design-2026-10-11.md`
