# Gap Closure Phase 1: Quick Wins Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 4 independent groups of gap analysis findings with no external dependency requirements.

**Architecture:** 4 parallel workstreams, each self-contained, following existing codebase patterns (Fastify routes, PostgreSQL Repository pattern, TypeScript services).

**Tech Stack:** TypeScript, Fastify, PostgreSQL, node-cron (new dependency)

---

## Sub-project A: API Completeness

### Scope
6 missing API endpoints across existing services:

1. **API Key Routes** — Create `api-key-routes.ts` mounting under `/api/v1/api-keys`. Follow existing `role-routes.ts` pattern: DB-available guard, controller wiring, standard CRUD routes. Service already has `ApiKeyService` with `listKeys`/`createKey`/`deleteKey` — just needs routes + controller.

2. **Role Update** — Add `updateRole(id, updates)` to `RoleService`, `update(id, updates)` to `RoleRepository`, and `PUT /:id` route to `role-routes.ts`.

3. **Project Update** — Add `updateProject(id, updates)` to `ProjectService`, `PUT /:id` route to `project-routes.ts`. ProjectRepository already has `update` method.

4. **Session: List User Sessions** — Add `listByUser(userId)` to `SessionService`, `GET /user/:userId` route to `session-routes.ts`.

5. **Session: Refresh Token** — Add `refreshToken(token, extendHours?)` to `SessionService`/`SessionRepository`. `POST /:token/refresh` route. Extends `expiresAt` by default 24h.

### Files to Create/Modify
- Create: `src/api/controllers/ApiKeyController.ts`
- Create: `src/api/api-key-routes.ts`
- Modify: `src/services/role/RoleService.ts` (add `updateRole`)
- Modify: `src/services/role/RoleRepository.ts` (add `update`)
- Modify: `src/api/role-routes.ts` (add `PUT /:id`)
- Modify: `src/services/project/ProjectService.ts` (add `updateProject`)
- Modify: `src/api/project-routes.ts` (add `PUT /:id`)
- Modify: `src/services/session/SessionService.ts` (add `listByUser`, `refreshToken`)
- Modify: `src/services/session/SessionRepository.ts` (add `findByUser`, `refresh`)
- Modify: `src/api/session-routes.ts` (add `GET /user/:userId`, `POST /:token/refresh`)
- Modify: `src/api/routes.ts` (register `api-key-routes`)

---

## Sub-project D: Code Quality Fixes

### Scope
4 code quality issues:

1. **ConfigService Duplicate Methods** — 7 pairs of duplicate methods (`getConfig`/`getConfig2`, etc.). The `*2` versions are newer signatures. Replace all `*` methods with `*2` implementations, then rename `*2` back to `*`. Delete old implementations.

2. **Approval Route Input Validation** — `approval-routes.ts` uses `request.body as any`. Add zod schema validation for create/approve/reject requests.

3. **Artifact Route `(app as any).db`** — `artifact-routes.ts` accesses untyped DB pool. Replace with typed Repository pattern following standard route pattern.

4. **EventBus mockCalls Metric** — EventBus initializes `mockCalls` counter but never increments it. Remove unused metric or wire it up (remove is preferred per YAGNI).

### Files to Modify
- Modify: `src/services/config-mgmt/ConfigService.ts` (deduplicate 7 method pairs)
- Modify: `src/api/approval-routes.ts` (add zod validation)
- Modify: `src/api/artifact-routes.ts` (typed Repository access)
- Modify: `src/services/event-bus-service.ts` (remove mockCalls)

---

## Sub-project F: Data Persistence (Memory → PostgreSQL)

### Scope
Migrate 3 services from in-memory Map to PostgreSQL Repository pattern:

1. **BranchPolicyService** — Replace `const branchPolicies = new Map()` with `BranchPolicyRepository` + PostgreSQL table.

2. **ConfigApprovalService** — Replace `private changeRequests: Map` with repository-backed storage.

3. **CodeOwnershipService** — Replace `const codeOwnersFiles = new Map()` with repository. Should also support parsing CODEOWNERS files from Git repos (but that's a P1, not this scope — just persistence for now).

### Pattern to Follow
Each service gets:
- Repository class in `src/repositories/` extending base repository
- Service constructor accepts optional `db` parameter
- Falls back to in-memory Map when DB unavailable (existing fallback pattern)

### Files to Create/Modify
- Create: `src/repositories/BranchPolicyRepository.ts`
- Create: `src/repositories/ConfigApprovalRepository.ts`
- Create: `src/repositories/CodeOwnershipRepository.ts`
- Modify: `src/services/code-repo/BranchPolicyService.ts`
- Modify: `src/services/config-mgmt/ConfigApprovalService.ts`
- Modify: `src/services/code-repo/CodeOwnershipService.ts`
- Create: SQL migration for 3 new tables

---

## Sub-project C (Partial): Cron + Webhook

### Scope
2 specific mock implementations to make real:

1. **Cron Expression Parser** — Replace `shouldExecuteJob()` that always returns true with real cron parsing using `cron-parser` npm package. Parse schedule strings, compare with current time, determine if job should fire.

2. **Webhook Real HTTP Delivery** — Replace `setTimeout(100)` mock in `WebhookService.trigger()` with actual `fetch()` HTTP POST to webhook URL. Include timeout handling (10s default), proper error capture, retry logic (3 attempts, exponential backoff).

### Files to Modify
- Modify: `src/services/scheduler/CronSchedulerService.ts` (real cron parsing)
- Modify: `src/services/webhook/WebhookService.ts` (real HTTP + retry)
- Modify: `package.json` (add `cron-parser` dependency)

---

## Non-Goals (Not in this phase)
- External integrations (K8s, GitLab, Prometheus, Terraform, OPA, Grype) — Sub-project B
- Test coverage for 17 modules — Sub-project E
- Smart-deploy rollback real traffic — Sub-project C remaining
- Deploy health checks, approval integration, environment auto-create
- Queue retry/priority — Sub-project C remaining
