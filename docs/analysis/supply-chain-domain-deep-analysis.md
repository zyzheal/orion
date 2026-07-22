# 供应链安全（Supply Chain）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/supply-chain/` + `sbom/` + `security/SupplyChainService.ts`

---

## 模块概览

Supply Chain 模块承担**SBOM 生成、依赖分析、许可证合规检查、制品签名验签**四大职责。当前实现已迁移到 PostgreSQL 持久化，核心算法完整但生产级 Registry 对接尚缺失。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| SBOM 生成 | `services/supply-chain/SupplyChainService.ts` | ✅ 完整（SPDX JSON 格式） |
| SBOM 持久化 | `services/sbom/SbomService.ts` + `SbomDocumentService.ts` | ✅ PostgreSQL |
| SBOM Repository | `repositories/SbomRepository.ts` | ✅ PostgreSQL |
| 依赖树分析 | `SupplyChainService.analyzeDependencies()` | ✅ 完整（含环检测） |
| 许可证合规 | `SupplyChainService.checkCompliance()` | ✅ 内置策略 + 自定义策略 |
| 漏洞集成 | `SbomService.getCachedVulnerabilities()` | ✅ 与 VulnerabilityService 联动 |
| 制品签名 | `SupplyChainController.signArtifact()` | ✅ 路由已实现 |
| 制品验签 | `SupplyChainController.verifySignature()` | ✅ 路由已实现 |
| 供应链报告 | `SupplyChainService.generateReport()` | ✅ 完整 |

---

## 架构设计

### 分层结构

```
API Routes (supply-chain-routes.ts, sbom-routes.ts)
    ↓
Controllers (SupplyChainController, SbomController)
    ↓
Service Layer (SupplyChainService, SbomService, SbomDocumentService)
    ↓
Repository Layer (SbomRepository, SbomDocumentRepository)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **SPDX 标准**：SBOM 生成遵循 SPDX-2.3 规范
- **许可证分类**：内置 known licenses 映射表（permissive/copyleft）
- **漏洞集成**：通过 SbomService 调用 VulnerabilityService 进行 CVE 查询
- **合规策略**：支持默认策略 + 自定义策略，可配置 blockedLicenseCategories + maxVulnerabilitySeverity

---

## 功能完整性评估

### SBOM 生成

| 功能 | 状态 | 说明 |
|------|------|------|
| SPDX JSON 格式 | ✅ | 完整实现 SPDX-2.3 |
| CycloneDX 格式 | ❌ | 未实现 |
| 组件列表 | ✅ | name/version/license/purl |
| 依赖关系 | ✅ | 依赖树 + circular detection |
| 许可证信息 | ✅ | 分类 + 是否批准状态 |
| 序列化 | ✅ | serializeSbom() 完整 |

### 依赖分析

| 功能 | 状态 | 说明 |
|------|------|------|
| 依赖树构建 | ✅ | package.json 解析 |
| 循环依赖检测 | ✅ | visiting set 检测 |
| 深度限制 | ✅ | maxDepth 限制 |
| 漏洞路径 | ⚠️ | 结构已支持，实际调用 SbomService |
| 依赖图可视化 | ✅ | getDependencyGraph 端点 |

### 合规检查

| 功能 | 状态 | 说明 |
|------|------|------|
| 许可证合规 | ✅ | blockedLicenseCategories 过滤 |
| 漏洞严重度检查 | ✅ | maxVulnerabilitySeverity 过滤 |
| 合规策略配置 | ✅ | 默认策略 + 自定义策略 |
| 合规报告 | ✅ | violations 列表 + summary |
| 自动修复建议 | ✅ | 每个 violation 有 recommendation |

### 制品签名

| 功能 | 状态 | 说明 |
|------|------|------|
| 签名生成 | ✅ | signArtifact 路由 |
| 签名验证 | ✅ | verifySignature 路由 |
| 签名存储 | ⚠️ | 路由存在，存储细节待确认 |

---

## API 端点清单

### 供应链（`/api/v1/supply-chain`）

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| POST | `/sbom` | supply-chain:write | 生成 SBOM |
| GET | `/sbom/:sbomId` | supply-chain:read | 获取 SBOM |
| GET | `/dependencies/:package/:version/analyze` | supply-chain:read | 分析依赖 |
| POST | `/dependencies/graph` | supply-chain:write | 依赖图 |
| POST | `/artifacts/:id/sign` | supply-chain:write | 签名制品 |
| POST | `/artifacts/:id/verify` | supply-chain:write | 验签 |
| GET | `/reports/:pipelineId` | supply-chain:read | 供应链报告 |

### SBOM（`/api/v1/sbom`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/documents` | 创建 SBOM 文档 |
| GET | `/documents/:id` | 获取 SBOM 详情 |
| GET | `/documents` | SBOM 列表 |
| DELETE | `/documents/:id` | 删除 SBOM |
| GET | `/artifacts/:artifactId/sbom` | 制品的 SBOM |
| POST | `/scan/trigger` | 触发 SBOM 扫描 |

