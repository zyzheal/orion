# Orion Wiring 包路径索引

> 用途: 禁止编造包路径，查此表确认每个模块的 handler/service/repo 构造函数

## 生成方式

```bash
cd orion-platform-svc-go
for mod in $(ls internal/); do
  h=$(find "internal/$mod" -maxdepth 1 -name "handler" -type d)
  [ -z "$h" ] && continue
  grep -m1 "^func New" "$h"/*.go
done
```

## 已验证的包路径（wiring 使用）

| 模块 | handler 包路径 | repo 包路径 | service 包路径 |
|------|---------------|-------------|---------------|
| governance | governance/governance/handler | governance/governance/repository | governance/governance/service |
| compliance | governance/compliance/handler | governance/compliance/repository | governance/compliance/service |
| risk | governance/risk/handler | governance/risk/repository | governance/risk/service |
| policy | governance/policy/handler | governance/policy/repository | governance/policy/service |
| security | security/security/handler | security/security/repository | security/security/service |
| secret | security/secret/handler | security/secret/repository | security/secret/service |
| branch-policy | security/branch-policy/handler | security/branch-policy/repository | security/branch-policy/service |
| privacy | security/privacy/handler | security/privacy/repository | security/privacy/service |
| ueba | security/ueba/handler | security/ueba/repository | security/ueba/service |
| cross-domain | security/cross-domain/handler | security/cross-domain/repository | security/cross-domain/service |
| api-key | api-key/handler | api-key/repository | api-key/service |
| confirmation | confirmation/handler | confirmation/repository | confirmation/service |
| session | session/handler | session/repository | session/service |
| sso | sso/handler | sso/repository | sso/service |
| tenant | tenant/handler | tenant/repository | tenant/service |
| ticket | ticket/handler | ticket/repository | ticket/service |
| application | application/handler | application/repository | application/service |
| escalation | escalation/handler | escalation/repository | escalation/service |
| pandawiki | pandawiki/handler | pandawiki/repository | pandawiki/service |
| metadata | metadata/handler | metadata/repository | metadata/service |
| param-types | param-types/handler | param-types/repository | param-types/service |
| form | form/handler | form/repository | form/service |
| mlops | mlops/handler | mlops/repository | mlops/service |
| sla-engine | sla-engine/handler | sla-engine/repository | sla-engine/service |
| test-selector | test-selector/handler | test-selector/repository | test-selector/service |
| test-generation | test-generation/handler | test-generation/repository | test-generation/service |
| visor-exec | visor-exec/handler | visor-exec/repository | visor-exec/service |
| import-export | import-export/handler | import-export/repository | import-export/service |
| alert-adapter | alert-adapter/handler | alert-adapter/repository | alert-adapter/service |
| alert-deduplication | alert-deduplication/handler | — | alert-deduplication/service |
| chaos-gateway | chaos-gateway/handler | — | chaos-gateway/service |
| circuit-breaker | circuit-breaker/handler | — | circuit-breaker/service |
| vulnerability | vulnerability/handler | — | vulnerability/service |
| cmdb-collector | cmdb-collector/handler | cmdb-collector/repository | cmdb-collector/service |
| cmdb-import | cmdb-import/handler | cmdb-import/repository | cmdb-import/service |
| cmdb-relationship | cmdb-relationship/handler | cmdb-relationship/repository | cmdb-relationship/service |
| cmdb-validator | cmdb-validator/handler | cmdb-validator/repository | cmdb-validator/service |
