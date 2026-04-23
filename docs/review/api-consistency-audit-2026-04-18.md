# Orion Platform - API Consistency Audit Report

**Date**: 2026-04-18
**Auditor**: Automated API Audit (Agent 4 of 8)
**Scope**: Backend route definitions vs frontend API client calls, error codes, pagination

---

## Executive Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Backend Endpoints | ~320 | |
| Frontend API Calls | ~220 | |
| Matched Endpoints | ~107 | 49% |
| Frontend Calls with No Backend | 39+ | |
| Backend Endpoints with No Frontend | 50+ | |
| Error Code Inconsistencies | 8+ formats | |
| **Overall API Consistency** | **~49%** | **Significant path mismatches** |

### Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 5 | Path prefix mismatches causing 404s |
| P1 (High) | 7 | Orphaned modules, wrong HTTP methods |
| P2 (Medium) | 5 | Pagination inconsistencies, error format variance |

---

## P0: Critical Path Mismatches (Frontend will 404)

### P0-1: `plugins.ts` -- Missing `/v1/` Prefix
Frontend calls: `/plugins/list`
Backend expects: `/api/v1/plugins/list`
**Fix**: Add `/v1/` prefix to frontend API base URL

### P0-2: `ticketing.ts` -- Wrong Prefix
Frontend calls: `/ticketing/tickets`
Backend expects: `/api/v1/tickets/tickets` (double segment from prefix registration)
**Fix**: Change frontend to `/tickets/tickets`

### P0-3: `alerts.ts` -- Plural vs Singular
Frontend calls: `/v1/alerts/*`
Backend expects: `/api/v1/alert/*`
**Fix**: Change frontend to `/alert/*`

### P0-4: `code-mgmt.ts` -- Wrong Paths
Frontend calls: `/v1/code-repo/:adapterId/repos`, `/v1/code-repo/:adapterId/pulls`
Backend expects: `/api/v1/code-repo/:adapterId/repositories`, `/api/v1/code-repo/:adapterId/pull-requests`
**Fix**: Update frontend paths to match backend naming

### P0-5: `confirmations.ts` -- No Backend at All
Frontend calls: `/v1/confirmations/*`
Backend: No route file exists for confirmations
**Fix**: Implement backend confirmation routes

---

## P1: High Severity Issues

### P1-1: 4 Entirely Orphaned Backend Modules
Backend route files exist with endpoints but have ZERO frontend consumers:
- `routes-cmdb.ts` -- CMDB endpoints unreachable from UI
- `routes-ai-security.ts` -- AI security endpoints unreachable
- `routes-plugin-spi.ts` -- Plugin SPI endpoints unreachable
- `routes-backup.ts` -- Backup endpoints unreachable

### P1-2: `finops.ts` -- Path Namespace Mismatch
Frontend calls: `/v1/finops/cost-summary`
Backend: `/api/v1/cost/*` (different namespace entirely)

### P1-3: `risk.ts` -- Missing Endpoint
Frontend calls: `/v1/risk/assess`
Backend: Only has `/api/v1/risk/assess/deployment` and `/assess/change`

### P1-4: `deployments.ts` -- Legacy Path
Frontend calls: `/v1/deployments` (legacy) and `/v1/deploy/*` (new)
Backend: Only has `/api/v1/deploy/*` -- no `/deployments` route

### P1-5: `sbom.ts` -- Missing Compliance Endpoints
Frontend calls: `/v1/sbom/compliance/*`, `/v1/sbom/provenance`, `/v1/sbom/gate/*`
Backend: None of these endpoints exist

### P1-6: `iac.ts` -- Missing Plan/State Endpoints
Frontend calls: `/v1/iac/workspaces/:id/plans`, `/v1/iac/workspaces/:id/state/versions`
Backend: Not implemented

### P1-7: `skill.ts` -- Missing My-Skills Endpoints
Frontend calls: `/v1/skills/my`, `/v1/skills/my/:id`
Backend: Not implemented

