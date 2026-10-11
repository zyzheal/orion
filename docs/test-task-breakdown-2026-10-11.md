# 测试任务拆分清单（2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | test-task-breakdown-2026-10-11 |
| 状态 | 已产出 |
| 日期 | 2026-10-11 |
| 依据 | Y 手册 v5.12 §14.13 + `docs/design-doc-cross-review-2026-10-11.md` CR-1~CR-9 |
| 任务总数 | 41 项（32 项测试 + 9 项 CR 修复）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 任务总览

| 批次 | 任务范围 | 数量 | 优先级 | 依赖 |
|------|---------|------|--------|------|
| P0 基础设施 | TEST-1~8 | 8 | P0 | 无外部依赖 |
| P1 门控落地 | TEST-9~20 | 12 | P1 | 依赖 P0 |
| v2 深度评审 | W1-W12 | 12 | P1 | 依赖 P0/P1 |
| CR 修复 | CR-1~CR-9 | 9 | P2 | 无依赖 |
| **总计** | | **41** | | |

### DAG 依赖图

```
TEST-1 (testutil 包) ─┬─→ TEST-2 (Testcontainers) ─┬─→ TEST-4 (eventstore 修复)
                      │                            ├─→ TEST-5 (Saga 补齐)
                      │                            └─→ TEST-11 (Repository 集成)
                      ├─→ TEST-3 (OpenAPI 契约) ───→ TEST-12 (Handler 契约)
                      ├─→ TEST-6 (secret 修复)
                      ├─→ TEST-7 (16 零模块首批)
                      ├─→ TEST-10 (4 类模板)
                      └─→ W5 (Builder API 审查)

TEST-4 ─→ TEST-13 (DomainEvent 回放) ─→ W1 (根因分析)
TEST-5 ─→ W2 (Saga 矩阵) + W9 (AST 检测器)
TEST-7 ─→ TEST-9 (16 零模块剩余) ─→ W4 (Root Cause)
TEST-8 (ANTI-PATTERN 门控) ─→ W8/W9/W10 (AST 检测器)
TEST-14 (COVERAGE-60 门控) ─→ W11 (T0-T3 文档) + W12 (预测模型)

CR-1~CR-3 (v2 声明) → CR-4~CR-6 (风险版本更新)
CR-7/CR-8 (Y §14.13.7 标注) 独立
CR-9 (R-P1-27 登记) 独立
```

---

## 2. P0 基础设施任务（8 项）

### TEST-1: internal/testutil/ 测试工具包

| 项 | 内容 |
|----|------|
| **任务** | 创建 `internal/testutil/` 包，含 Builder/Fixture/Assertion 三大 API |
| **输入** | 无 |
| **输出** | `internal/testutil/builder/` + `fixture/` + `assertion/` 目录 |
| **验收标准** | 1. `go build ./internal/testutil/...` 0 错误<br>2. `go test ./internal/testutil/...` 100% 通过<br>3. Builder API 支持 Aggregate/Event/Command 三类<br>4. Fixture 支持 tenant_id 自动注入<br>5. Assertion 提供 `AssertFieldsEqual` 替代 `!= nil` |
| **验证用例** | `go test -run TestBuilder_Aggregate` 通过<br>`go test -run TestFixture_TenantID` 通过<br>`go test -run TestAssertion_FieldsEqual` 通过 |
| **依赖** | 无 |
| **回滚** | `git revert <commit>`（删除目录）|
| **门控** | GATE-TEST-COVERAGE-60 T0=38% |

### TEST-2: Testcontainers-go PostgreSQL 集成测试基座

| 项 | 内容 |
|----|------|
| **任务** | 集成 Testcontainers-go，提供 PostgreSQL 容器化测试基座 |
| **输入** | TEST-1 |
| **输出** | `internal/testutil/container/postgres.go` |
| **验收标准** | 1. `go test -run TestPostgresContainer` 启动 PG 容器<br>2. 容器启动 ≤ 30s<br>3. 支持 migration 自动执行<br>4. 支持 tenant_id 隔离 schema<br>5. CI 环境兼容（ubuntu-latest）|
| **验证用例** | `go test -run TestPostgresContainer_Startup` ≤30s<br>`go test -run TestPostgresContainer_Migration` 通过<br>`go test -run TestPostgresContainer_TenantIsolation` 通过 |
| **依赖** | TEST-1 |
| **回滚** | 移除 testcontainers-go 依赖 |
| **门控** | GATE-TEST-REPOSITORY-70 T0=38% |

