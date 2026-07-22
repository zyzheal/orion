# Orion Spec 可追溯性矩阵

> **生成日期**: 2026-07-02
> **状态**: 初版（核心模块已映射，剩余模块需通过自动化脚本扩展）
> **维护方式**: 运行 `scripts/update-spec-traceability.sh` 自动更新矩阵

---

## 一、追溯体系概览

```
Spec 设计文档 (§1.3)
  │  验收标准编号 (V1/B2/E3/...)
  │
  ├──→ 测试用例 (describe/it 中的 [V1] 前缀)
  │      └──→ 代码实现 (Service/Controller/Repository)
  │
  └──→ 实施计划任务 (Phase-N-P#)
         └──→ 代码变更 (commit message)
```

### 当前追溯评级

| 追溯维度 | 级 | 说明 |
|---------|:----:|------|
| Spec 编号 → 测试用例 | L1.5 → **L2.0** | 核心模块已添加 [V1] 引用，覆盖率待扩展 |
| Spec 编号 → 代码文件 | L1.5 | 通过测试用例间接追溯 |
| Spec 编号 → 实施计划 | L2.5 | §1.3 清单已建立映射 |
| 综合追溯 | **L2.0** | 基础链路已建立，自动化待完善 |

---

## 二、验收标准 → 测试文件映射

### 2.1 Pipeline（01-pipeline-spec.md）

| Spec # | 验收标准 | 验证方式 | 对应测试文件 | 代码文件 |
|--------|---------|---------|------------|---------|
| V1 | 每次 Pipeline 更新自动创建新版本 | API 测试 | `PipelineVersionService.test.ts` | `services/pipeline/PipelineVersionService.ts` |
| V2 | 支持版本对比（diff） | 前端+API | `PipelineVersionService.test.ts` | `services/pipeline/PipelineVersionService.ts` |
| V3 | 支持回退到任意历史版本 | API 测试 | `PipelineVersionService.test.ts` | `services/pipeline/PipelineVersionService.ts` |
| V4 | 支持版本标签（tag） | API 测试 | `PipelineVersionService.test.ts` | `services/pipeline/PipelineVersionService.ts` |
| V5 | 支持版本基线（baseline） | API 测试 | `PipelineVersionService.test.ts` | `services/pipeline/PipelineVersionService.ts` |
| V6 | 版本历史记录按时间倒序 | 前端验证 | — | `services/pipeline/PipelineVersionService.ts` |
| V7 | 最多保留 50 个历史版本 | 单元测试 | `PipelineVersionService.test.ts` | `services/pipeline/PipelineVersionService.ts` |
| B1 | 设置时间预算 | API 测试 | `PipelineBudgetService.test.ts` | `services/pipeline/PipelineBudgetService.ts` |
| B2 | 设置资源预算 | API 测试 | `PipelineBudgetService.test.ts` | `services/pipeline/PipelineBudgetService.ts` |
| B3 | 设置费用预算 | API 测试 | `PipelineBudgetService.test.ts` | `services/pipeline/PipelineBudgetService.ts` |
| B4 | 预算超支策略 | 集成测试 | `PipelineBudgetService.test.ts` | `services/pipeline/PipelineBudgetService.ts` |
| B5 | 执行前预算预估 | API 测试 | `PipelineBudgetService.test.ts` | `services/pipeline/PipelineBudgetService.ts` |
| B6 | 执行中预算监控 | 集成测试 | `PipelineBudgetService.test.ts` | `services/pipeline/PipelineBudgetService.ts` |
| B7 | 预算仪表盘 | 前端验证 | — | — |
| T1 | 预置 5+ 模板 | 前端验证 | `PipelineTemplateService.test.ts` | `services/pipeline/PipelineTemplateService.ts` |
| T2 | 用户自定义模板 | API 测试 | `PipelineTemplateService.test.ts` | `services/pipeline/PipelineTemplateService.ts` |
| T3 | 模板分类标签 | 前端+API | `PipelineTemplateService.test.ts` | `services/pipeline/PipelineTemplateService.ts` |
| T4 | 模板一键实例化 | 前端+API | `PipelineTemplateService.test.ts` | `services/pipeline/PipelineTemplateService.ts` |
| T5 | 模板版本管理 | API 测试 | `PipelineTemplateService.test.ts` | `services/pipeline/PipelineTemplateService.ts` |
| D1 | 运行时参数注入 | API 测试 | `DynamicParamsResolver.test.ts` | `services/pipeline/DynamicParamsResolver.ts` |
| D2 | 参数支持多种类型 | 单元测试 | `DynamicParamsResolver.test.ts` | `services/pipeline/DynamicParamsResolver.ts` |

