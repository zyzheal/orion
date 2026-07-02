# 跨域编排详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 13. 跨域编排
> **目标成熟度**: L1 → L1.5
> **关键交付**: CI+Infra 编排

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前编排能力：
- Pipeline 引擎（`engine/PipelineEngine.ts`）
- Saga 编排（`saga/SagaCoordinator.ts`）
- IaC 管理（`api/iac-routes.ts`）

**不足**：
- CI Pipeline 和 Infra 变更隔离，无统一编排
- 无跨域依赖关系管理（如：部署前需 Infra 就绪）
- 无跨域事务一致性保障
- 缺少跨域变更审批流

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| CI+Infra 统一编排 | 单次变更同时编排 CI 和 Infra 流程 | L1.5 |
| 跨域依赖管理 | 定义域间依赖关系，驱动执行顺序 | L1.5 |
| 跨域事务保障 | Saga 模式保障跨域操作一致性 | L1.5 |
| 变更审批流 | 跨域变更需多角色审批 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| CO1 | 支持跨域编排：CI → Infra → Deploy → Verify 完整链 | API 测试 |
| CO2 | 跨域依赖图可视化，循环依赖检测 | 前端验证 |
| CO3 | Saga 事务保障：任一域失败触发补偿操作 | 集成测试 |
| CO4 | 变更审批流：支持多级审批（Infra 变更需平台团队审批） | 集成测试 |
| CO5 | 变更审计日志：记录跨域变更的完整时间线 | API 测试 |
| CO6 | 变更回滚：支持一键回滚整个跨域变更链 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/orchestration
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/changes` | 获取变更列表 | query: status, domain | `{ data: CrossDomainChange[] }` |
| POST | `/changes` | 创建跨域变更 | `CreateCrossDomainChange` | `{ id, changeNumber }` |
| GET | `/changes/:id` | 获取变更详情 | - | `CrossDomainChange` |
| POST | `/changes/:id/start` | 开始执行变更 | - | `{ status, phases }` |
| POST | `/changes/:id/approve` | 审批变更 | `{ approverRole, comment }` | `{ success }` |
| POST | `/changes/:id/rollback` | 回滚变更 | `{ reason? }` | `{ status, phases }` |
| GET | `/dependencies` | 获取跨域依赖图 | - | `{ nodes, edges }` |
| POST | `/dependencies` | 定义跨域依赖 | `{ from, to, type }` | `{ id }` |
| DELETE | `/dependencies/:id` | 删除跨域依赖 | - | `{ success }` |

```typescript
interface CrossDomainChange {
  id: string;
  changeNumber: string;     // CHG-0001
  title: string;
  description: string;
  domains: DomainChange[];
  status: 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'rolled_back' | 'failed';
  approvalStatus: {
    required: string[];     // 需要审批的角色
    approved: string[];     // 已审批的角色
  };
  phases: OrchestrationPhase[];
  currentPhaseIndex: number;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface DomainChange {
  domain: string;           // 'ci' | 'infra' | 'deploy' | 'config'
  changeType: string;
  resourceId: string;
  config: Record<string, unknown>;
  status: string;
  rollbackConfig?: Record<string, unknown>;
}

interface OrchestrationPhase {
  name: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  outputs?: Record<string, unknown>;
  compensatingAction?: string;
}

interface CrossDomainDependency {
  id: string;
  fromDomain: string;
  fromResourceId: string;
  toDomain: string;
  toResourceId: string;
  dependencyType: 'hard' | 'soft';  // hard: 阻塞, soft: 非阻塞
}

interface DependencyGraph {
  nodes: { id: string; domain: string; name: string }[];
  edges: { from: string; to: string; type: string }[];
  cycles: string[][];        // 检测到的循环依赖
}
```

## 四、数据库变更

```sql
-- Migration 113: Cross-Domain Orchestration
CREATE TABLE IF NOT EXISTS cross_domain_changes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  change_number         VARCHAR(50) NOT NULL UNIQUE,
  title                 VARCHAR(300) NOT NULL,
  description           TEXT,
  domains               JSONB NOT NULL,
  status                VARCHAR(20) DEFAULT 'draft',
  approval_status       JSONB DEFAULT '{}',
  phases                JSONB DEFAULT '[]',
  current_phase_index   INT DEFAULT 0,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_cross_domain_changes_tenant ON cross_domain_changes(tenant_id);
CREATE INDEX idx_cross_domain_changes_status ON cross_domain_changes(status);

CREATE TABLE IF NOT EXISTS cross_domain_dependencies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  from_domain           VARCHAR(50) NOT NULL,
  from_resource_id      VARCHAR(200),
  to_domain             VARCHAR(50) NOT NULL,
  to_resource_id        VARCHAR(200),
  dependency_type       VARCHAR(20) DEFAULT 'hard',
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cross_domain_deps_tenant ON cross_domain_dependencies(tenant_id);
```

## 五、前端设计

**路由**: `/orchestration`

```
┌─────────────────────────────────────────────┐
│  跨域编排                      [创建变更]    │
├─────────────────────────────────────────────┤
│  CHG-0042: 新服务上线  🔄 执行中             │
│  ┌────────────────────────────────────────┐  │
│  │ Phase 1: CI Pipeline  ✅ 已完成         │  │
│  │ Phase 2: Infra 配置    ✅ 已完成         │  │
│  │ Phase 3: 部署发布      🔄 运行中         │  │
│  │ Phase 4: 验证测试      ░░ 待执行         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  跨域依赖图                                  │
│  ┌────────────────────────────────────────┐  │
│  │  CI ──→ Infra ──→ Deploy ──→ Verify   │  │
│  │   ↑         │                           │  │
│  │   └── Config ─┘                         │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Orchestration/index.tsx` | 新建 | 跨域编排主页面 |
| `src/pages/ChangeDetail/index.tsx` | 新建 | 变更详情页面 |
| `src/components/DependencyGraphViz/index.tsx` | 新建 | 依赖图可视化 |
| `src/api/orchestration.ts` | 新建 | 跨域编排 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 12 | Orchestrator、DependencyResolver、SagaCoordinator |
| 集成测试 | 4 | 创建变更→审批→执行→验证→回滚完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 依赖检测 | < 1s（100 节点） |
| 阶段切换 | < 5s |
| 回滚执行 | < 60s |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 编排引擎 | 3 | 1 | 2 |
| 依赖管理 | 2 | 2 | 1 |
| 审批流 | 1 | 1 | 1 |
| 回滚机制 | 1 | 1 | 1 |
| **合计** | **7** | **5** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