### TEST-3: OpenAPI 契约测试生成器

| 项 | 内容 |
|----|------|
| **任务** | 从 Gin routes 生成 OpenAPI schema，支持契约测试 |
| **输入** | TEST-1 |
| **输出** | `internal/testutil/contract/openapi_generator.go` |
| **验收标准** | 1. 扫描 `orion-platform-svc-go/internal/*/handler/*.go`<br>2. 生成 OpenAPI 3.0 schema<br>3. 支持 schema 版本化（semver）<br>4. 契约测试 `go test -run TestContractSchema` 通过 |
| **验证用例** | `go test -run TestContractSchema_Generate` 通过<br>`go test -run TestContractSchema_Versioning` 通过 |
| **依赖** | TEST-1 |
| **回滚** | 删除 generator |
| **门控** | GATE-TEST-HANDLER-CONTRACT-80 T0=0% |

### TEST-4: eventstore 假绿灯修复

| 项 | 内容 |
|----|------|
| **任务** | 将 `mockEventStore` 替换为真实 PostgreSQL（Testcontainers）|
| **输入** | TEST-2 |
| **输出** | 修改 `internal/domain/eventstore/postgresql_test.go` |
| **验收标准** | 1. `grep "mockEventStore" internal/domain/eventstore/` = 0<br>2. `go test ./internal/domain/eventstore/...` ≥ 60%<br>3. 397 行生产代码覆盖率 ≥ 60%<br>4. 事件回放测试通过 |
| **验证用例** | `go test -cover ./internal/domain/eventstore/...` ≥60%<br>`grep -c "mockEventStore" internal/domain/eventstore/` = 0 |
| **依赖** | TEST-2 |
| **回滚** | revert 单文件（恢复 mockEventStore）|
| **门控** | GATE-TEST-ANTI-PATTERN BLOCK（threshold=0）|

### TEST-5: Saga 23 个零覆盖方法补齐

| 项 | 内容 |
|----|------|
| **任务** | 为 Saga 42 方法中 23 个 0% 覆盖方法补齐测试 |
| **输入** | TEST-2 |
| **输出** | 修改 `internal/saga/service/*_test.go` |
| **验收标准** | 1. `grep "TestSaga_ChaosRollback" internal/saga/` ≥ 1<br>2. `go test -cover ./internal/saga/service/...` ≥ 50%<br>3. 42 方法中 0% 方法数 ≤ 10 |
| **验证用例** | `go test -run TestSaga_ChaosRollback` 通过<br>`go test -cover ./internal/saga/service/...` ≥50% |
| **依赖** | TEST-2 |
| **回滚** | revert 测试文件 |
| **门控** | GATE-TEST-SAGA-70 T0=32.8%（eventstore 子包 0→80）|

### TEST-6: security/secret/service 快照断言修复

| 项 | 内容 |
|----|------|
| **任务** | 将 `!= nil` 断言替换为字段级断言 |
| **输入** | TEST-1 |
| **输出** | 修改 `internal/security/secret/service/service_test.go` |
| **验收标准** | 1. `grep "!= nil" internal/security/secret/service/*_test.go` = 0<br>2. `go test -cover ./internal/security/secret/...` ≥ 60%<br>3. 字段断言覆盖 ≥ 5 个字段 |
| **验证用例** | `go test -run TestSecretService_Fields` 通过<br>`grep -c "!= nil" internal/security/secret/service/*_test.go` = 0 |
| **依赖** | TEST-1 |
| **回滚** | revert 测试文件 |
| **门控** | GATE-TEST-ANTI-PATTERN BLOCK |

### TEST-7: 16 个零测试模块补齐首批 8 个

