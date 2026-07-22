# Orion Platform Service (TypeScript) — ARCHIVED

**Archived:** 2026-07-16
**Migration Target:** `orion-platform-svc-go/` (Go service)

## Status
This TypeScript monolith has been fully migrated to the Go service.
All functionality (254 modules, 255 registered routes) is now served by:

- `orion-platform-svc-go/cmd/server/` — Main API server
- `orion-platform-svc-go/cmd/pipeline-engine/` — Pipeline execution engine (port 8081)

## Retained For
- Historical reference
- Debugging legacy issues
- Gradual cutover fallback (if needed)

## DO NOT
- Modify this codebase for new features
- Run this service in production
- Reference this for new development

## References
- ADR-015: Go Migration Architecture Decisions
- Go Service: `../orion-platform-svc-go/`
