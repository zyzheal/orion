# Pipeline Plugin System - Remaining Gaps Design

> **Date:** 2026-05-08
> **Author:** Design Review
> **Scope:** Remaining gaps in the Pipeline Plugin System after Phase 1 bridge implementation

## Executive Summary

The Pipeline Plugin System has ~60% of its architecture implemented. Phase 1 (Plugin Bridge) connected `PluginExecutorService` into `StageExecutor`. The remaining gaps fall into 5 categories: WASM runtime, AI diagnosis, AI script generation, debug controller, and container image validation. This document provides a phased, testable implementation plan for each gap.

---

## 1. Current Gap Analysis

### 1.1 Gap Inventory

| # | Component | File(s) | Status | Severity |
|---|-----------|---------|--------|----------|
| G1 | WASM Runtime (real execution) | `src/services/inline-script/WasmRuntime.ts` | Stub (always returns simulated success) | P0 |
| G2 | AI Diagnosis Service (real integration) | `src/services/ai/AIDiagnosisService.ts` | Stub (returns hardcoded result) | P1 |
| G3 | AI Script Generation endpoint | `src/api/script-routes.ts:218-225` | Returns 501 Not Implemented | P1 |
| G4 | Debug Controller (pause/resume/step) | `src/api/plugin-routes.ts:144-164` | Returns 501 Not Implemented | P2 |
| G5 | WASM Plugin execution (real) | `src/services/plugin-executor-service.ts:548-558` | Calls `simulateExecution()` | P1 |
| G6 | Container image validation | `src/services/plugin-executor-service.ts:563-666` | Has real Docker spawn but no pre-pull / registry auth | P2 |
| G7 | Plugin SPI Controller | No `PluginSpiController.ts` file | Missing entirely (functionality split across `PluginService` + `PluginManagerService`) | P0 (resolved) |
| G8 | EventBus NATS wiring for plugin events | `src/services/event-bus-service.ts` | Fully implemented with NATS + fallback | **Done** |

### 1.2 Detailed Gap Analysis

#### G1: WASM Runtime (Inline Script Safe/Standard Levels)

**What it does:** Executes JavaScript/TypeScript code in a sandboxed WASM environment for "safe" and "standard" level inline scripts. This is the security boundary that prevents user code from accessing Node.js APIs (`fs`, `net`, `child_process`).

**Current state:** `WasmRuntime.execute()` returns `{ success: true, stdout: "WASM executed: ..." }` regardless of input. No actual WASM execution occurs.

**Impact:** Safe/standard inline scripts appear to succeed but execute no real code. Advanced scripts (which use Docker) work, but safe scripts (the most common use case for pipeline transformations) are completely non-functional.

#### G2: AI Diagnosis Service

**What it does:** When a plugin execution fails, the AI diagnosis service analyzes the error message, stack trace, recent logs, and historical incidents to suggest root causes and fixes.

**Current state:** `AIDiagnosisService.diagnose()` returns a hardcoded result: `"Check plugin configuration and network connectivity"` with confidence 65. `findSimilarIncidents()` returns an empty array.

**Impact:** The `/ai-diagnose` endpoint works but provides no real value. Users see generic advice.

#### G3: AI Script Generation

**What it does:** Given a natural language prompt (e.g., "scan for open ports and check if nginx is running"), generate a valid inline script in the target language.

**Current state:** The `/ai-generate` endpoint in `script-routes.ts` returns 501 with `{ generated: false, status: 'not_implemented' }`.

**Impact:** The UI feature for AI-assisted script creation is completely non-functional.

#### G4: Debug Controller (pause/resume/step)

**What it does:** During pipeline execution, developers can pause a running run, inspect state, single-step through tasks, and resume. Essential for debugging complex pipeline failures.

**Current state:** Three endpoints (`/debug/pause`, `/debug/resume`, `/debug/step`) all return 501 with log warnings. No state snapshot/restore mechanism exists.

**Impact:** Debugging pipeline failures requires re-running the entire pipeline. No interactive debugging capability.