| 项 | 内容 |
|----|------|
| **任务** | 为 16 个零测试模块中的 8 个补齐基础测试 |
| **输入** | TEST-1 |
| **输出** | 8 个模块新增 `*_test.go` |
| **验收标准** | 1. 首批 8 个模块 `go test ./...` 不再零覆盖<br>2. 每模块至少 3 个测试用例<br>3. 每模块覆盖率 ≥ 30% |
| **验证用例** | `go test ./internal/<module>/... -cover` ≥30%（8 个模块）|
| **依赖** | TEST-1 |
| **回滚** | revert 测试文件 |
| **门控** | GATE-TEST-COVERAGE-60 T1=45% |

### TEST-8: GATE-TEST-ANTI-PATTERN 门控

| 项 | 内容 |
|----|------|
| **任务** | 在 gate-config.json 中配置 GATE-TEST-ANTI-PATTERN 门控 |
| **输入** | 无（配置层）|
| **输出** | `docs/baseline/gate-config.json` 追加配置 |
| **验收标准** | 1. `grep "GATE-TEST-ANTI-PATTERN" docs/baseline/gate-config.json` ≥1<br>2. severity=BLOCK, threshold=0<br>3. anti_patterns 含 false_green_mock/snapshot_assertion/zero_assertion |
| **验证用例** | `grep -c "anti_patterns" docs/baseline/gate-config.json` ≥1 |
| **依赖** | 无 |
| **回滚** | 移除门控配置 |
| **门控** | 自身 |

---

## 3. P1 门控落地任务（12 项）

### TEST-9: 16 个零测试模块补齐剩余 8 个

| 项 | 内容 |
|----|------|
| **任务** | 补齐剩余 8 个零测试模块 |
| **依赖** | TEST-7 |
| **验收标准** | 16 个模块全部非零覆盖，每模块 ≥ 30% |
| **验证用例** | `go test ./... -cover` 0 个零覆盖模块 |
| **门控** | GATE-TEST-COVERAGE-60 T2=55% |

### TEST-10: DDD Aggregate 测试骨架模板

| 项 | 内容 |
|----|------|
| **任务** | 落地 4 类测试骨架模板（Service/Repository/Handler/DomainEvent）|
| **依赖** | TEST-1 |
| **验收标准** | `ls internal/testutil/templates/` ≥4 文件 |
| **验证用例** | `go test -run TestTemplate_Service` 通过 |
| **门控** | GATE-TEST-DDD-AGGREGATE-80 T1=30% |

### TEST-11: Repository 集成测试覆盖 10 个核心模块

| 项 | 内容 |
|----|------|
| **任务** | 使用 Testcontainers 为 10 个核心 Repository 补齐集成测试 |
| **依赖** | TEST-2 |
| **验收标准** | `go test -run TestRepository.*` ≥10 模块通过 |
| **验证用例** | `go test -run TestRepository_Ticketing` 通过 |
| **门控** | GATE-TEST-REPOSITORY-70 T2=60% |

### TEST-12: Handler 契约测试覆盖 Gin routes 80%

| 项 | 内容 |
|----|------|
| **任务** | 使用 OpenAPI schema 为 Gin routes 补齐契约测试 |
| **依赖** | TEST-3 |
| **验收标准** | `go test -run TestHandler.*` ≥80% routes 覆盖 |
| **验证用例** | `go test -run TestHandler_AlertAdapter` 通过 |
| **门控** | GATE-TEST-HANDLER-CONTRACT-80 T2=60% |

### TEST-13: DomainEvent 回放测试

| 项 | 内容 |
|----|------|
| **任务** | 实现 event sourcing 回放测试基座 |
| **依赖** | TEST-4 |
| **验收标准** | `go test -run TestEventReplay` 通过 |
| **验证用例** | `go test -run TestEventReplay_Pipeline` 通过 |
| **门控** | GATE-TEST-EVENT-REPLAY-100 T2=70% |

### TEST-14: GATE-TEST-COVERAGE-60 渐进式门控

