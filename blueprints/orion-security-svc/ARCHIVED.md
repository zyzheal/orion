# ⚠️ 此服务已归档

此服务已迁移到 Go 版本：`orion-security-svc-go`

## 归档信息

- **归档日期**: 2026-07-24
- **TS 源文件数**: 43
- **Go 替代文件数**: 62
- **覆盖域**: 11 个域完整覆盖

## Go 域映射

| TS 路由 | Go 域 | 状态 |
|---------|-------|------|
| sbom.ts (28 routes) | vulnerability, secret, compliance | ✅ 已覆盖 |
| risk.ts (13 routes) | security, ueba, cross-domain | ✅ 已覆盖 |
| policy.ts (27 routes) | branch-policy, security-compliance | ✅ 已覆盖 |
| quality-gate.ts (5 routes) | security-compliance, compliance | ✅ 已覆盖 |
| supply-chain.ts (7 routes) | cross-domain, privacy | ✅ 已覆盖 |
| security-routes.ts (14 routes) | ai-security, secret | ✅ 已覆盖 |

## 功能对等验证

Go 版已覆盖 TS 版全部功能域，包含：
- SBOM 文档管理、漏洞扫描、豁免管理
- 风险评估、风险事件管理、风险事件确认
- OPA 策略管理、策略评估、质量门禁
- 供应链安全、合规报告 (EO14028/EU-CRA)
- AI 安全 (Prompt 注入检测、威胁监控)
- 密钥管理、UEBA、跨域安全

## 后续

- TS 版已移至 `orion-security-svc.archived/`
- 新功能开发请在 `orion-security-svc-go/` 中进行
