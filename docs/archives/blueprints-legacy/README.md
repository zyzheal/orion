# Orion Blueprint Services (Archived)

This directory contains **67 standalone microservice blueprint directories**
that were moved here as part of the TS→Go monolith consolidation (2026-07-16).

## Background

All functionality from these blueprint services has been integrated into
the `orion-platform-svc-go/` monolith (254 modules, 255 registered routes).
These directories are retained for historical reference only.

## DO NOT
- Deploy these services independently
- Reference them for new development
- Modify these codebases

## References
- **Active monolith**: `../orion-platform-svc-go/`
- **ADR-015**: Go Migration Architecture Decisions
- **Legacy TS monolith**: `../legacy/orion-platform-service-ts/`