| 项 | 内容 |
|----|------|
| **任务** | gate-config.json 配置 GATE-TEST-COVERAGE-60（ramp T0-T3）|
| **依赖** | TEST-8 |
| **验收标准** | `grep "GATE-TEST-COVERAGE-60" docs/baseline/gate-config.json` 存在 |
| **验证用例** | grep ramp T0=38/T1=45/T2=55/T3=60 |
| **门控** | 自身 |

### TEST-15: GATE-TEST-SAGA-70 子包降级

| 项 | 内容 |
|----|------|
| **任务** | 配置 eventstore 子包 override（0→80）|
| **依赖** | TEST-5 |
| **验收标准** | `grep "sub_package_overrides" docs/baseline/gate-config.json` 存在 |
| **验证用例** | grep eventstore T0=0/T1=30/T2=60/T3=80 |
| **门控** | 自身 |

### TEST-16: GATE-TEST-DDD-AGGREGATE-80 门控

| 项 | 内容 |
|----|------|
| **任务** | gate-config.json 配置 GATE-TEST-DDD-AGGREGATE-80 |
| **依赖** | TEST-10 |
| **验收标准** | grep 存在 |
| **验证用例** | grep ramp 0→80 |
| **门控** | 自身 |

### TEST-17: GATE-TEST-REPOSITORY-70 门控

| 项 | 内容 |
|----|------|
| **任务** | gate-config.json 配置 GATE-TEST-REPOSITORY-70 |
| **依赖** | TEST-11 |
| **验收标准** | grep 存在 |
| **验证用例** | grep ramp 38→70 |
| **门控** | 自身 |

### TEST-18: GATE-TEST-HANDLER-CONTRACT-80 门控

| 项 | 内容 |
|----|------|
| **任务** | gate-config.json 配置 GATE-TEST-HANDLER-CONTRACT-80 |
| **依赖** | TEST-12 |
| **验收标准** | grep 存在 |
| **验证用例** | grep ramp 0→80 |
| **门控** | 自身 |

### TEST-19: GATE-TEST-EVENT-REPLAY-100 门控

| 项 | 内容 |
|----|------|
| **任务** | gate-config.json 配置 GATE-TEST-EVENT-REPLAY-100 |
| **依赖** | TEST-13 |
| **验收标准** | grep 存在 |
| **验证用例** | grep ramp 0→100 |
| **门控** | 自身 |

### TEST-20: CI 阈值联动 ci.yml 30%→40%

| 项 | 内容 |
|----|------|
| **任务** | ✅ **已完成**（NEXT-7，提交 071dd9da4）|
| **依赖** | TEST-14 |
| **验收标准** | ✅ grep `threshold.*40` `.github/workflows/ci.yml` ≥1 |
| **验证用例** | ✅ GATE-CI-THRESHOLD-LINKED 已落地 |
| **门控** | ✅ GATE-CI-THRESHOLD-LINKED |

---

## 4. v2 深度评审任务（12 项，W1-W12）

### W1: eventstore 假绿灯根因分析报告

| 项 | 内容 |
|----|------|
| **任务** | 产出 `docs/eventstore-false-green-root-cause.md` |
| **依赖** | TEST-4 |
| **验收标准** | 文档存在，含 mockEventStore 历史原因 + 修复方案 + 预防措施 |
| **门控** | 无（文档层）|

### W2: Saga 42 方法覆盖率矩阵文档

| 项 | 内容 |
|----|------|
| **任务** | 产出 `docs/saga-coverage-matrix.md`（42 方法逐一标注覆盖率）|
| **依赖** | TEST-5 |
| **验收标准** | 文档存在，42 方法全部列出，0% 方法标注 P0 |
| **门控** | 无 |

### W3: security/secret 快照断言全仓扫描

| 项 | 内容 |
|----|------|
| **任务** | 扫描全仓 `*_test.go` 中 `!= nil` 断言 |
| **依赖** | TEST-6 |
| **验收标准** | `grep "!= nil" **/*_test.go` ≤5（当前估计 50+）|
| **门控** | GATE-TEST-ANTI-PATTERN |

### W4: 16 零测试模块 Root Cause 分类

