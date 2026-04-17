# AI Change Intelligence (Semantic Blast Radius) - 设计文档

## 1. 概述

### 1.1 愿景
在 PR 合并前，AI 理解每个代码变更的语义影响面，映射到业务能力、服务依赖和 SLO 风险，而非仅停留在代码行级别。

### 1.2 核心价值
- **业务级风险感知** — 不仅知道改了哪些文件，更知道影响了哪些业务功能
- **精准审批路由** — 根据影响面自动选择审批人（改支付逻辑 → 必须支付负责人审批）
- **变更追溯** — 事故回溯时快速定位历史变更中的高风险提交

### 1.3 用户角色
- **Tech Lead** — 查看 PR 风险评分，决定是否放行
- **研发工程师** — 了解自己变更的影响范围
- **SRE** — 评估变更对 SLO 的潜在影响

## 2. 架构设计

### 2.1 组件分解

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Change Intelligence                    │
│                                                               │
│  PR/MR ──────▶ ┌─────────────┐                               │
│                 │ CodeBERT    │──▶ Semantic understanding     │
│                 │ (语义分析)   │     of changed files          │
│                 └──────┬──────┘                               │
│                        │                                      │
│                        ▼                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Neo4j Blast Radius Traversal             │    │
│  │  Changed File → API Endpoint → Service → Capability  │    │
│  │                 → Dependent Services → SLO Impact     │    │
│  └──────────────────────────────────────────────────────┘    │
│                        │                                      │
│                        ▼                                      │
│  ┌──────────────────────────────┐                             │
│  │ XGBoost Risk Scorer + SHAP   │                             │
│  │ Risk: 0.0 - 1.0              │                             │
│  │ Factors: [blast_radius, ...] │                             │
│  └──────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 集成点
- **代码管理 (M2)** — PR 事件触发源
- **AI 算法库 (M17)** — CodeBERT、XGBoost、SHAP
- **CMDB (M32)** — 服务依赖拓扑图（Neo4j）
- **审批工作台 (M3)** — 风险评分作为审批决策输入
- **知识库 (M30)** — 历史变更模式匹配

## 3. 数据模型

```sql
-- 变更智能报告
CREATE TABLE change_intelligence_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id           VARCHAR(100) NOT NULL,
  repo_id         VARCHAR(100) NOT NULL,
  commit_sha      VARCHAR(40) NOT NULL,
  risk_score      DECIMAL(3,2) NOT NULL,               -- 0.00 - 1.00
  risk_level      VARCHAR(20) NOT NULL,                 -- low | medium | high | critical
  affected_services INT NOT NULL DEFAULT 0,
  affected_capabilities INT NOT NULL DEFAULT 0,
  shap_factors    JSONB,                                -- [{factor, value, contribution}]
  gitlab_comment_posted BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ci_reports_pr ON change_intelligence_reports(pr_id, repo_id);

-- 受影响服务
CREATE TABLE change_intelligence_affected_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  service_name    VARCHAR(100) NOT NULL,
  service_tier    VARCHAR(10),                          -- tier-0 | tier-1 | tier-2
  impact_type     VARCHAR(50),                          -- direct | dependency | indirect
  changed_files   JSONB,                                -- [file_paths affecting this service]
  slo_risk        VARCHAR(20),                          -- none | low | medium | high
  recommended_reviewers JSONB                           -- [user_ids]
);

-- 风险因子
CREATE TABLE change_intelligence_risk_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  factor_name     VARCHAR(50) NOT NULL,
  factor_value    DECIMAL(5,3) NOT NULL,
  weight          DECIMAL(3,2) NOT NULL,
  contribution    DECIMAL(5,3) NOT NULL,                -- SHAP value
  description     TEXT
);

-- 历史匹配
CREATE TABLE change_intelligence_historical_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  historical_pr   VARCHAR(100),
  similarity      DECIMAL(3,2),
  incident_linked BOOLEAN DEFAULT false,
  incident_id     VARCHAR(100)
);
```

## 4. API 设计

```
POST   /api/v1/change-intelligence/analyze              # 触发分析 (body: prId, repoId, commitSha)
GET    /api/v1/change-intelligence/reports?prId=&repoId=  # 报告列表
GET    /api/v1/change-intelligence/reports/:id           # 报告详情
GET    /api/v1/change-intelligence/reports/:id/blast-radius  # 影响面图数据
POST   /api/v1/change-intelligence/blast-radius/query     # Neo4j 影响面查询
GET    /api/v1/change-intelligence/trends?repoId=&days=   # 风险趋势
```

## 5. Pipeline 集成

集成在 **Stage 5 (Release)** 的审批门禁之前：

```
PR 创建/更新
  → Webhook 触发 AI Change Intelligence
  → CodeBERT 分析变更文件的语义
  → Neo4j 遍历服务依赖图 → 计算影响面
  → XGBoost 评分 + SHAP 因子解释
  → 报告推送到 GitLab PR 评论
  → 审批工作台展示风险评分
  → 高风险 PR 自动增加审批人数要求
```

## 6. UI/UX 设计

### 6.1 变更智能报告 (`/change-intelligence/reports/:id`)
- 风险评分仪表盘：0-1 分数 + 风险级别颜色
- SHAP 因子瀑布图：展示各因子对风险评分的贡献
- 影响面交互图（Neo4j 数据可视化）：变更文件 → 服务 → 依赖服务 → SLO
- 受影响服务表格：服务名、层级、影响类型、SLO 风险、推荐审批人
- GitLab PR 评论状态

### 6.2 风险趋势 (`/change-intelligence/trends`)
- 按仓库/时间段的风险评分趋势图
- Top 高风险变更列表
- 事故关联分析

## 7. 安全与权限

| 权限 | 角色 |
|------|------|
| `change-intelligence:read` | developer, tech_lead, sre, admin |
| `change-intelligence:analyze` | developer, sre, admin |
| `change-intelligence:trend` | tech_lead, sre, admin |

## 8. 测试策略

- **L1 单元** — CodeBERT 语义分析、SHAP 因子计算、风险评分聚合
- **L2 集成** — Neo4j 图遍历、GitLab PR 评论推送、审批工作台集成
- **L3 E2E** — PR 创建 → 分析 → 报告 → PR 评论 → 审批路由全链路
- **L4 准确性** — 与历史事故关联率 > 70%，误报率 < 15%
- **L5 性能** — 单次分析 < 30s（PR 含 50 个文件变更）