---

## 数据模型

### SupplyChainReport

| 字段 | 类型 | 说明 |
|------|------|------|
| artifactId | string | 制品 ID |
| sbomCount | number | SBOM 数量 |
| componentCount | number | 组件数量 |
| vulnerabilitySummary | object | 漏洞摘要 |
| complianceStatus | string | 合规状态 |
| riskScore | number | 风险分数（0-100） |
| generatedAt | Date | 生成时间 |

### SBOM (SPDX JSON)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | SBOM ID |
| artifactId | string | 关联制品 |
| format | string | spdx/cyclonedx |
| specVersion | string | SPDX-2.3 |
| components | SBOMComponent[] | 组件列表 |
| dependencies | DependencyNode[] | 依赖关系 |
| createdAt | Date | 创建时间 |
| expiresAt | Date | 过期时间 |

### SbomDocument

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 文档 ID |
| tenant_id | string | 租户 ID |
| artifact_id | UUID | 关联制品 |
| sbom_data | JSONB | SBOM JSON 数据 |
| format | string | spdx/cyclonedx |
| scan_status | string | 扫描状态 |
| created_at | timestamp | 创建时间 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Artifact | SBOM 关联制品 | ✅ |
| Vulnerability | 组件漏洞查询 | ✅ |
| Approval | 合规问题审批 | ⚠️ 未对接 |
| Pipeline | 构建后自动生成 SBOM | ⚠️ 未自动化 |
| Signing | 制品签名/验签 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| CycloneDX 格式缺失 | 部分工具链不支持 SPDX | 实现 CycloneDX 序列化 |
| 无 Registry 对接 | 无法自动拉取依赖信息 | 对接 npm/PyPI/Maven Registry |
| 签名存储未完善 | 签名数据持久化不明确 | 增加 SignatureRepository |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无 CI 自动触发 | 需手动触发 SBOM 生成 | Pipeline 集成自动触发 |
| 无漏洞自动修复 | 仅报告不修复 | 增加自动 PR 创建 |
| 许可证映射不完整 | 仅覆盖常见许可证 | 接入 SPDX 完整列表 |
| 无合规仪表板 | 合规状态不可视化 | 前端页面 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 依赖解析为 Mock | 未对接真实 Registry | 对接 npm/PyPI API |
| 无供应链告警 | 合规 violation 不告警 | 与 Alert 模块联动 |
| 无签名吊销 | 签名泄露无法吊销 | 实现 CRL/OCSP |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| Mock 依赖解析 | analyzeDependencies 使用模拟子节点 | 高 | 对接真实 Registry API |
| 签名存储 | signArtifact 结果持久化不明确 | 中 | 增加 SignatureRepository |
| CycloneDX 缺失 | 仅支持 SPDX | 中 | 实现多格式输出 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/supply-chain/SupplyChainService.ts` | 供应链核心逻辑 | ⭐⭐⭐ |
| `services/supply-chain/types.ts` | 类型定义 | ⭐⭐⭐ |
| `services/sbom/SbomService.ts` | SBOM 服务核心 | ⭐⭐⭐ |
| `services/sbom/SbomDocumentService.ts` | SBOM 文档管理 | ⭐⭐⭐ |
| `services/sbom/SBOMGeneratorService.ts` | SBOM 生成器 | ⭐⭐⭐ |
| `repositories/SbomRepository.ts` | SBOM 数据访问 | ⭐⭐⭐ |
| `repositories/SbomDocumentRepository.ts` | 文档数据访问 | ⭐⭐⭐ |
| `api/supply-chain-routes.ts` | 供应链路由 | ⭐⭐⭐ |
| `api/sbom-routes.ts` | SBOM 路由 | ⭐⭐⭐ |
| `api/controllers/SupplyChainController.ts` | 供应链控制器 | ⭐⭐⭐ |

---

## 结论

**Supply Chain 模块**的 SBOM 生成、合规检查、依赖分析核心逻辑完整，已迁移到 PostgreSQL。

**当前最大缺口**：
1. 依赖解析为 Mock 实现，未对接真实 Registry
2. 仅支持 SPDX 格式，缺少 CycloneDX
3. 无 CI 自动触发 + 无前端可视化

建议优先对接真实 Registry API，然后增加 CycloneDX 支持和前端合规仪表板。