| 项 | 内容 |
|----|------|
| **任务** | 产出 `docs/zero-test-modules-rootcause.md`（16 模块逐一分类）|
| **依赖** | TEST-7 |
| **验收标准** | 文档存在，16 模块分类为：遗忘/低优先/接口稳定/其他 |
| **门控** | 无 |

### W5: TestUtil Builder API 一致性审查

| 项 | 内容 |
|----|------|
| **任务** | 审查 `internal/testutil/builder/` API 一致性 |
| **依赖** | TEST-10 |
| **验收标准** | `go vet ./internal/testutil/...` 0 错误 |
| **门控** | 无 |

### W6: Testcontainers 环境变量泄漏检查

| 项 | 内容 |
|----|------|
| **任务** | 检查 `os.Getenv.*PG_PASSWORD` 仅在 fixture 中 |
| **依赖** | TEST-2 |
| **验收标准** | grep 仅在 `internal/testutil/container/` |
| **门控** | 无 |

### W7: OpenAPI schema 版本化

| 项 | 内容 |
|----|------|
| **任务** | schema_version 字段实现 |
| **依赖** | TEST-3 |
| **验收标准** | grep `schema_version` 在 generator 中 |
| **门控** | 无 |

### W8: 假绿灯 AST 检测器扩展

| 项 | 内容 |
|----|------|
| **任务** | design-constraint 技能扩展 `false_green_mock` detector |
| **依赖** | TEST-8 |
| **验收标准** | `grep "false_green_mock" docs/design-constraints/` ≥1 |
| **门控** | GATE-TEST-ANTI-PATTERN |

### W9: 快照断言 AST 检测器扩展

| 项 | 内容 |
|----|------|
| **任务** | 扩展 `snapshot_assertion` detector |
| **依赖** | TEST-8 |
| **验收标准** | `grep "snapshot_assertion" docs/design-constraints/` ≥1 |
| **门控** | GATE-TEST-ANTI-PATTERN |

### W10: 零断言 AST 检测器扩展

| 项 | 内容 |
|----|------|
| **任务** | 扩展 `zero_assertion` detector |
| **依赖** | TEST-8 |
| **验收标准** | `grep "zero_assertion" docs/design-constraints/` ≥1 |
| **门控** | GATE-TEST-ANTI-PATTERN |

### W11: 渐进式门控 T0-T3 文档化

| 项 | 内容 |
|----|------|
| **任务** | 产出 `docs/progressive-gate-ramp.md` |
| **依赖** | TEST-14 |
| **验收标准** | 文档存在，含 T0-T3 阈值表 + 切换条件 |
| **门控** | 无 |

### W12: 企业级达标预测模型

| 项 | 内容 |
|----|------|
| **任务** | 产出 `docs/enterprise-readiness-forecast.md`（53.4 校准模型）|
| **依赖** | TEST-14 |
| **验收标准** | 文档存在，含 5 Phase 预测 + 校准依据 |
| **门控** | 无 |

---

## 5. CR 修复任务（9 项）

### CR-1: NEW-EA-16 头部追加 v2 修正声明

| 项 | 内容 |
|----|------|
| **任务** | `docs/ddd-tdd-test-coverage-expert-review-2026-10-11.md` 头部追加声明 |
| **依赖** | 无 |
| **验收标准** | grep "v2 修正声明" 存在 |
| **门控** | 无 |

### CR-2: NEW-EA-17 头部追加 v2 修正声明

同 CR-1，目标文件 `docs/ddd-tdd-test-strategy-design-2026-10-11.md`

### CR-3: NEW-EA-18 头部追加 v2 修正声明

同 CR-1，目标文件 `docs/enterprise-readiness-assessment-2026-10-11.md`

### CR-4: NEW-EA-16 风险登记册引用 v5.5→v5.7

| 项 | 内容 |
|----|------|
| **任务** | 将 `v5.5` 引用更新为 `v5.7` |
| **依赖** | CR-1 |
| **验收标准** | grep "v5.5" 在该文档中 = 0 |
| **门控** | 无 |

### CR-5: NEW-EA-17 风险登记册引用 v5.5→v5.7

同 CR-4，目标文件 NEW-EA-17

