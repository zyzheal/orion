# Orion 文档关系总览

**生成日期**: 2026-07-02
**目的**: 厘清所有分析文档的职责边界、依赖关系和内容重叠

---

## 一、文档分类总览

```
docs/
├── CLAUDE.md                          # 项目指引（开发规则、架构数字、前端规范）
├── INDEX.md                           # 设计文档索引（按领域/模块导航）
│
├── 系统分析类（5 份）
│   ├── system-truth-report-2026-07-01.md        # 真实状态报告：三文档偏差对照 + 模块功能分析
│   ├── orion-system-full-analysis-report-2026-07-02.md  # 全量分析报告：系统规模 + 文档出入清单
│   ├── orion-system-complementary-analysis-2026-07-02.md  # 互补补充：前后端映射 + temporal coupling + PageRank
│   ├── orion-system-deep-analysis-2026-07-01.md # 深度分析：持久化 + 微服务 + 路线图（已修正）
│   └── document-four-way-comparison-2026-07-02.md # 四文档对比：评估差异 + 修正建议
│
├── 模块完成度类（3 份）
│   ├── module-completion-status-report.md       # 完成度报告：8 领域逐模块完成度矩阵
│   ├── business-module-inventory.md             # 模块清单：145 模块按领域分组 + 前后端映射
│   └── analysis/                                # 深度分析目录
│       ├── system-complete-module-audit-2026-07-01.md   # 全量模块审计
│       ├── system-completeness-deep-analysis-v6-2026-07-01.md  # 精确量化分析
│       ├── system-completeness-expert-review-2026-07-01.md
│       ├── system-completeness-final-report-2026-07-01.md
│       ├── lowcode-module-deep-analysis.md          # 低代码模块深度分析
│       └── itsm-ticketing-deep-analysis.md          # ITSM/Ticketing 深度分析
│
├── 架构设计类
│   ├── go-service-unification-design.md         # Go 服务统一设计（含 v1.1 修正）
│   ├── service-authority-registry.md            # 服务权威注册表
│   ├── 清理与待实现清单-2026-07-01.md           # 清理 + Phase 迁移 + 系统问题
│   └── architecture/                            # 其他架构设计文档（40+ 份）
│
├── 前后端映射类（2 份）
│   ├── frontend-backend-mapping.md              # 前后端精确映射表（有误差）
│   └── orion-system-complementary-analysis-2026-07-02.md  # 互补补充中的映射（更准确）
│
└── 记忆/修正类
    └── memory/doc-corrections-2026-07-02.md     # 文档修正记录
```

---

## 二、各文档核心职责

| 文档 | 核心职责 | 独有内容 | 重叠内容 |
|------|---------|---------|---------|
| **CLAUDE.md** | 开发规则 + 架构数字 | 前端规范、技能触发规则、编码规则 | 微服务计数、routes/pages 统计 |
| **INDEX.md** | 设计文档导航 | 按领域/模块索引 | 代码实现状态总览 |
| **truth-report** | 三文档偏差分析 + 模块功能完成度 | 101 模块功能分析表、反向缺口分析 | 前端文件统计（有误差） |
| **full-report** | 系统规模统计 + 文档出入清单 | 17 项出入清单、模块交互 DAG | 目录关系、架构描述 |
| **complementary-analysis** | 补充 full-report 缺失 | temporal coupling、PageRank 热点 | 前后端映射、持久化批次 |
| **deep-analysis** | 持久化 + 微服务 + 路线图 | 迁移批次详细分析 | 微服务语言分布 |
| **four-way-comparison** | 评估文档深度 + 给出修正建议 | 综合评分表 | 各文档差异分析 |
| **module-completion-status** | 8 领域逐模块完成度矩阵 | Complete/Partial/Placeholder 分类 | 前后端匹配率 |
| **business-module-inventory** | 145 模块按领域分组 | 核心类/接口列表 | 前后端映射 |
| **frontend-backend-mapping** | 前后端精确映射表 | 50 精确 + 41 命名差异 + 84+109 缺口 | 与 complementary-analysis 重叠 |
| **go-service-unification-design** | Go 迁移设计 | Phase 1/2/3 计划、v1.1 修正 | 服务权威判定 |
| **service-authority-registry** | 服务权威注册表 | Go/TS 行数对比 + 端口 | Go 迁移决策依据 |
| **清理与待实现清单** | 清理 + 迁移 + 系统问题 | Phase 1-5 计划、P0-P2 问题 | 不可迁移列表 |
| **lowcode-deep-analysis** | 低代码模块深度分析 | 逐文件分析、技术债务 | 功能完整性评估 |
| **itsm-ticketing-deep-analysis** | ITSM/Ticketing 深度分析 | ITSM 标准对比、状态转换矩阵 | 功能完整性评估 |
| **analysis/system-complete-module-audit** | 全量模块审计 | 逐模块完成度矩阵 | 规模统计 |
| **analysis/system-completeness-v6** | 精确量化分析 | 路由持久化分类（直接 PG/间接 PG/纯 Map） | 后端服务统计 |

