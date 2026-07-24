# Privacy 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/privacy/` + `src/api/privacy-routes.ts`  
**模块标签**: 隐私合规, PII 脱敏, 密钥检测, NER, 租户策略

---

## 一、现状概述

### 模块定位

Privacy 模块提供租户级别的隐私合规能力，包括 PII（个人身份信息）检测与脱敏、密钥/凭证检测与脱敏、基于 transformers.js 的 NER 模型推理，以及可配置的隐私策略管理。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/privacy/TenantPrivacyPolicyService.ts` | ~200 | 租户隐私策略 CRUD，4 级预设（standard/enhanced/strict/custom） |
| `services/privacy/PIISanitizer.ts` | ~180 | PII 正则检测（email/phone/id_card/address）+ NER 增强 |
| `services/privacy/SecretSanitizer.ts` | ~150 | 密钥检测（API Key/JWT/Password/Private Key/DB URL） |
| `services/privacy/NERModelService.ts` | ~150 | transformers.js NER 模型加载与推理，自动降级到 regex |
| `services/privacy/index.ts` | - | barrel 导出 |
| `api/privacy-routes.ts` | ~200 | 路由注册 |

### 核心数据模型

- **TenantPrivacyPolicy**: policyLevel, secretSanitizationEnabled, piiSanitizationEnabled, nerModelType, sensitiveDataTypes[], piiTypes[], customPatterns[]
- **DetectedPII/DetectedSecret**: type, value, start, end, confidence, source (regex/ner)
- **PIISanitizationResult/SanitizationResult**: original, sanitized, detected[], processingTimeMs
- **NEREntity**: type (name/organization/location/date/email/phone/id_card), confidence
- **ComplianceResult**: compliant, violations[], policyLevel, actualModel

### 持久化方式

✅ `TenantPrivacyPolicyRepository`（PostgreSQL）用于存储租户策略。
NER 模型（transformers.js）动态加载，不持久化。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 租户隐私策略管理 | ✅ | 4 级预设（standard/enhanced/strict/custom），含内存缓存 |
| 策略持久化 | ✅ | PostgreSQL Repository |
| PII 正则检测 | ✅ | 5 种模式：email/phone/id_card/address，中英文支持 |
| PII NER 增强 | ✅ | transformers.js BERT 模型，无模型时静默降级到 regex |
| 密钥检测 | ✅ | 11 种模式：OpenAI/AWS/JWT/Bearer/GitHub/PrivateKey/DB URL |
| 脱敏替换 | ✅ | 每类敏感数据有对应占位符 |
| 保存策略 -> 预设应用 | ✅ | 选择 preset 自动填充字段 |
| 静默降级 | ✅ | NER 模型不可用时自动用 regex 回退 |

---

## 三、API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/privacy/policies/:tenantId` | 获取租户隐私策略 |
| PUT | `/privacy/policies/:tenantId` | 更新租户隐私策略 |
| POST | `/privacy/sanitize/secret` | 密钥脱敏，内容限制 1MB |
| POST | `/privacy/sanitize/pii` | PII 脱敏，可选 NER 增强 |
| GET | `/privacy/compliance/:tenantId/check` | 合规检查 |

### 路由注册

✅ 所有路由通过 `authenticateUser` 中间件。注意路由中使用全局单例 `policyService`/`secretSanitizer`/`piiSanitizer`。

---

## 四、依赖关系

### 内部依赖

- `PIISanitizer` → `NERModelService`
- `TenantPrivacyPolicyService` → `TenantPrivacyPolicyRepository`
- `privacy-routes.ts` → 3 个 Service

### 外部依赖

- `@xenova/transformers`（可选依赖，NER 模型推理）
- `utils/logger.ts`
- `errors.ts`（`OrionError`, `ValidationError`, `NotFoundError`, `ForbiddenError`）
- 请求体大小限制：1MB

### 测试覆盖

✅ 5 个测试文件:
- `__tests__/TenantPrivacyPolicy.test.ts`
- `__tests__/TenantPrivacyPolicyService.test.ts`
- `__tests__/PIISanitizer.test.ts`
- `__tests__/SecretSanitizer.test.ts`
- `__tests__/NERModelService.test.ts`
- `__tests__/index.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **全局单例模式导致状态共享**：`policyService`/`secretSanitizer`/`piiSanitizer` 为模块级变量，多次路由注册可能冲突 | **P1** | 改为依赖注入或工厂模式 |
| **无结构化日志**：所有方法使用 console.log 风格输出 | **P1** | 集成 logger |
| **路由未传递 database**：`void options.database` 后 `new TenantPrivacyPolicyService()` 无 DB | **P1** | 传递 database 参数 |
| **NER 模型加载耗时**：首次请求触发模型下载（可能几百 MB） | **P1** | 启动时预加载，添加加载进度通知 |
| **PII 正则仅支持中文**：id_card 和 phone 正则主要针对中国格式 | **P2** | 增加国际格式支持（US SSN, EU phone 等） |
| **无脱敏审计日志**：脱敏操作未记录到审计系统 | **P2** | 集成 AuditService 记录脱敏事件 |
| **`@xenova/transformers` 可选依赖**：不可用时静默降级，用户无感知 | **P2** | 增加加载状态检查端点 |

---

## 六、总结

Privacy 模块是 Orion 中**代码质量较高的模块之一**：NER + 正则双引擎检测、清晰的层级结构（策略→检测→脱敏→合规）、完善的测试覆盖、优雅的降级策略（无模型时自动回退 regex）。

**主要问题**：`void options.database` 导致路由未传递数据库（P1），全局单例可能产生状态冲突（P1），NER 模型加载耗时需预加载优化（P1）。修复这些问题后，Privacy 模块已具备实际可用性，特别是密钥检测能力可直接用于 CI/CD 安全扫描。