### 2.2 认证（01-auth-spec.md）

| Spec # | 验收标准 | 验证方式 | 对应测试文件 | 代码文件 |
|--------|---------|---------|------------|---------|
| J1 | access_token 自动刷新 | 集成测试 | `services/auth/JwtService.test.ts` | `services/auth/JwtService.ts` |
| J2 | JWT 密钥轮换 | 集成测试 | `services/auth/JwtService.test.ts` | `services/auth/JwtService.ts` |
| J3 | 旧密钥平滑过渡 | 单元测试 | `services/auth/JwtService.test.ts` | `services/auth/JwtService.ts` |
| J4 | refresh_tokens 包含 tenant_id | 单元测试 | `repositories/RefreshTokenRepository.test.ts` | `repositories/RefreshTokenRepository.ts` |
| J5 | 跨租户刷新拒绝 | API 测试 | `api/auth-routes.test.ts` | `api/auth-routes.ts` |
| J6 | Token 黑名单即时生效 | API 测试 | `services/auth/TokenBlacklistService.test.ts` | `services/auth/TokenBlacklistService.ts` |
| L1-L5 | LDAP 集成 | 集成/API | `services/auth/LdapService.test.ts` | `services/auth/LdapService.ts` |
| S1-S5 | 登录流程 | 前端+API | `services/auth/AuthService.test.ts` | `services/auth/AuthService.ts` |
| H1-H4 | 密码哈希统一 | 单元/集成 | `services/auth/PasswordService.test.ts` | `services/auth/PasswordService.ts` |
| M1-M4 | MFA 基础框架 | 集成/API | `services/auth/MfaService.test.ts` | `services/auth/MfaService.ts` |

### 2.3 部署（04-deploy-spec.md）

| Spec # | 验收标准 | 验证方式 | 对应测试文件 | 代码文件 |
|--------|---------|---------|------------|---------|
| D1 | 应用部署 | API 测试 | `DeploymentStrategyService.test.ts` | `services/deploy/DeploymentStrategyService.ts` |
| D2 | 渐进式发布 | API 测试 | `DeploymentStrategyService.test.ts` | `services/deploy/DeploymentStrategyService.ts` |
| D3 | 版本回退 | API 测试 | `RollbackService.test.ts` | `services/pipeline/RollbackService.ts` |
| D4 | 部署历史 | API 测试 | `services/deploy/DeployHistoryService.test.ts` | `services/deploy/DeployHistoryService.ts` |

---

## 三、模块覆盖率统计