---

## P2: Medium Severity Issues

### P2-1: Pagination Inconsistencies
5+ different pagination conventions across modules:
- Some use `page/size` parameters
- Some use `offset/limit`
- Some return `{ data, total, page, size }`
- Some return `{ items, count }`
- Some return raw arrays

### P2-2: Error Code Inconsistencies
8+ different error response formats:
```json
{ "success": false, "error": "message" }
{ "error": { "code": 400, "message": "..." } }
{ "message": "error text" }
{ "code": "ERR_XXX", "detail": "..." }
// etc.
```

### P2-3: HTTP Method Mismatches
Some endpoints use PUT in frontend but PATCH in backend, and vice versa.

### P2-4: Missing Content-Type Headers
Some API calls don't set `Content-Type: application/json`.

### P2-5: Inconsistent Response Envelope
Some endpoints wrap data in `{ data: ... }`, others return bare objects.

---

## Per-Module Endpoint Matrix

| Backend Route File | Frontend API File | Path Match | Notes |
|---|---|---|---|
| `build-routes.ts` | `build-env.ts` | MISMATCH | Missing `/build` prefix in frontend |
| `config-routes.ts` | `config.ts` | OK | Paths align |
| `cost-routes.ts` | `finops.ts` | MISMATCH | Different namespace trees |
| `risk-routes.ts` | `risk.ts` | PARTIAL | `assess` endpoint missing in backend |
| `finops-v2-routes.ts` | `finops.ts` | MISMATCH | No `/cost-summary` endpoint in backend |
| `ai-review-routes.ts` | `ai-review.ts` | OK | |
| `diagnostic-routes.ts` | `diagnostic.ts` | OK | |
| `deploy-routes.ts` | `deployments.ts` | PARTIAL | Legacy `/deployments` has no backend |
| `monitoring-routes.ts` | `monitoring.ts` | OK | |
| `ticketing-routes.ts` | `ticketing.ts` | MISMATCH | `/ticketing/` vs `/tickets/` |
| `self-healing-routes.ts` | `self-healing.ts` | OK | |
| `ai-gateway-routes.ts` | `ai-gateway.ts` | OK | |
| `alert-routes.ts` | `alerts.ts` | MISMATCH | `/alerts/` vs `/alert/` |
| `audit-routes.ts` | `audit.ts` | PARTIAL | Frontend calls non-existent verify/chain endpoints |
| `tenant-routes.ts` | `tenant.ts` | PARTIAL | `/stats` missing in backend |
| `efficiency-routes.ts` | `efficiency.ts` | OK | |
| `sbom-routes.ts` | `sbom.ts` | PARTIAL | Compliance/provenance/gate missing |
| `policy-routes.ts` | `policies.ts` | PARTIAL | Test endpoints missing in backend |
| `iac-routes.ts` | `iac.ts` | PARTIAL | Plans/state missing in backend |
| `chatops-routes.ts` | `chatops.ts` | PARTIAL | `/settings` missing in backend |
| `skill-routes.ts` | `skills.ts` | PARTIAL | `/my` endpoints missing |
| `ai-cost-routes.ts` | `ai-cost.ts` | PARTIAL | DELETE budget, `/pricing`, `/roi` missing |
| `code-repo-routes.ts` | `code-mgmt.ts` | MISMATCH | `repos` vs `repositories`, `pulls` vs `pull-requests` |
| `canary-analysis-routes.ts` | `canary-analysis.ts` | PARTIAL | Metrics discover/retrain missing |
| `change-intelligence-routes.ts` | `change-intelligence.ts` | PARTIAL | Blast radius/trends missing |
| `test-selector-routes.ts` | (none) | MISSING | No frontend API client |
| `backup-routes.ts` | (none) | MISSING | No frontend API client |
| `plugin-spi-routes.ts` | (none) | MISSING | No frontend API client |
| `ai-security-routes.ts` | (none) | MISSING | No frontend API client |
