# 合规与安全（Compliance & Vulnerability）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/compliance/` + `vulnerability/` + `repositories/ComplianceEvidenceRepository.ts` + `Phase3Repository.ts`

---

## 模块概览

Compliance & Vulnerability 模块承担**合规框架管理、策略评估、证据收集、差距分析、漏洞扫描、修复工作流**六大职责。当前实现已迁移到 PostgreSQL，包含完整的合规生命周期管理。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 合规框架与策略 | `services/compliance/ComplianceService.ts` | ✅ PostgreSQL |
| 合规证据收集 | `services/compliance/ComplianceEvidenceService.ts` | ✅ PostgreSQL |
| 合规差距分析 | `services/compliance/ComplianceGapAnalysisService.ts` | ✅ PostgreSQL |
| 合规报告管理 | `services/compliance/ComplianceReportService.ts` | ✅ PostgreSQL |
| 合规定时任务 | `services/compliance/ComplianceScheduleService.ts` | ✅ PostgreSQL |
| 漏洞扫描服务 | `services/vulnerability/VulnerabilityService.ts` | ✅ PostgreSQL |
| 漏洞持久化 | `repositories/VulnerabilityRepository.ts` | ✅ PostgreSQL |
| 合规证据 Repository | `repositories/ComplianceEvidenceRepository.ts` | ✅ PostgreSQL |

---

## 架构设计

### 分层结构

```
API Routes (compliance-routes.ts, security-compliance-routes.ts, vulnerability相关)
    ↓
Controllers (SecurityComplianceController, VulnerabilityController)
    ↓
Service Layer (ComplianceService, ComplianceEvidenceService, VulnerabilityService)
    ↓
Repository Layer (CompliancePolicyRepository, ComplianceEvaluationRepository, 
                   ComplianceRemediationRepository, ComplianceEvidenceRepository,
                   VulnerabilityRepository)
    ↓
PostgreSQL Database (Phase3Repository + 专用 Repository)
```

### 关键设计模式

- **六层合规架构**：Framework → Policy → Evidence → Evaluation → Remediation → Report
- **Repository Pattern**：5 个专用 Repository 均已迁移到 PostgreSQL
- **npm audit 集成**：VulnerabilityService 通过 exec 调用 npm audit CLI
- **供应链联动**：VulnerabilityService 集成 SupplyChainService 作为降级方案

---

## 功能完整性评估

### 合规框架与策略

| 功能 | 状态 | 说明 |
|------|------|------|
| 框架定义 | ✅ | SOC2/ISO27001/HIPAA 等 |
| 策略 CRUD | ✅ | 策略创建/查询/更新/删除 |
| 规则配置 | ✅ | 策略可配置规则 |
| 严重度阈值 | ✅ | severityThreshold 配置 |
| 策略版本 | ✅ | 支持策略版本管理 |

### 合规评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 自动评估执行 | ✅ | 定时/手动触发 |
| 合规分数计算 | ✅ | 基于规则匹配 |
| 评估历史 | ✅ | 评估记录持久化 |
| 合规状态追踪 | ✅ | compliant/non-compliant |

### 证据收集

| 功能 | 状态 | 说明 |
|------|------|------|
| 自动证据收集 | ✅ | 从各模块收集证据 |
| 证据存储 | ✅ | PostgreSQL + 文件 |
| 证据验证 | ✅ | 证据完整性校验 |
| 证据链 | ✅ | 证据来源追踪 |

### 差距分析

| 功能 | 状态 | 说明 |
|------|------|------|
| 差距识别 | ✅ | 自动识别合规差距 |
| 修复建议 | ✅ | 每个差距有 remediation |
| 差距优先级 | ✅ | critical/high/medium/low |
| 差距跟踪 | ✅ | 状态追踪 |

### 漏洞扫描

| 功能 | 状态 | 说明 |
|------|------|------|
| npm audit 集成 | ✅ | 调用 npm audit CLI |
| CVE 查询 | ✅ | 漏洞详情查询 |
| 漏洞报告 | ✅ | 按租户/严重度聚合 |
| 修复工作流 | ✅ | remediateVulnerability |
| 漏洞状态 | ✅ | open/in_progress/resolved/ignored |
| 扫描历史 | ✅ | 扫描记录持久化 |

---

## API 端点清单

### 合规管理（`/api/v1/compliance`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/policies` | 创建合规策略 |
| GET | `/policies` | 策略列表 |
| GET | `/policies/:id` | 策略详情 |
| PUT | `/policies/:id` | 更新策略 |
| DELETE | `/policies/:id` | 删除策略 |
| POST | `/evaluate` | 执行合规评估 |
| GET | `/evaluations` | 评估历史 |
| GET | `/evaluations/:id` | 评估详情 |
| POST | `/evidence/collect` | 收集证据 |
| GET | `/evidence/:id` | 证据详情 |
| POST | `/gap-analysis` | 差距分析 |
| GET | `/reports` | 合规报告 |
| POST | `/schedules` | 创建定时任务 |
| GET | `/schedules` | 定时任务列表 |

### 安全合规（`/api/v1/security-compliance`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/frameworks` | 合规框架列表 |
| GET | `/frameworks/:id/score` | 框架合规分数 |
| POST | `/frameworks/:id/check` | 运行合规检查 |
| GET | `/violations` | 违规列表 |
| POST | `/violations/:id/remediate` | 修复违规 |