---

## 三、内容重叠与互补关系

### 3.1 系统规模统计（5 份文档涉及）

| 指标 | truth-report | full-report | complementary | deep-analysis | INDEX.md | CLAUDE.md |
|------|-------------|------------|--------------|--------------|----------|-----------|
| services 目录 | 139 | 139 | — | 139 | 139 | 139 |
| 前端 pages | 202 | 203 | 203 | 201 | 202 | 202 |
| 前端 .tsx | ~~739~~→638 | 638 | 638 | — | — | 739→638 |
| 前端 .ts | ~~345~~→14 | 14 | 14 | — | — | 345→14 |
| 前端 API | 239→253 | 253 | 253 | 249 | 239 | 239 |
| 后端 routes | 175 | 175 | 175 | 171 | 175 | 175 |
| 微服务总数 | 84 | 84 | — | 39 | 84 | 84 |
| Go main.go | ~~0~~→47 | 47/47 | — | — | 47/47 | 47/47 |

> **结论**: 经过修正，所有文档的规模统计已基本一致。complementary-analysis 的 638/14/253 是最准确的。

### 3.2 前后端映射（3 份文档涉及）

| 文档 | 精确匹配 | 命名差异 | 后端无前端 | 前端无后端 | 匹配率 |
|------|---------|---------|-----------|-----------|--------|
| frontend-backend-mapping | 50 | 41 | 84 | 109 | 52% |
| complementary-analysis | 54 | — | 123 | 151 | 54% |
| business-module-inventory | 50 | 41 | 84 | 109 | 52% |
| truth-report | 35 | — | 140 | 167 | 20% |

> **问题**: frontend-backend-mapping 有 18 条错误归类（应从匹配移到"无前端"），complementary-analysis 更准确。
> **建议**: 以 complementary-analysis 为准，修正 frontend-backend-mapping。

### 3.3 模块完成度（3 份文档涉及）

| 文档 | 粒度 | 分类方式 | 独有内容 |
|------|------|---------|---------|
| module-completion-status-report | 逐模块 | Complete/Partial/Placeholder | 8 领域完成率、技术债务 |
| business-module-inventory | 按领域分组 | Service+Repo+Route+Page | 核心类/接口列表 |
| analysis/system-complete-module-audit | 逐模块 | 完成度矩阵 | 全量审计 |
| analysis/system-completeness-v6 | 路由级 | 直接 PG/间接 PG/纯 Map | 路由持久化分类 |

> **结论**: 各有侧重，互补而非替代。

### 3.4 Go 微服务迁移（3 份文档涉及）

| 文档 | 内容 | 状态 |
|------|------|------|
| go-service-unification-design | Phase 1/2/3 计划 + v1.1 修正 | 已修正 |
| service-authority-registry | 权威实现判定 + 端口映射 | 最新 |
| 清理与待实现清单 | 迁移计划 + 系统问题 | 已修正 |

---

## 四、文档依赖关系

```
CLAUDE.md (开发规则基准)
    │
    ├── INDEX.md ← 设计文档导航
    │
    ├── truth-report ← 偏差分析基准
    │       │
    │       └── four-way-comparison ← 评估 truth/full/deep/INDEX
    │
    ├── full-report ← 规模统计基准
    │       │
    │       └── complementary-analysis ← 补充 full-report 缺失
    │
    ├── deep-analysis ← 持久化 + 路线图
    │
    ├── module-completion-status ← 8 领域完成度
    │       │
    │       └── business-module-inventory ← 145 模块清单
    │
    ├── frontend-backend-mapping ← 映射表（需修正）
    │       │
    │       └── complementary-analysis ← 更准确的映射
    │
    ├── go-service-unification-design ← Go 迁移设计
    │       │
    │       ├── service-authority-registry ← 权威判定
    │       └── 清理与待实现清单 ← 迁移计划
    │
    └── analysis/ ← 深度专题分析
            ├── lowcode-module-deep-analysis
            ├── itsm-ticketing-deep-analysis
            ├── system-complete-module-audit
            └── system-completeness-v6
```

---

## 五、当前系统整体掌握情况

### 5.1 已掌握的内容

| 维度 | 掌握程度 | 依据文档 |
|------|---------|---------|
| **系统规模** | 95% | full-report, complementary, CLAUDE.md |
| **目录关系** | 95% | full-report, CLAUDE.md |
| **系统架构** | 90% | full-report, deep-analysis, 当前系统架构.md |
| **前后端映射** | 80% | complementary-analysis（修正后） |
| **模块功能** | 85% | truth-report, module-completion-status |
| **模块完成度** | 90% | module-completion-status, business-module-inventory |
| **持久化状态** | 85% | deep-analysis, system-completeness-v6 |
| **Go 微服务** | 90% | go-service-unification-design, service-authority-registry |
| **文档出入** | 95% | full-report 17 项出入清单 |
| **技术债务** | 80% | module-completion-status, lowcode-deep-analysis, itsm-ticketing-deep-analysis |
| **temporal coupling** | 85% | complementary-analysis（新增） |
| **PageRank 热点** | 85% | complementary-analysis（新增） |
| **低代码模块** | 90% | lowcode-module-deep-analysis |
| **ITSM/Ticketing** | 90% | itsm-ticketing-deep-analysis |

