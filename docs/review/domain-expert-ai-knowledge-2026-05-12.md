# Domain Expert Review: AI & Knowledge Services

**Date**: 2026-05-12
**Scope**: intelligence, ai, knowledge, graph, community, finops, efficiency, federation, digital-twin, inception, pandawiki, visor, dba

## P0 Findings (7)
| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| P0-1 | intelligence-svc | All 7 endpoints + all AIService methods are NotImplementedError stubs | AI decision engine non-functional (15% complete) |
| P0-2 | ai-svc | Missing LLMTraceService/CostCalculator imports cause startup crash | Service crashes on import |
| P0-3 | digital-twin-svc | TwinRepository entirely stubbed (17 methods), no sandbox isolation | Digital twin completely non-functional |
| P0-4 | inception-svc | DB credentials embedded in SQL command strings (logged in plaintext) | Password exposure |
| P0-5 | visor-svc | Terminal access and script execution have no authorization/safety checks | Arbitrary host command execution |
| P0-6 | federation-svc | All 3 repositories are in-memory Map stubs | Multi-cloud federation non-functional |
| P0-7 | graph-svc | executeQuery accepts arbitrary Cypher without sanitization | Cypher injection risk |

## P1 Findings (13)
- SSRF vulnerabilities in all proxy services (visor, dba, pandawiki, inception)
- RAG falls back to string matching (no real vector search)
- DORA snapshots are in-memory only
- No content moderation in community-svc
- FinOps reports use hardcoded values
- Knowledge sync not implemented in pandawiki-svc

## P2 Findings (4)
- ai-svc Bearer token auth added but no token refresh mechanism
- intelligence-svc missing model version management
- knowledge-svc content has no XSS sanitization
- finops-svc cost calculation lacks data source fallback
