# 社区生态详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 11. 社区生态
> **目标成熟度**: L1 → L1.5
> **关键交付**: 最佳实践库

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前社区能力：
- Knowledge base 模块（`orion-knowledge/`）
- Skill 管理系统（`api/skill-routes.ts`）

**不足**：
- 无最佳实践知识库（Pipeline 模板、部署策略、故障处理指南）
- 无社区贡献/审核流程
- 无实践效果反馈机制
- 无与 Orion 平台的深度集成（一键应用最佳实践）

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 最佳实践库 | 分类管理的最佳实践文档与模板 | L1.5 |
| 一键应用 | 最佳实践可直接应用到项目/Pipeline | L1.5 |
| 效果反馈 | 实践应用后的效果追踪与评分 | L1.5 |
| 社区贡献 | 用户提交/审核/发布实践 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| CE1 | 最佳实践覆盖 5+ 领域：Pipeline 优化、部署策略、安全、监控、成本 | 前端验证 |
| CE2 | 每个实践含：描述、适用场景、实施步骤、预期效果、关联模板 | API 测试 |
| CE3 | 支持一键应用到项目（自动生成 Pipeline/配置） | 集成测试 |
| CE4 | 应用效果反馈：实施后 DORA 指标对比 | API 测试 |
| CE5 | 社区贡献流程：提交 → 审核 → 发布 → 反馈 | 集成测试 |
| CE6 | 实践按受欢迎度/效果评分排序 | API 测试 |

## 三、API 设计

```
Base: /api/v1/community
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/practices` | 获取最佳实践列表 | query: category, sort | `{ data: BestPractice[], total }` |
| GET | `/practices/:id` | 获取实践详情 | - | `BestPractice` |
| POST | `/practices/:id/apply` | 应用到项目 | `{ projectId, config? }` | `{ applicationId, status }` |
| GET | `/practices/:id/applications` | 获取应用记录 | - | `{ data: Application[] }` |
| POST | `/practices/:id/feedback` | 提交效果反馈 | `{ metrics, rating, review }` | `{ success }` |
| POST | `/practices` | 提交新实践 | `CreatePractice` | `{ id, status }` |
| GET | `/submissions` | 获取社区提交列表 | query: status | `{ data: Submission[] }` |
| POST | `/submissions/:id/review` | 审核提交 | `{ action: 'approve'|'reject', comment? }` | `{ success }` |

```typescript
interface BestPractice {
  id: string;
  title: string;
  category: string;          // 'pipeline' | 'deploy' | 'security' | 'monitoring' | 'cost'
  description: string;
 适用Scenarios: string[];
  steps: PracticeStep[];
  expectedImpact: {
    metric: string;
    improvement: string;     // '30% faster builds', '50% fewer incidents'
  }[];
  templates: {
    type: string;
    content: string;         // YAML/JSON template
  }[];
  author: string;
  rating: number;
  applicationCount: number;
  effectivenessScore: number; // 基于应用效果计算
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

interface PracticeStep {
  title: string;
  description: string;
  code?: string;
  config?: Record<string, unknown>;
}

interface PracticeApplication {
  id: string;
  practiceId: string;
  projectId: string;
  status: 'applied' | 'in_progress' | 'completed' | 'failed';
  config: Record<string, unknown>;
  appliedBy: string;
  appliedAt: Date;
  impactMetrics?: Record<string, unknown>;
}

interface PracticeSubmission {
  id: string;
  title: string;
  category: string;
  content: Record<string, unknown>;
  author: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  reviewer?: string;
  reviewComment?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}
```

## 四、数据库变更

```sql
-- Migration 111: Community Ecosystem
CREATE TABLE IF NOT EXISTS best_practices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(300) NOT NULL,
  category              VARCHAR(50) NOT NULL,
  description           TEXT,
  scenarios             TEXT[] DEFAULT '{}',
  steps                 JSONB DEFAULT '[]',
  expected_impact       JSONB DEFAULT '[]',
  templates             JSONB DEFAULT '[]',
  author_id             UUID REFERENCES users(id),
  rating                DECIMAL(2,1) DEFAULT 0,
  application_count     INT DEFAULT 0,
  effectiveness_score   DECIMAL(3,2),
  tags                  TEXT[] DEFAULT '{}',
  status                VARCHAR(20) DEFAULT 'published',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_best_practices_category ON best_practices(category);
CREATE INDEX idx_best_practices_tags ON best_practices USING gin(tags);

CREATE TABLE IF NOT EXISTS practice_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id           UUID NOT NULL REFERENCES best_practices(id),
  project_id            UUID NOT NULL,
  status                VARCHAR(20) DEFAULT 'applied',
  config                JSONB DEFAULT '{}',
  applied_by            UUID REFERENCES users(id),
  applied_at            TIMESTAMPTZ DEFAULT now(),
  impact_metrics        JSONB
);
CREATE INDEX idx_practice_applications_practice ON practice_applications(practice_id);

CREATE TABLE IF NOT EXISTS practice_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(300) NOT NULL,
  category              VARCHAR(50) NOT NULL,
  content               JSONB NOT NULL,
  author_id             UUID REFERENCES users(id),
  status                VARCHAR(20) DEFAULT 'draft',
  reviewer_id           UUID REFERENCES users(id),
  review_comment        TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT now(),
  reviewed_at           TIMESTAMPTZ
);
```

## 五、前端设计

**路由**: `/community`

```
┌─────────────────────────────────────────────┐
│  社区生态                        [提交实践]  │
├─────────────────────────────────────────────┤
│  分类: [全部] [流水线] [部署] [安全] [监控]  │
│  排序: ○ 热门  ○ 效果  ○ 最新               │
├─────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ 并行构建优化  Pipeline  ⭐4.7           │  │
│  │   效果: 构建时间减少 40%                │  │
│  │   已应用: 256 次  [应用] [详情]         │  │
│  ├────────────────────────────────────────┤  │
│  │ 蓝绿部署策略  部署  ⭐4.5               │  │
│  │   效果: 部署故障减少 60%                │  │
│  │   已应用: 189 次  [应用] [详情]         │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Community/index.tsx` | 新建 | 社区生态主页面 |
| `src/pages/PracticeDetail/index.tsx` | 新建 | 实践详情页面 |
| `src/components/PracticeCard/index.tsx` | 新建 | 实践卡片组件 |
| `src/api/community.ts` | 新建 | 社区 API 调用 |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 10 | PracticeService、EffectivenessScorer、SubmissionWorkflow |
| 集成测试 | 3 | 提交→审核→发布→应用→反馈完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 实践库加载 | < 500ms |
| 一键应用 | < 10s |
| 审核流程 | 状态机驱动，审计日志完整 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 最佳实践库 | 2 | 3 | 1 |
| 一键应用 | 2 | 1 | 1 |
| 效果反馈 | 1 | 1 | 0.5 |
| 社区贡献 | 1 | 1 | 1 |
| **合计** | **6** | **6** | **3.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