#### G5: WASM Plugin Execution (HIGH Security Level)

**What it does:** When `PluginExecutorService` encounters a plugin with `securityLevel: 'HIGH'`, it should execute the plugin in an isolated WASM sandbox rather than a host process.

**Current state:** `executeWASMPlugin()` calls `simulateExecution()` which waits 100ms and returns `{ pluginId, runtimeType: 'WASM', stdout: 'WASM plugin executed successfully' }`.

**Impact:** HIGH security plugins (the ones that need the most isolation) get zero isolation. They just appear to succeed.

#### G6: Container Image Validation & Registry Auth

**What it does:** Before executing a MEDIUM security plugin in Docker, the system should validate the container image exists, handle registry authentication, and implement image pull policies (always, ifNotPresent, never).

**Current state:** `executeContainerPlugin()` has real Docker `spawn` implementation with security hardening (image name sanitization, resource limits). However:
- No pre-pull validation (if image doesn't exist locally, `docker create` fails with a cryptic error)
- No registry authentication support
- No image pull policy configuration
- No digest pinning support

**Impact:** Docker execution works for local images but fails confusingly for remote images. No enterprise registry support.

#### G7: Plugin SPI Controller

**What it does:** A unified HTTP API controller for plugin SPI operations (install, enable, disable, execute, health check).

**Current state:** No `PluginSpiController.ts` exists. The functionality is split between:
- `PluginManagerService` (lifecycle: install, activate, deactivate, uninstall)
- `PluginService` (SPI: register, discover, execute, health)
- `plugin-routes.ts` (HTTP endpoints that call `PluginManagerService`)

**Impact:** This is an architectural observation, not a functional gap. The system works, but the controller pattern would make it cleaner. **Design decision: defer.**

---

## 2. Implementation Plan

### Phase 1: WASM Runtime via `quickjs-emscripten` (G1 + G5)

**Goal:** Replace the stub WASM runtime with a real `quickjs-emscripten` execution engine. This solves both G1 (inline scripts) and G5 (HIGH security plugin execution) simultaneously.

**Why quickjs-emscripten over wasmtime:**
- Pure TypeScript/JS, no native binary dependencies
- Well-maintained, used in production at multiple companies
- Provides memory limits, CPU time limits, and can disable host imports
- Can be added via `npm install` without platform-specific builds

**Concrete steps:**

1. **Add dependency:** `npm install quickjs-emscripten`
2. **Rewrite `WasmRuntime.ts`:**
   - Import `getQuickJS()` from `quickjs-emscripten`
   - On first call, initialize the QuickJS VM (lazy init for cold start optimization)
   - On each `execute()`:
     - Create a new VM instance (isolation per execution)
     - Set memory limit via `vm.setMemoryLimit(request.memoryLimit)`
     - Set CPU time limit via `vm.setCPUTimeLimit(request.timeout)`
     - Create a safe context object with only permitted globals
     - Evaluate the code via `vm.evalCode(request.code)`
     - Capture stdout/stderr by intercepting `console.log` in the VM
     - Handle exceptions and convert to `WasmExecutionResult`
     - Dispose the VM instance (prevent memory leaks)
3. **Update `PluginExecutorService.executeWASMPlugin()`:**
   - Instead of `simulateExecution()`, delegate to `WasmRuntime.execute()`
   - Map the plugin's config (code, entry point) to `WasmExecutionRequest`

**Files to modify:**
- `src/services/inline-script/WasmRuntime.ts` (rewrite)
- `src/services/plugin-executor-service.ts` (line 548-558, delegate to WasmRuntime)
- `package.json` (add quickjs-emscripten)

**Dependencies:** None external beyond npm package.

**Test strategy:**
- Unit test: Execute simple JS (`1 + 1`), verify stdout = `"2"`
- Unit test: Execute code with `eval()`, verify QuickJS blocks it (or runs in isolated context)
- Unit test: Execute infinite loop, verify timeout fires
- Unit test: Execute code exceeding memory limit, verify OOM error
- Unit test: Execute code trying `require('fs')`, verify module not found
- Integration test: InlineScriptService `executeSafe` with real code
- Integration test: PluginExecutorService with HIGH security plugin

**Risk:** QuickJS doesn't support the full JS feature set (no async/await in some versions). Mitigation: test the specific syntax patterns our pipeline scripts use; if async is needed, use `quickjs-emscripten`'s async runtime variant.

### Phase 2: AI Diagnosis with Local LLM Fallback (G2)

**Goal:** Make `AIDiagnosisService` call a real AI service, with a rule-based fallback when AI is unavailable.

**Architecture decision: HTTP call to `orion-ai-service`, NOT direct LLM SDK.** The platform already has `orion-ai-service` (Python microservice). The diagnosis service should call it via HTTP, keeping the platform service language-agnostic and allowing the AI service to swap models without platform restarts.

**Concrete steps:**

1. **Add HTTP client** to `AIDiagnosisService`:
   - Use Node.js native `fetch` (available in Node 18+)
   - Call `http://orion-ai-service:8080/api/diagnose` with the diagnosis context

2. **Build the prompt payload:**
   ```json
   {
     "error_message": "...",
     "error_stack": "...",
     "plugin_id": "...",
     "isolation_tier": "...",
     "duration_ms": 1234,
     "recent_logs": ["last 50 log lines..."],
     "historical_incidents": [{"error": "...", "resolution": "..."}]
   }
   ```

3. **Implement historical incident lookup:**
   - Query `plugin_audit_logs` table (via `PluginAuditLogRepository`)
   - Find entries with similar error messages (simple prefix match or Levenshtein distance)
   - Return top 5 matches with their resolutions

4. **Implement rule-based fallback:**
   - If AI service is unreachable or times out, fall back to pattern matching:
     - `"Connection refused"` → network policy issue
     - `"Out of memory"` → resource quota issue
     - `"Permission denied"` → RBAC issue
     - `"image pull failed"` → registry auth issue
   - This ensures the endpoint always returns useful output

5. **Wire `findSimilarIncidents()`:**
   - Implement the SQL query against `plugin_audit_logs`
   - Use `ILIKE` for simple text matching, or vector similarity if `VectorStore` is available

**Files to modify:**
- `src/services/ai/AIDiagnosisService.ts` (rewrite `runDiagnosis` and `findSimilarIncidents`)
- `src/repositories/PluginAuditLogRepository.ts` (add `findByErrorPattern` method if missing)

**Dependencies:**
- `orion-ai-service` must be running and have a `/api/diagnose` endpoint
- `PluginAuditLogRepository` must be configured (database connection)

**Test strategy:**
- Unit test: Mock fetch to simulate AI service returning a diagnosis, verify result parsing
- Unit test: Mock fetch rejection, verify fallback to rule-based diagnosis
- Unit test: `findSimilarIncidents` with mock audit log data
- Integration test: Full diagnose call against running AI service (requires orion-ai-service)

**Risk:** AI service may not exist yet or may have a different API contract. Mitigation: the rule-based fallback ensures the feature works from day one, and AI integration is a progressive enhancement.

### Phase 3: AI Script Generation (G3)

**Goal:** Implement the `/ai-generate` endpoint to generate inline scripts from natural language prompts.

**Architecture decision: Same pattern as Phase 2 -- HTTP call to `orion-ai-service`, not direct LLM.**

**Concrete steps:**

1. **Create `AIGenerateService`** in `src/services/ai/AIGenerateService.ts`:
   - Method: `generateScript(prompt: string, language: string, level: InlineScriptLevel): Promise<{ code: string; warnings: string[] }>`
   - Calls `http://orion-ai-service:8080/api/generate-script` with prompt + context
   - Falls back to template-based generation if AI unavailable

2. **Template-based fallback:**
   - Maintain a library of script templates for common operations:
     - "Check disk space" → `df -h`
     - "Check process" → `ps aux | grep <name>`
     - "Scan port" → `netstat -tlnp`
   - Simple keyword matching on the prompt to select a template
   - This ensures the endpoint works even without AI service

3. **Post-generation security scan:**
   - After generating the script, run it through `InlineScriptService.scanCode()`
   - If the generated code violates the requested level, append warnings
   - Never return code that would fail the security scanner without warning

4. **Wire the endpoint** in `script-routes.ts`:
   - Call `AIGenerateService.generateScript()`
   - Return `{ generated: true, code, language, warnings, requiresApproval }`

**Files to create:**
- `src/services/ai/AIGenerateService.ts` (new)

**Files to modify:**
- `src/api/script-routes.ts:218-225` (replace 501 with real implementation)

**Dependencies:**
- `InlineScriptService.scanCode()` (already implemented)
- `orion-ai-service` (optional, for AI-enhanced generation)

**Test strategy:**
- Unit test: Template fallback generates valid code for known prompts
- Unit test: Generated code passes security scan for "safe" level
- Unit test: Generated code that would violate level gets warnings
- Integration test: Full endpoint call with mock AI service

### Phase 4: Debug Controller (G4)

**Goal:** Implement pause/resume/step debug controls for running pipeline executions.

**Architecture decision: In-process state snapshot + AbortController, not distributed debug protocol.** Since the entire platform runs in one process (per CLAUDE.md), debug state can be held in memory.

**Concrete steps:**

1. **Create `DebugController`** in `src/engine/DebugController.ts`:
   - `pause(runId: string): Promise<DebugState>` - signals the execution to pause at the next task boundary
   - `resume(runId: string): Promise<void>` - signals the execution to continue
   - `step(runId: string): Promise<TaskResult>` - executes the next single task and pauses
   - `getState(runId: string): DebugState` - returns current pipeline state snapshot

2. **Execution engine integration:**
   - `PipelineEngine.execute()` must check `DebugController.shouldPause(runId)` before each task
   - If paused, the engine waits on a Promise that resolves when `resume()` or `step()` is called
   - Use `AbortController` + `Promise` combination for the wait mechanism

3. **State snapshot:**
   - Capture: current stage, current task, all completed task results, pipeline variables
   - Store in `DebugController`'s internal Map keyed by `runId`
   - No persistence needed (debug sessions are ephemeral)

4. **Wire the endpoints** in `plugin-routes.ts`:
   - `/debug/pause` → `DebugController.pause(runId)`
   - `/debug/resume` → `DebugController.resume(runId)`
   - `/debug/step` → `DebugController.step(runId)`

**Files to create:**
- `src/engine/DebugController.ts` (new)

**Files to modify:**
- `src/api/plugin-routes.ts:144-164` (replace 501 with DebugController calls)
- `src/engine/PipelineEngine.ts` (add pause check before each task execution)
- `src/engine/StageExecutor.ts` (add pause check before each task)

**Dependencies:**
- `PipelineEngine` and `StageExecutor` must be modified to be interruptible
- This is the most invasive change in the plan

**Test strategy:**
- Unit test: `DebugController.pause()` followed by `resume()` unblocks execution
- Unit test: `DebugController.step()` executes exactly one task then pauses
- Unit test: Concurrent pause/resume on different runIds doesn't interfere
- Integration test: Run a 3-stage pipeline, pause after stage 1, inspect state, resume, verify completion

**Risk:** Modifying the execution engine for debug support risks introducing regressions. Mitigation: the pause check is a simple `if` statement that returns false in production (no active debug session), adding zero overhead when not in use.

### Phase 5: Container Image Validation & Registry Auth (G6)

**Goal:** Add pre-pull validation, registry authentication, and image pull policy to the container plugin execution path.

**Concrete steps:**

1. **Add image pull validation** before `docker create`:
   - Run `docker inspect <image>` to check if image exists locally
   - If not found and pull policy is "always" or "ifNotPresent", run `docker pull <image>`
   - If pull fails, return a clear error message (not the current cryptic "docker create failed")

2. **Add registry authentication:**
   - Support `DOCKER_REGISTRY_USERNAME` / `DOCKER_REGISTRY_PASSWORD` env vars
   - Before pulling, run `docker login` if credentials are configured
   - After pull, run `docker logout` to clean up

3. **Add image pull policy config:**
   - `PullPolicy` enum: `Always`, `IfNotPresent`, `Never`
   - Default: `IfNotPresent`
   - Configurable via plugin config or environment variable

4. **Add digest pinning support:**
   - If image name contains `@sha256:...`, use it as-is (immutable reference)
   - Log a warning if using `:latest` tag (non-deterministic)

**Files to modify:**
- `src/services/plugin-executor-service.ts` (lines 563-666, `executeContainerPlugin`)
- Add new method: `private async pullImageIfNeeded(image: string, pullPolicy: PullPolicy): Promise<void>`
- Add new method: `private async ensureRegistryAuth(): Promise<void>`

**Dependencies:**
- Docker daemon must be accessible from the host
- Registry credentials via environment variables

**Test strategy:**
- Unit test: `pullImageIfNeeded` with "IfNotPresent" policy and existing image (no pull)
- Unit test: `pullImageIfNeeded` with "Always" policy (always pulls)
- Unit test: `sanitizeDockerImage` rejects malicious image names (already tested, verify still passes)
- Integration test: Execute a container plugin with a public image (`alpine:latest`)

---

## 3. Architecture Decisions

### Decision 1: QuickJS vs Wasmtime for WASM Runtime

| Option | Pros | Cons |
|--------|------|------|
| **quickjs-emscripten** | Pure npm, no native deps, simple integration, good JS compatibility | Doesn't support full ES2022, no async/await in base variant |
| wasmtime | Full WASI support, fast | Requires native binary, platform-specific builds, complex setup |
| Node.js `vm` module | Built-in, no deps | **Not a security boundary** (vm escapes are well-known) |

**Decision:** Use `quickjs-emscripten`. The security boundary requirement eliminates `vm`. Wasmtime's native binary requirement conflicts with the platform's Node.js deployment model. QuickJS provides sufficient JS support for pipeline scripts (synchronous transformations, data processing).

### Decision 2: AI Service Integration Pattern

| Option | Pros | Cons |
|--------|------|------|
| HTTP call to orion-ai-service | Language-agnostic, model-swappable, no new dependencies on platform | Requires AI service to be running |
| Direct OpenAI/Anthropic SDK | Simple, no external service needed | Ties platform to specific provider, requires API keys in platform service |
| Rule-based only | Zero dependencies, always works | Limited intelligence, no LLM reasoning |

**Decision:** HTTP call to orion-ai-service with rule-based fallback. This aligns with the platform's architecture ("make existing tools smarter") and provides graceful degradation.

### Decision 3: Debug Controller Scope

| Option | Pros | Cons |
|--------|------|------|
| In-process state + Promise wait | Simple, no new infrastructure | Only works for single-process deployments |
| Redis-based state store | Works for distributed deployments | Adds Redis dependency, more complex |
| DAP (Debug Adapter Protocol) | Standard protocol, IDE integration | Massive implementation effort |

**Decision:** In-process state + Promise wait. The platform is a monolith (per CLAUDE.md), so distributed debug is not needed. DAP is overkill for pipeline debugging.

### Decision 4: Plugin SPI Controller (G7)

**Decision:** Defer. The existing split between `PluginManagerService` (lifecycle) and `PluginService` (SPI) works correctly. Creating a `PluginSpiController` would be a cosmetic refactor with no functional benefit. If future requirements demand a unified controller pattern, it can be done then.

---

## 4. Dependencies & Implementation Order

```
Phase 1 (WASM Runtime)     ──────────────────────────────────────────────────►
    │
    ├── No dependencies. Can start immediately.
    │
    ▼
Phase 2 (AI Diagnosis)     ──────────────────────────────────────────────────►
    │
    ├── Depends on: PluginAuditLogRepository (exists)
    ├── Optional: orion-ai-service running
    │
    ▼
Phase 3 (AI Script Gen)    ──────────────────────────────────────────────────►
    │
    ├── Depends on: InlineScriptService.scanCode() (exists)
    ├── Depends on: Phase 2 pattern (same AI service integration approach)
    │
    ▼
Phase 4 (Debug Controller) ──────────────────────────────────────────────────►
    │
    ├── Depends on: PipelineEngine modification (moderately invasive)
    ├── Can be done in parallel with Phase 2/3
    │
    ▼
Phase 5 (Container Image)  ──────────────────────────────────────────────────►
    │
    ├── Depends on: Docker daemon accessible
    ├── Can be done in parallel with any other phase
```

**Recommended order:**
1. Phase 1 (WASM) -- highest impact, no dependencies
2. Phase 5 (Container Image) -- quick win, improves existing Docker path
3. Phase 2 (AI Diagnosis) -- moderate complexity, good user value
4. Phase 3 (AI Script Gen) -- builds on Phase 2 pattern
5. Phase 4 (Debug Controller) -- most invasive, do last

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| QuickJS doesn't support required JS syntax | Medium | High | Test all pipeline script patterns upfront; use async variant if needed; fallback to `vm` with security warnings for incompatible scripts |
| orion-ai-service API contract mismatch | Medium | Medium | Rule-based fallback ensures functionality; define expected API contract in a shared types file |
| Debug controller introduces race conditions in PipelineEngine | Medium | High | Use well-tested Promise + AbortController pattern; comprehensive unit tests for concurrent access |
| Docker daemon not available in all environments | High | Low | Container execution already has fallback (simulateExecution); add explicit "Docker not available" error message |
| Memory leaks from WASM VM instances | Low | Medium | Always dispose VM instances in `finally` block; add memory usage monitoring to WasmRuntime |
| Registry credentials exposed in logs | Low | High | Never log credentials; mask `docker login` output; use `--password-stdin` flag |

---

## 6. Test Strategy Summary

### Unit Tests
| Gap | Test Count | Focus |
|-----|-----------|-------|
| G1 WASM Runtime | 6+ | Correct execution, timeout, memory limit, isolation, error handling |
| G2 AI Diagnosis | 4+ | AI call success, AI call failure + fallback, historical lookup, timeout |
| G3 AI Script Gen | 4+ | AI generation success, template fallback, security scan integration, warning generation |
| G4 Debug Controller | 5+ | Pause/resume, step execution, concurrent sessions, state snapshot |
| G5 WASM Plugin Exec | 3+ | Delegation to WasmRuntime, result mapping, error propagation |
| G6 Container Image | 4+ | Pull policy, registry auth, digest pinning, pull failure |

### Integration Tests
- End-to-end: Pipeline with safe-level inline script (exercises G1 + Phase 1 bridge)
- End-to-end: Pipeline with HIGH security plugin (exercises G5 + Phase 1 bridge)
- End-to-end: Pipeline failure + AI diagnosis (exercises G2)
- End-to-end: Script generation + scan + execute (exercises G3)

### Regression Tests
- All existing plugin-spi tests must pass
- All existing plugin-executor-service tests must pass
- All existing inline-script tests must pass
- Plugin bridge integration tests from Phase 1 must pass

---

## 7. Out of Scope

The following are explicitly **not** covered by this design:

- **Plugin marketplace/download** -- handled by `plugin-marketplace-routes`
- **Plugin hot reload** -- `PluginHotReloadService.ts` exists but is not wired; separate effort
- **OverlayFS / container isolation** -- Phase 2/3 infrastructure work
- **Artifact storage** -- handled by `artifact-routes`
- **NATS JetStream** -- `event-bus-service.ts` already fully implemented
- **Plugin SPI Controller** -- G7, deferred (functionality exists, just split across services)
- **Multi-process / K8s deployment** -- platform is currently a monolith