### 漏洞管理（`/api/v1/vulnerabilities`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/scan/dependencies` | 扫描依赖漏洞 |
| GET | `/scan/:scanId` | 扫描结果 |
| GET | `/reports/tenant/:tenantId` | 租户漏洞报告 |
| GET | `/:cveId` | CVE 详情 |
| POST | `/:id/remediate` | 修复漏洞 |
| PATCH | `/:id/status` | 更新漏洞状态 |
| GET | `/severity/:level` | 按严重度查询 |

---

## 数据模型

### CompliancePolicy

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 策略 ID |
| tenant_id | string | 租户 ID |
| name | string | 策略名称 |
| description | text | 策略描述 |
| framework_type | string | 框架类型 |
| requirements | JSONB | 合规要求 |
| rules | JSONB | 规则配置 |
| severity_threshold | string | 严重度阈值 |
| created_by | string | 创建人 |
| created_at | timestamp | 创建时间 |

### ComplianceEvaluation

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 评估 ID |
| tenant_id | string | 租户 ID |
| policy_id | UUID | 关联策略 |
| score | float | 合规分数 |
| status | string | 评估状态 |
| findings | JSONB | 评估发现 |
| evidence | JSONB | 证据引用 |
| evaluated_at | timestamp | 评估时间 |

### Vulnerability

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 漏洞 ID |
| tenant_id | string | 租户 ID |
| cve_id | string | CVE 编号 |
| package_name | string | 依赖包名 |
| package_version | string | 依赖版本 |
| severity | string | critical/high/medium/low |
| status | string | 漏洞状态 |
| description | text | 漏洞描述 |
| remediation | text | 修复建议 |
| discovered_at | timestamp | 发现时间 |

### ComplianceEvidence

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 证据 ID |
| tenant_id | string | 租户 ID |
| policy_id | UUID | 关联策略 |
| evaluation_id | UUID | 关联评估 |
| evidence_type | string | 证据类型 |
| source | string | 证据来源 |
| data | JSONB | 证据数据 |
| collected_at | timestamp | 收集时间 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| SupplyChain | 漏洞查询 + SBOM 合规 | ✅ |
| Audit | 合规审计日志 | ✅ |
| Approval | 合规问题审批 | ⚠️ 未完全对接 |
| Alert | 合规 violation 告警 | ⚠️ 未对接 |
| Pipeline | 构建后合规检查 | ⚠️ 未自动化 |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端合规仪表板 | 合规状态不可视 | 开发合规可视化页面 |
| 漏洞修复工作流不完整 | 漏洞发现后无法自动修复 | 完善 remediateVulnerability |
| 证据收集不自动 | 需手动收集合规证据 | 实现自动证据采集器 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无自动修复 | 差距分析仅报告不修复 | 实现自动修复 Playbook |
| npm audit 仅限 npm | 不支持 yarn/pnpm | 多包管理器支持 |
| 无合规报告导出 | 报告无法导出 PDF/Excel | 增加导出功能 |
| 无 SLA 监控 | 合规 SLA 不追踪 | 与 SLA 模块联动 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 差距分析为静态 | 无法追踪差距修复进度 | 增加差距修复任务 |
| 无合规培训 | 用户不熟悉合规要求 | 增加合规培训模块 |
| 证据链不完整 | 证据来源追踪不完善 | 增强证据链验证 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| npm audit 阻塞 | exec 调用可能超时 | 中 | 异步队列 + 超时处理 |
| 证据存储分散 | 文件 + PostgreSQL 混合 | 中 | 统一 PostgreSQL 存储 |
| 修复工作流 | remediateVulnerability 实现不完整 | 中 | 完善修复 Playbook |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/compliance/ComplianceService.ts` | 合规核心服务 | ⭐⭐⭐ |
| `services/compliance/ComplianceEvidenceService.ts` | 证据收集 | ⭐⭐⭐ |
| `services/compliance/ComplianceFrameworkService.ts` | 框架管理 | ⭐⭐⭐ |
| `services/compliance/ComplianceRepository.ts` | 合规数据访问 | ⭐⭐⭐ |
| `repositories/ComplianceEvidenceRepository.ts` | 证据数据访问 | ⭐⭐⭐ |
| `repositories/Phase3Repository.ts` | 合规 Repository 基类 | ⭐⭐⭐ |
| `services/vulnerability/VulnerabilityService.ts` | 漏洞扫描核心 | ⭐⭐⭐ |
| `repositories/VulnerabilityRepository.ts` | 漏洞数据访问 | ⭐⭐⭐ |
| `api/security-compliance-routes.ts` | 安全合规路由 | ⭐⭐⭐ |
| `api/controllers/SecurityComplianceController.ts` | 安全合规控制器 | ⭐⭐⭐ |

---

## 结论

**Compliance & Vulnerability 模块**的合规生命周期管理（框架→策略→证据→评估→差距→报告）完整，漏洞扫描也已集成 npm audit。

**当前最大缺口**：
1. 无前端可视化页面
2. 自动修复工作流不完整
3. 证据收集需手动触发

建议优先开发前端仪表板，然后完善自动修复 Playbook。
