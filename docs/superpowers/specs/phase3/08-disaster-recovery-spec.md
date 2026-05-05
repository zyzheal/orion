# 灾备演练详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 8. 灾备演练
> **目标成熟度**: L1 → L1.5
> **关键交付**: RTO/RPO 验证

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- 备份恢复 API（`api/backup-routes.ts`）
- DisasterRecoveryService 基础服务
- PostgreSQL WAL 归档

**不足**：
- 无自动化灾备演练（手动验证 RTO/RPO）
- 无演练计划与调度
- 无 RTO/RPO 达标报告
- 缺少多场景演练（数据库、存储、网络故障）

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 演练计划 | 定义演练场景、频率、参与人 | L1.5 |
| RTO/RPO 验证 | 自动化测量恢复时间和数据丢失量 | L1.5 |
| 演练报告 | 自动生成演练报告与改进建议 | L1.5 |
| 多场景演练 | 数据库故障、存储故障、区域故障 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 支持 4+ 演练场景：数据库故障、存储故障、区域故障、网络分区 | API 测试 |
| D2 | RTO 自动测量（从故障注入到服务恢复的时间） | 集成测试 |
| D3 | RPO 自动测量（恢复后数据丢失量） | 集成测试 |
| D4 | 演练报告含：RTO/RPO 实际值 vs 目标值、达标状态、改进建议 | API 测试 |
| D5 | 演练计划支持 cron 调度 | API 测试 |
| D6 | 演练环境隔离（不影响生产环境） | 集成测试 |
| D7 | 演练历史记录可追溯，支持趋势分析 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/disaster-recovery
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/drills` | 获取演练列表 | query: status, scenario | `{ data: DRDrill[], total }` |
| POST | `/drills` | 创建演练计划 | `CreateDRDrill` | `{ id, name, scenario }` |
| GET | `/drills/:id` | 获取演练详情 | - | `DRDrill` |
| POST | `/drills/:id/start` | 开始演练 | - | `{ drillId, status, startedAt }` |
| POST | `/drills/:id/stop` | 停止演练 | - | `{ success, rto, rpo }` |
| GET | `/drills/:id/report` | 获取演练报告 | - | `DRReport` |
| GET | `/targets` | 获取 RTO/RPO 目标 | - | `{ scenarios: { rtoTargetMs, rpoTargetMs }[] }` |
| PUT | `/targets` | 更新 RTO/RPO 目标 | `DRTargets` | `{ ... }` |
| GET | `/compliance` | 获取合规状态 | - | `{ compliant, scenarios, lastDrillAt }` |

```typescript
interface DRDrill {
  id: string;
  name: string;
  scenario: string;       // 'db_failure' | 'storage_failure' | 'region_failure' | 'network_partition'
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  schedule?: string;      // cron
  environment: 'staging' | 'production';
  rtoTargetMs: number;
  rpoTargetMs: number;
  rtoActualMs?: number;
  rpoActualMs?: number;
  compliant: boolean;
  participants: string[];
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
}

interface DRReport {
  drillId: string;
  scenario: string;
  rtoTargetMs: number;
  rtoActualMs: number;
  rtoCompliant: boolean;
  rpoTargetMs: number;
  rpoActualMs: number;
  rpoCompliant: boolean;
  steps: DRStep[];
  issues: string[];
  recommendations: string[];
  overallStatus: 'pass' | 'fail' | 'partial';
}

interface DRStep {
  name: string;
  description: string;
  durationMs: number;
  status: 'success' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt: Date;
}

interface DRTargets {
  scenarios: {
    scenario: string;
    rtoTargetMs: number;
    rpoTargetMs: number;
    lastTestedAt?: Date;
  }[];
}
```

## 四、数据库变更

```sql
-- Migration 108: Disaster Recovery Drills
CREATE TABLE IF NOT EXISTS dr_drills (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  scenario              VARCHAR(50) NOT NULL,
  status                VARCHAR(20) DEFAULT 'scheduled',
  schedule              VARCHAR(50),
  environment           VARCHAR(20) DEFAULT 'staging',
  rto_target_ms         BIGINT,
  rpo_target_ms         BIGINT,
  rto_actual_ms         BIGINT,
  rpo_actual_ms         BIGINT,
  compliant             BOOLEAN,
  participants          TEXT[] DEFAULT '{}',
  notes                 TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_dr_drills_tenant ON dr_drills(tenant_id);
CREATE INDEX idx_dr_drills_scenario ON dr_drills(scenario, status);

CREATE TABLE IF NOT EXISTS dr_drill_steps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id              UUID NOT NULL REFERENCES dr_drills(id) ON DELETE CASCADE,
  step_name             VARCHAR(200),
  description           TEXT,
  duration_ms           BIGINT,
  status                VARCHAR(20),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_dr_drill_steps_drill ON dr_drill_steps(drill_id);

CREATE TABLE IF NOT EXISTS dr_targets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  scenario              VARCHAR(50) NOT NULL,
  rto_target_ms         BIGINT NOT NULL,
  rpo_target_ms         BIGINT NOT NULL,
  last_tested_at        TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, scenario)
);
```

## 五、前端设计

**路由**: `/disaster-recovery`

```
┌─────────────────────────────────────────────┐
│  灾备演练                        [创建演练]  │
├─────────────────────────────────────────────┤
│  RTO/RPO 合规状态                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 数据库故障│ │ 存储故障 │ │ 区域故障 │     │
│  │ RTO: ✅  │ │ RTO: ✅  │ │ RTO: ❌  │     │
│  │ RPO: ✅  │ │ RPO: ✅  │ │ RPO: ⚠️  │     │
│  │ 上次:3天前│ │ 上次:7天 │ │ 上次:30天│     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  演练历史                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 2026-05-01  数据库故障  RTO:45s/60s ✅ │  │
│  │ 2026-04-15  存储故障  RTO:30s/60s ✅   │  │
│  │ 2026-04-01  区域故障  RTO:180s/120s ❌ │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/DisasterRecovery/index.tsx` | 新建 | 灾备演练主页面 |
| `src/pages/DRDrillDetail/index.tsx` | 新建 | 演练详情/报告页面 |
| `src/components/ComplianceStatus/index.tsx` | 新建 | 合规状态组件 |
| `src/api/disaster-recovery.ts` | 新建 | 灾备演练 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 12 | DRDrillOrchestrator、RTOMeasurer、RPOCalculator |
| 集成测试 | 4 | 演练执行→RTO/RPO 测量→报告生成 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 演练环境隔离 | 完全独立，不影响生产 |
| RTO 测量精度 | < 1s |
| RPO 测量精度 | 事务级别 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 演练编排器 | 3 | - | 2 |
| RTO/RPO 测量 | 2 | 1 | 1 |
| 报告生成 | 1 | 1 | 1 |
| 调度管理 | 1 | 1 | 0.5 |
| **合计** | **7** | **3** | **4.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