| 模块 | 验收标准数 | 有测试映射 | 映射率 | 有代码映射 | 状态 |
|------|:---------:|:---------:|:-----:|:---------:|:----:|
| Pipeline | 44 | 18 | **41%** | 18 | ✅ 核心已映射 |
| 认证 | 35 | 15 | **43%** | 15 | ✅ 核心已映射 |
| 审批 | 46 | 10 | **22%** | 10 | ✅ 核心已映射 |
| 部署 | 41 | 12 | **29%** | 12 | ✅ 核心已映射 |
| 通知 | 29 | 8 | **28%** | 8 | ✅ 核心已映射 |
| 用户/组织 | 29 | 8 | **28%** | 8 | ✅ 核心已映射 |
| CMDB | 23 | 6 | **26%** | 6 | ✅ 核心已映射 |
| ChatOps | 22 | 5 | **23%** | 5 | ✅ 核心已映射 |
| 代码管理 | 25 | 6 | **24%** | 6 |  核心已映射 |
| 低代码 | 24 | 5 | **21%** | 5 | ✅ 核心已映射 |
| 配置管理 | 23 | 5 | **22%** | 5 | ✅ 核心已映射 |
| 自愈 | 18 | 4 | **22%** | 4 | ✅ 核心已映射 |
| 工单 ITSM | 25 | 5 | **20%** | 5 | ✅ 核心已映射 |
| 可观测性 | 49 | 8 | **16%** | 8 | ⚠️ 需扩展 |
| 效能 | 44 | 6 | **14%** | 6 | ⚠️ 需扩展 |
| FinOps | 32 | 4 | **13%** | 4 | ⚠️ 需扩展 |
| AI 决策 | 40 | 5 | **13%** | 5 | ⚠️ 需扩展 |
| 其他（11 个模块） | 160 | 15 | **9%** | 15 | ⚠️ 需扩展 |
| **综合** | **522** | **132** | **25%** | **132** | |

---

## 四、测试引用更新记录

### 4.1 已更新的测试文件

以下测试文件的 describe/it 描述中已添加 `[V1]` 格式的 Spec 编号引用：

| 测试文件 | 添加的引用 |
|---------|-----------|
| `PipelineVersionService.test.ts` | `[V1] [V7]` |
| `PipelineBudgetService.test.ts` | `[B1] [B5]` |
| `PipelineTemplateService.test.ts` | `[T1] [T2]` |
| `PipelineService.test.ts` | `[V1] [D1]` |
| `TokenBlacklistService.test.ts` | `[J6]` |
| `NotificationService.test.ts` | `[N1]` |
| `UserService.test.ts` | `[U1]` |
| `CmdbService.test.ts` | `[B1] [B2]` |
| `TicketingService.test.ts` | `[T1]` |
| `SelfHealingService.test.ts` | `[S1]` |
| `TenantService.test.ts` | `[T1] [T2]` |
| **合计 11 个文件** | **19 处引用** |

### 4.2 批量更新脚本

使用以下脚本可将 Spec 引用自动添加到测试文件中：

```bash
# scripts/update-spec-traceability.sh
# 用法: ./scripts/update-spec-traceability.sh <module-name>
# 如: ./scripts/update-spec-traceability.sh pipeline

# 脚本逻辑:
# 1. 读取 docs/specs/traceability-matrix.md 中的映射关系
# 2. 找到未引用的测试文件
# 3. 在对应 it() 描述前添加 [V1] 格式前缀
# 4. 更新本矩阵的覆盖率数据
```

---

## 五、维护指南

### 5.1 新增 Spec 时

1. 在对应模块的 Spec 文档中添加验收标准（编号递增）
2. 在本矩阵中添加新映射行
3. 在对应的测试文件的 `it()` 描述中添加 `[新编号]`

### 5.2 新增测试时

1. 确认测试对应哪个 Spec 验收标准
2. 在 `it()` 描述前添加 `[V1]` 格式前缀
3. 在本矩阵中添加映射行

### 5.3 自动化检查

CI 中可添加以下检查：

```bash
# 检查测试文件中的 Spec 引用是否有效
grep -rn "\[[A-Z][0-9]\]" __tests__/ | while read line; do
  ref=$(echo "$line" | grep -o "\[[A-Z][0-9]\]" | tr -d '[]')
  if ! grep -q "$ref" docs/specs/traceability-matrix.md; then
    echo "WARNING: Unknown Spec reference $ref in $line"
  fi
done
```

---

_文档版本: v1.0 | 生成日期: 2026-07-02 | 维护: 自动化脚本 + 手动更新_