### CR-6: NEW-EA-18 风险登记册引用 v5.5→v5.7

同 CR-4，目标文件 NEW-EA-18

### CR-7: Y §14.13.7 Phase 1 标注维度差异

| 项 | 内容 |
|----|------|
| **任务** | 在 Y §14.13.7 Phase 1=45 处追加注释"覆盖率预测 / NEW-EA-19 v2=35.6 综合得分" |
| **依赖** | 无 |
| **验收标准** | grep "维度差异" 在 §14.13.7 中存在 |
| **门控** | 无 |

### CR-8: Y §14.13.7 Phase 5 标注维度差异

| 项 | 内容 |
|----|------|
| **任务** | 在 Phase 5=72 处追加注释"综合得分 / ADR-016=60+ 覆盖率" |
| **依赖** | 无 |
| **验收标准** | grep 存在 |
| **门控** | 无 |

### CR-9: 风险登记册追加 R-P1-27

| 项 | 内容 |
|----|------|
| **任务** | 风险登记册 §1.6.3.2 追加 R-P1-27（v1/v2 不一致）|
| **依赖** | 无 |
| **验收标准** | grep "R-P1-27" 存在，v5.7→v5.8 |
| **门控** | 无 |

---

## 6. 执行顺序推荐

### 批次 1（P0，无依赖）
TEST-1 → TEST-8 → CR-1/CR-2/CR-3 → CR-7/CR-8/CR-9

### 批次 2（P0，依赖 TEST-1）
TEST-2 → TEST-3 → TEST-6 → TEST-7 → TEST-10 → W5/W6

### 批次 3（P0，依赖 TEST-2）
TEST-4 → TEST-5 → TEST-11 → W1/W2/W6

### 批次 4（P1，依赖 TEST-3）
TEST-12 → W7

### 批次 5（P1，依赖 TEST-4/5/7）
TEST-9 → TEST-13 → W3/W4

### 批次 6（P1，门控配置）
TEST-14~19 → W8/W9/W10/W11/W12

### 批次 7（CR 修复）
CR-4/CR-5/CR-6（依赖 CR-1/2/3）

---

## 7. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 41 | 本文档所有任务拆分（已含验收标准）| P0 |
| **design-doc-reviewer** | 1 | 本任务清单自身评审 | P3 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "test_task_breakdown",
  "total_tasks": 41,
  "distribution": {"P0": 8, "P1": 24, "P2_CR": 9},
  "already_completed": ["TEST-20"],
  "remaining": 40,
  "dag_root": "TEST-1",
  "downstream_routing": {
    "task_decomposer": {
      "count": 40,
      "priority": "P0+P1+P2"
    }
  }
}
```

---

## 8. 认知边界（诚实声明）

1. **本任务清单为拆分文档**：不执行任何任务，仅定义验收标准 + 验证用例 + 依赖 DAG
2. **TEST-20 已完成**：NEXT-7 提交 071dd9da4 已落地
3. **CR-1~CR-9 来源**：`docs/design-doc-cross-review-2026-10-11.md` §7.2
4. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
5. **RC-03 硬约束遵守**：本清单不修改生产代码
6. **验收标准 grep 命令**：为示例，实际执行时需 task-decomposer 确认路径
7. **DAG 依赖图**：为推荐顺序，实际执行可根据团队资源调整

---

## 9. 结论

- **任务拆分完成**：41 项任务（8 P0 + 12 P1 + 12 v2 + 9 CR）
- **核心产出**：每项含验收标准 + 验证用例 + 依赖 + 回滚 + 门控
- **DAG 依赖图**：TEST-1 为根节点，7 批次推荐执行顺序
- **已完成的任务**：TEST-20（CI 阈值联动）
- **RC-03 硬约束遵守**：本清单为拆分文档，未修改任何生产代码
- **关联文档**：
  - Y 手册 v5.12 §14.13（任务来源）
  - `docs/design-doc-cross-review-2026-10-11.md`（CR 来源）
  - `docs/ddd-tdd-test-strategy-design-v2-2026-10-11.md`（W1-W12 来源）

**文件**：`docs/test-task-breakdown-2026-10-11.md`
