# 安全/SBOM/供应链/合规模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/security/`、`compliance/`、`sbom/`

---

## 模块概览

Orion 平台的安全模块实现了完整的供应链安全、SBOM 管理、合规评估和安全扫描能力。包含 SecurityScanner（集成 Trivy/Gitleaks/Semgrep）、SbomDocumentService、SbomVulnerabilityService、ComplianceFrameworkService、SupplyChainService 等核心服务。全部采用 PostgreSQL Repository 持久化。

### 核心文件

| 文件 | 职责 |
|------|------|
| `SecurityScannerService.ts` | 安全扫描（Secret/SAST/依赖扫描） |
| `SbomDocumentService.ts` | SBOM 文档管理（CRUD + 漏洞 + 豁免） |
| `SbomVulnerabilityService.ts` | SBOM 漏洞扫描与评分 |
| `SbomWaiverService.ts` | 漏洞豁免管理 |
| `ComplianceFrameworkService.ts` | 合规框架评估（SOC2/ISO27001/GDPR/HIPAA/PCI-DSS/NIST-CSF） |
| `ComplianceService.ts` | 合规报告与计划管理 |
| `SupplyChainService.ts` | 供应链安全（SBOM/签名/依赖图/投毒检测） |
| `BuildAttestationService.ts` | 构建证明与签名 |

### 关键发现

**risk 模块状态**：`/Users/heal/orion-design/orion-platform-service/src/services/risk/` 目录**不存在**。风险相关功能分散在 security/ 和 sbom/ 目录中。

---

## 架构设计

### 分层架构

```
API Layer (routes/ + controllers/)
    ↓
Service Layer (security/, compliance/, sbom/)
    ↓
Repository Layer (repositories/*Repository.ts)
    ↓
PostgreSQL (supply_chain_sboms, artifact_signatures, sbom_documents, compliance_reports, etc.)
```

### 双实现问题

发现 **3 组功能重叠的实现**：

| 功能域 | 实现 A | 实现 B | 问题 |
|--------|--------|--------|------|
| SBOM 生成 | `SBOMGeneratorService` | `SecurityScanner.generateSBOM` | 重复能力 |
| SBOM 文档管理 | `SbomDocumentService` | `SbomRepository` + `SbomService` | 职责不清 |
| 合规管理 | `ComplianceService` (compliance/) | `ComplianceFrameworkService` (security/) | 命名混淆 |

---

## 功能完整性评估

### SecurityScanner 真实扫描能力

**状态：✅ 真实 CLI 集成 + 降级策略**

```typescript
// Secret 扫描：调用 gitleaks CLI
async scanForSecrets(options: ScanOptions): Promise<SecurityFinding[]> {
  const hasGitleaks = await this.checkToolAvailability('gitleaks');
  if (hasGitleaks && options.commitHash) {
    const gitleaksResults = await this.runGitleaks(options);
    findings.push(...gitleaksResults);
  }
}

// SAST 扫描：调用 semgrep CLI
async scanForVulnerabilities(options: ScanOptions): Promise<SecurityFinding[]> {
  const hasSemgrep = await this.checkToolAvailability('semgrep');
  if (hasSemgrep) {
    const semgrepResults = await this.runSemgrep(options);
    findings.push(...semgrepResults);
  }
}

// 依赖扫描：调用 trivy CLI
private async runTrivy(options: ScanOptions): Promise<SecurityFinding[]> {
  const stdout = await this.safeExec('trivy', [...], { timeout: 300000 });
  // 解析真实 Trivy JSON 输出
}
```

**安全特性**：
- ✅ 路径遍历防护（`validatePath` 方法）
- ✅ 命令注入防护（`safeExec` 使用 `shell: false`）
- ✅ 超时控制（300s）
- ✅ 工具名白名单验证（`/^[a-zA-Z0-9\-]+$/`）

### SBOM 服务真实实现状态

| 服务 | 持久化 | 漏洞扫描 | 网关检查 | 豁免管理 | 状态 |
|------|--------|---------|---------|---------|------|
| `SBOMGeneratorService` | ✅ | ⚠️ 模拟 | ❌ | ❌ | P2 |
| `SbomDocumentService` | ✅ | ✅ | ❌ | ❌ | 完整 |
| `SbomVulnerabilityService` | ✅ | ✅ | ✅ | N/A | 完整 |
| `SbomWaiverService` | ✅ | N/A | N/A | ✅ | 完整 |

### SupplyChainService 能力

**状态：⚠️ 功能完整但部分为模拟**

- ✅ SBOM 生成与持久化
- ✅ 依赖链分析
- ✅ 制品签名与验证
- ✅ 依赖投毒检测（Levenshtein 距离 + 9 个已知恶意包样本）
- ⚠️ 依赖解析为模拟数据

### ComplianceFrameworkService 规则评估

**状态：⚠️ 模拟实现**

```typescript
// 规则检查全部为硬编码模拟
private async evaluateRule(tenantId: string, rule: any): Promise<...> {
  switch (ruleType) {
    case 'encryption':
      return this.checkEncryptionRule(rule); // 硬编码返回 { passed: true }
    case 'access_control':
      return this.checkAccessControlRule(rule); // 硬编码返回 { passed: true }
  }
}
```