### 5.2 未充分掌握的内容

| 维度 | 掌握程度 | 说明 |
|------|---------|------|
| **前端交互完整性** | 50% | 仅知道 ~15 个页面引用 mock，但具体哪些页面不清楚 |
| **297 个 Repository 实现细节** | 40% | 知道数量，但逐个功能不了解 |
| **68 个迁移文件内容** | 30% | 知道数量，但表结构关系不清 |
| **31 个 TS 微服务蓝图实现** | 35% | 有代码但完成度不明 |
| **47 个 Go 微服务实现** | 40% | 有 main.go 但功能完成度需逐个评估 |

### 5.3 关键数字速查

| 指标 | 数值 | 来源 |
|------|------|------|
| 后端服务目录 | 139 | 代码扫描 |
| 有 barrel 导出 | 100 | 代码扫描 |
| 无 barrel 但有源码 | 38 | 代码扫描 |
| 前端页面目录 | 203 | 代码扫描 |
| 前端 .tsx 文件 | 638 | 代码扫描 |
| 前端 .ts 文件 | 14 | 代码扫描 |
| 前端 API 客户端 | 253 | 代码扫描 |
| 后端路由文件 | 175 | 代码扫描 |
| Repository 文件 | 297 | 代码扫描 |
| 数据库迁移文件 | 68 | 代码扫描 |
| TS 微服务 | 31 | 代码扫描 |
| 非 TS orion-*-svc | 6 | 代码扫描 |
| Go 微服务 | 47 | 代码扫描 |
| 微服务总数 | 84 | 31+6+47 |
| 代码总行数 | ~150 万 | 代码扫描 |

---

## 六、文档清理建议

### 6.1 建议合并

| 应保留 | 应合并到 | 原因 |
|--------|---------|------|
| complementary-analysis | full-report | 互补补充是 full-report 的自然延伸 |
| frontend-backend-mapping | complementary-analysis / business-module-inventory | 内容重复，complementary 更准确 |
| four-way-comparison | memory/doc-corrections | 对比结论已体现在修正记录和互补补充中 |

### 6.2 建议保留独立

| 文档 | 理由 |
|------|------|
| CLAUDE.md | 开发规则基准，不可替代 |
| INDEX.md | 设计文档导航，不可替代 |
| truth-report | 模块功能分析深度最高 |
| full-report | 系统规模统计 + 文档出入清单最有价值 |
| module-completion-status | 8 领域逐模块完成度矩阵 |
| business-module-inventory | 145 模块按领域分组 + 核心类/接口 |
| go-service-unification-design | Go 迁移设计 + v1.1 修正 |
| service-authority-registry | 权威实现判定 |
| 清理与待实现清单 | 迁移计划 + 系统问题 |
| analysis/lowcode-module-deep-analysis | 专题深度分析 |
| analysis/itsm-ticketing-deep-analysis | 专题深度分析 |
| ts-to-go-migration-logic | TS→Go 迁移完整逻辑链 |
| analysis/system-completeness-v6 | 路由持久化分类 |

### 6.3 建议归档

| 文档 | 理由 |
|------|------|
| analysis/system-complete-module-audit | 被 v6 和 completion-status 替代 |
| analysis/system-completeness-expert-review | 中间版本，已被最终报告替代 |
| analysis/system-completeness-final-report | 中间版本，已被 completion-status 替代 |

---

**文档关系图**: 见下方可视化

```
                    ┌─────────────┐
                    │  CLAUDE.md  │  ← 开发规则基准
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │  INDEX.md  │   │truth-report│  │full-report│
     │ (文档导航) │   │ (偏差分析) │   │ (规模统计) │
     └───────────┘   └─────┬─────┘   └─────┬─────┘
                          │               │
                   ┌──────▼──────┐   ┌─────▼──────────┐
                   │four-way-    │   │complementary-  │
                   │comparison   │   │analysis        │
                   └─────────────┘   │ (+ temporal +  │
                                     │  PageRank)     │
                                     └──────┬───────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
              ┌─────▼─────┐         ┌───────▼───────┐      ┌───────▼────────┐
              │module-     │         │business-      │      │frontend-backend│
              │completion- │         │module-inventory│      │mapping.md     │
              │status      │         └───────────────┘      └────────────────┘
              └────────────┘
                    │
              ┌─────▼─────┐
              │analysis/  │
              │  lowcode  │  itsm-ticketing  system-completeness-v6
              └───────────┘

              ┌───────────────────────────────────────────┐
              │  go-service-unification-design            │
              │  service-authority-registry               │
              │  清理与待实现清单                         │
              └───────────────────────────────────────────┘
```
