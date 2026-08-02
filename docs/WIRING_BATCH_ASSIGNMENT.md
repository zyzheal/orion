# P0 Wiring 批量分派文档

> 生成: 2026-08-02 | 用途: 供 Agent 读取后直接执行 wiring

## 已完成 (commit 51e1f5fa3)

| Batch | 文件 | 模块 | 状态 |
|-------|------|------|------|
| 0 | wiring-core-domains.go | governance(4)+security(6)+identity(5)+ticket(10) | ✅ 已注册 |
| 1 | wiring-application.go | application | ✅ 已注册 |
| 1 | wiring-escalation.go | escalation | ✅ 已注册 |
| 1 | wiring-pandawiki.go | pandawiki | ✅ 已注册 |
| 1 | wiring-metadata.go | metadata | ✅ 已注册 |
| 2 | wiring-param-types.go | param-types | ✅ 已注册 |
| 2 | wiring-form.go | form | ✅ 已注册 |
| 2 | wiring-mlops.go | mlops | ✅ 已注册 |
| 2 | wiring-sla-engine.go | sla-engine | ✅ 已注册 |
| 2 | wiring-test-selector.go | test-selector | ✅ 已注册 |
| 2 | wiring-test-generation.go | test-generation | ✅ 已注册 |
| 2 | wiring-visor-exec.go | visor-exec | ✅ 已注册 |
| 3 | wiring-alert-adapter.go | alert-adapter | ⚠️ 需修复 repo interface 签名 |
| 3 | wiring-alert-deduplication.go | alert-deduplication | ✅ 已注册 |
| 4 | wiring-chaos-gateway.go | chaos-gateway | ⚠️ 需确认 service.NewService(logger) 签名 |
| 4 | wiring-circuit-breaker.go | circuit-breaker | ⚠️ 同上 |
| 4 | wiring-vulnerability.go | vulnerability | ⚠️ 同上 |
| 4 | wiring-cmdb-collector.go | cmdb-collector | ⚠️ 需确认 service 签名 |
| 4 | wiring-cmdb-import.go | cmdb-import | ⚠️ 同上 |
| 4 | wiring-cmdb-relationship.go | cmdb-relationship | ⚠️ 同上 |
| 4 | wiring-cmdb-validator.go | cmdb-validator | ⚠️ 同上 |
| 5 | wiring-import-export.go | import-export | ✅ 已注册 |
| X | wiring-alert-correlation.go | alert-correlation | 🔴 需 pgxpool wiring 前置 |
| X | wiring-alert-silence.go | alert-silence | 🔴 需 pgxpool wiring 前置 |

## 待 Agent 完成 (⚠️ 项)

Agent 需要:
1. `grep "^func New" internal/<module>/service/*.go` 确认构造函数参数
2. `grep "^func New" internal/<module>/handler/*.go` 确认 handler 签名
3. 修改对应 wiring 文件
4. 确认 build 通过
5. 在 wiring.go initWiring() 中添加 wire<Module>() 调用
6. 在 router.go setupRouter() 中添加 RegisterRoutes

## wiring-core-domains.go 已注册 routes

governanceH, governanceComplianceH, governanceRiskH, governancePolicyH,
securityH, securitySecretH, securityBranchPolicyH, securityPrivacyH, securityUebaH, securityCrossDomainH,
identityApikeyH, identityConfirmationH, identitySessionH, identitySsoH, identityTenantH,
analyticsTicketH, automationRuleTicketH, slaPolicyTicketH, ticketSourceTicketH