评估框架完整，支持 6 种合规框架，但规则检查逻辑不查询实际基础设施。

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| ComplianceFrameworkService 规则检查全部为硬编码 | 合规评估结果不真实 | 接入实际基础设施状态查询 |
| SbomVulnerabilityService 仅匹配 2 个模拟 CVE | 漏洞扫描无实际价值 | 集成 NVD API 或 OSV.dev |
| SecurityScannerService 降级时返回空 findings | 无 Trivy/Gitleaks 时扫描失效 | 返回明确错误或提供模拟数据模式 |
| SupplyChainService 依赖解析为模拟数据 | 依赖图分析不准确 | 接入真实依赖解析 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| risk 模块不存在 | 无统一风险视图 | 新建 `services/risk/` 聚合风险 |
| supply-chain 目录不存在 | 供应链功能散落 | 将 SupplyChainService 从 security/ 独立 |
| 双 SBOM 实现混乱 | 维护成本高 | 统一为 SbomDocumentService + SBOMGeneratorService |
| ComplianceService vs ComplianceFrameworkService 职责不清 | API 路径混淆 | 明确分工 |
| 无实时漏洞数据库集成 | 漏洞数据过时 | 集成 NVD API 或 OSV.dev |
| 缺少租户级权限校验 | 数据隔离风险 | SupplyChainService 部分查询缺少 tenant_id |

### P2 级（技术债务）

| 问题 | 位置 | 建议 |
|------|------|------|
| SbomDocumentService Mock fallback 返回空对象 | `SbomDocumentService.ts:84-99` | 抛出明确错误 |
| SecurityScanner 使用 exec 而非 spawn | `SecurityScanner.ts:14` | 统一使用 spawn |
| 缺少 SbomPackageRepository 独立导出 | `SbomDocumentRepository.ts` | 补充 barrel export |
| evaluateRule 缺少结构化日志 | `ComplianceFrameworkService.ts:319` | 添加 logger |
| BuildAttestationService 签名算法简化 | 第413-416行 | 使用真实私钥签名 |

---

## 技术债务

| 类别 | 数量 | 严重程度 |
|------|------|----------|
| 硬编码模拟 | 4 | P0 |
| 模块缺失 | 1 | P1 |
| 职责不清 | 2 | P1 |
| 安全问题 | 2 | P2 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| Pipeline | pipelineId 关联 SBOM 和签名 | ✅ 数据库外键 |
| Artifact | artifactId 签名关联 | ✅ 数据库外键 |
| Tenant | getCurrentTenantId() | ✅ 多租户隔离 |
| Auth Middleware | authenticateUser + requirePermission | ✅ 全部 API 受保护 |
| Privacy | SecretSanitizer 导出 | ✅ 密钥脱敏 |
| Notification | 无漏洞/合规告警通知 | ❌ 未实现 |
| Approval | 无合规豁免审批流程 | ❌ 未实现 |
| Audit Log | 无操作审计日志 | ❌ 未实现 |

---

## 建议优先级

### Phase 1：立即修复（P0）

1. 实现真实合规规则引擎（替换硬编码）
2. 集成真实漏洞数据库（NVD/OSV）
3. 修复 SecurityScanner 降级策略

### Phase 2：短期优化（P1）

4. 创建 risk 模块
5. 统一 SBOM 实现
6. 添加实时通知集成

### Phase 3：长期改进（P2）

7. 统一错误处理
8. 补充结构化日志
9. 性能优化（异步队列 + 缓存）

---

## 关键文件索引

| 文件 | 角色 | 重要性 |
|------|------|--------|
| `services/security/SecurityScannerService.ts` | 安全扫描 | ⭐⭐⭐ |
| `services/security/SupplyChainService.ts` | 供应链安全 | ⭐⭐⭐ |
| `services/security/ComplianceFrameworkService.ts` | 合规评估 | ⭐⭐⭐ |
| `services/sbom/SbomDocumentService.ts` | SBOM 管理 | ⭐⭐⭐ |
| `services/sbom/SbomVulnerabilityService.ts` | 漏洞扫描 | ⭐⭐⭐ |
| `services/compliance/ComplianceService.ts` | 合规报告 | ⭐⭐ |

---

## 结论

Orion 平台安全/SBOM/供应链/合规模块**架构完整、已全面迁移 PostgreSQL、API 覆盖全面**，但存在 **4 个 P0 级模拟实现**影响生产可信度。核心优势在于：
- ✅ 全部使用 PostgreSQL Repository 模式（无内存 Map）
- ✅ API 层有完整的 ACL 权限控制
- ✅ SecurityScanner 有真实 CLI 集成能力（Trivy/Gitleaks/Semgrep）
- ✅ SBOM 文档管理完整（CRUD + 漏洞 + 豁免）

**最紧迫的 3 项工作**：
1. 替换 ComplianceFrameworkService 的硬编码规则检查为真实基础设施查询
2. 集成 NVD/OSV 真实漏洞数据库替换 Mock 数据
3. 创建 `services/risk/` 模块统一风险视图
