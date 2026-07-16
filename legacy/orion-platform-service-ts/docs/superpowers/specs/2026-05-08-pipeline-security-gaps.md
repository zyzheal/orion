# Pipeline Security Gap Report

**Date**: 2026-05-08
**Scope**: Pipeline execution engine (`src/engine/`, `src/services/plugin*`, `src/services/inline-script/`, `src/services/guardian/`, `src/api/plugin-routes.ts`, `src/api/script-routes.ts`)
**Reviewer Role**: Senior Security Architect

---

## Executive Summary

The pipeline engine has multiple layers of security controls (WASM sandbox, container isolation, DLP detection, approval workflows, input validation). However, several critical gaps exist in the **authorization boundary**, **secrets management**, **workspace isolation**, and **audit completeness**. The most severe issues are:

1. **No tenant/project authorization on pipeline trigger** -- any authenticated user can trigger any pipeline in any tenant.
2. **Secrets passed via environment variables with no masking** in logs.
3. **Shared `/tmp` workspace** -- no per-run isolation for parallel executions.
4. **Docker socket access** -- container plugins run on the host Docker daemon with no namespace isolation.

---

## Finding Details

### SEC-001: No Pipeline-Level Tenant/Project Authorization

- **Severity**: Critical
- **Files**: `src/api/controllers/PipelineRunController.ts:37-155`, `src/api/pipeline-routes-registrar.ts:73-104`, `src/services/pipeline/PipelineService.ts:80-85`
- **Description**: The `trigger()` endpoint at `POST /v1/pipelines/:id/runs` only checks `authenticateUser` (valid JWT). It does **not** verify that the authenticated user's `tenantId` matches the pipeline's `tenant_id`. The `PipelineService.getById()` call at line 80 retrieves a pipeline by ID without any tenant scoping. Any authenticated user can trigger a pipeline in any tenant by guessing the UUID.
- **Impact**: Cross-tenant pipeline execution, data exfiltration, unauthorized deployments.
- **Recommended Fix**:
  1. Add `tenantId` lookup in `PipelineRunController.trigger()` from `(request as any).tenant` (set by TenantMiddleware).
  2. Modify `PipelineService.getById(id, tenantId?)` to include a tenant filter.
  3. Verify the pipeline's `tenant_id` matches the request tenant before execution.
  4. Add `roleGuard(['admin', 'developer', 'viewer'])` with per-action role checks (trigger requires `developer` or above).

### SEC-002: No Authorization Check on Pipeline Cancel

- **Severity**: High
- **File**: `src/api/controllers/PipelineRunController.ts:271-312`
- **Description**: `POST /v1/pipeline-runs/:id/cancel` allows any authenticated user to cancel any pipeline run across all tenants. No tenant ownership or run-level permission check exists.
- **Impact**: Denial of service -- any user can cancel production deployments.
- **Recommended Fix**: Resolve the PipelineRun's owning tenant from the database, verify it matches the request tenant, and enforce role-based cancel permissions.

### SEC-003: Secrets Passed via Environment Variables Without Masking

- **Severity**: Critical
- **Files**: `src/services/plugin-executor-service.ts:1039-1080` (`buildCleanEnvironment`), `src/engine/TaskRunner.ts:205`, `src/services/inline-script/InlineScriptService.ts:267`
- **Description**: Pipeline task parameters can include secrets passed as `env` variables. While `buildCleanEnvironment()` blocks some patterns (`AWS_`, `GCP_`, `SECRET`, `PASSWORD`, `TOKEN`, `KEY`), this is a blocklist approach and misses many secret naming conventions (e.g., `DB_CONNECTION_STRING`, `ENCRYPTION_KEY`, `REGISTRY_TOKEN`). More critically, the `TaskRunner` logs task parameters directly via `appendTaskLog`, and the `PluginAuditLogger` stores input/output snapshots. No systematic secret masking exists.
- **Impact**: Secrets leaked in pipeline logs, audit trails, and debug endpoints.
- **Recommended Fix**:
  1. Implement a dedicated `SecretReference` type (e.g., `{ $secretRef: "vault:path/to/secret" }`) instead of passing raw secret values.
  2. Inject secrets at execution time via a secrets manager integration, never storing them in logs.
  3. Add a `maskSecrets()` utility to all log-append paths, scanning for common secret patterns.
  4. Switch `buildCleanEnvironment` from blocklist to allowlist for env vars.

### SEC-004: Workspace Isolation -- Shared /tmp Directory

- **Severity**: High
- **Files**: `src/engine/TaskRunner.ts:204`, `src/engine/TaskRunner.ts:266`, `src/services/plugin-executor-service.ts:910`
- **Description**: The default workspace root path for both plugin tasks and inline script tasks is `/tmp`. There is no per-run or per-task workspace isolation. Parallel pipeline runs from different tenants share the same `/tmp` directory, enabling data leakage, file overwrite attacks, and symlink attacks between runs.
- **Impact**: Cross-run data contamination, tenant data leakage via shared filesystem.
- **Recommended Fix**:
  1. Generate a unique workspace directory per run: `/tmp/orion-workspaces/{runId}/`.
  2. Create per-task subdirectories within the run workspace.
  3. Clean up workspace directories after run completion.
  4. Consider using `mkdtemp()` for atomic directory creation with restrictive permissions (0o700).

### SEC-005: Docker Daemon Access -- No Container Namespace Isolation

- **Severity**: High
- **Files**: `src/services/plugin-executor-service.ts:744-802` (`executeContainerPlugin`), `src/services/plugin-executor-service.ts:830-859` (`spawnDocker`)
- **Description**: Container plugins execute via `docker create` / `docker start` commands against the host Docker daemon. This means:
  - Plugins that escape their container gain access to the Docker socket and can spawn privileged containers on the host.
  - No Docker user namespace remapping (`--userns-remap`) is configured.
  - No seccomp profiles or AppArmor profiles are applied to plugin containers.
  - Containers use `--network bridge` (shared bridge network), not isolated networks.
  - No `--read-only` filesystem is set on plugin containers.
  - `--cap-drop ALL` is not applied; containers inherit default capabilities.
- **Impact**: Container escape leads to full host compromise.
- **Recommended Fix**:
  1. Add `--cap-drop ALL --cap-add NET_BIND_SERVICE` (minimal capabilities).
  2. Add `--security-opt seccomp=default.json` or custom restrictive seccomp profile.
  3. Add `--read-only` with explicit `--tmpfs /tmp` for writable temp.
  4. Add `--userns-remap` to the Docker daemon configuration.
  5. Create per-plugin Docker networks for network isolation.
  6. Consider running plugins via Docker-in-Docker with userns remapping, or migrate to containerd/gVisor for stronger isolation.

### SEC-006: Inline Script Execution on Plugin Routes -- No Additional AuthZ

- **Severity**: High
- **File**: `src/api/script-routes.ts:121-151` (`POST /execute`)
- **Description**: The script execution endpoint is registered under `/v1/scripts` with only `roleGuard()` (admin-only). The `execute` endpoint directly executes arbitrary code via `InlineScriptService.execute()`. While it has AST scanning and WASM sandboxing for safe/standard levels, the `executeAdvanced` level can execute approved scripts without requiring the user to own the pipeline or tenant.
- **Impact**: An authenticated admin could execute arbitrary scripts in any tenant's context by providing the right `tenantId` from the request.
- **Recommended Fix**:
  1. Verify the `tenantId` in the request matches the authenticated user's tenant.
  2. Require the `pipelineRunId` to exist and belong to the user's tenant.
  3. Rate-limit script execution to prevent abuse.

### SEC-007: Image Supply Chain -- No Signature Verification

- **Severity**: High
- **File**: `src/services/plugin-executor-service.ts:607-638` (`pullImageIfNeeded`)
- **Description**: The `pullImageIfNeeded` method supports digest-pinned images and warns about `:latest` tags, but it does **not** verify image signatures (Cosign/Notary). Any image can be pulled from any registry without signature verification. The `ensureRegistryAuth` method uses env vars for credentials with no rotation policy.
- **Impact**: Malicious image substitution via compromised registry or MITM attack.
- **Recommended Fix**:
  1. Integrate Cosign/Notary signature verification before container creation.
  2. Maintain an allowlist of trusted registries.
  3. Require digest pinning for all plugin container images (enforce `@sha256:` format).
  4. Implement image scanning (Trivy/Grype) before execution.

### SEC-008: Shell Metacharacter Bypass via Array Format

- **Severity**: Medium
- **File**: `src/services/plugin-executor-service.ts:974-1033` (`parseCommand`)
- **Description**: The `parseCommand` method accepts both string and array formats. While string commands are thoroughly checked for shell metacharacters and dangerous patterns, the **array format** (`['ls', '-la', '/tmp']`) bypasses all checks after extracting the first element as the command. An attacker could pass `['bash', '-c', 'malicious payload']` and `bash` is in the default `allowedCommands` list (line 121: `bash` is not there, but `sh` might be indirectly invoked). More critically, `node` is in the allowed list, allowing `['node', '-e', 'require("child_process").exec("...")']`.
- **Impact**: Arbitrary command execution via allowed binaries with script arguments.
- **Recommended Fix**:
  1. Validate array arguments for dangerous executables (`bash`, `sh`, `python`, `node`, `perl`).
  2. Block `-e`, `-c`, `--eval` flags on scripting interpreters in array format.
  3. Add `bash` and `sh` to the allowed commands deny list.

### SEC-009: Process Plugins Run with Same UID/GID as Host Process

- **Severity**: Medium
- **Files**: `src/services/plugin-executor-service.ts:916-925`
- **Description**: Process plugins spawned via `child_process.spawn` run with the same UID/GID as the host Node.js process (`uid: process.getuid()`, `gid: process.getgid()`). This means if a process plugin escapes, it has the same permissions as the platform service.
- **Impact**: Privilege escalation if the platform service runs as root; lateral movement within the host.
- **Recommended Fix**:
  1. Run process plugins under a dedicated unprivileged user (e.g., `orion-plugin`).
  2. Use `setuid`/`setgid` to drop to a dedicated UID/GID.
  3. Apply Linux namespaces (`unshare`) for process isolation.

### SEC-010: Audit Logs Store Sensitive Input/Output Snapshots

- **Severity**: Medium
- **File**: `src/services/plugin/PluginAuditLogger.ts:96-132` (`logExecutionStart`), lines 137-175 (`logExecutionComplete`)
- **Description**: The audit logger stores input and output snapshots for every plugin execution. While DLP sanitization (`sanitizeInput`/`sanitizeOutput`) masks known patterns (credit cards, API keys, passwords, SSNs), it is regex-based and can miss custom secret formats, JWT tokens, OAuth tokens, and base64-encoded secrets.
- **Impact**: Sensitive data persisted in audit logs, accessible via the `/v1/plugins-enhanced/audit` endpoint.
- **Recommended Fix**:
  1. Never store raw input snapshots -- store only metadata (plugin ID, task ID, timestamps, status).
  2. Expand DLP patterns to include JWT tokens (`eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`), base64-encoded payloads, and OAuth tokens.
  3. Add `SECURITY_AUDIT_LOG_MAX_SIZE` configuration to limit stored output size.

### SEC-011: Task Retry Without Authorization Verification

- **Severity**: Medium
- **File**: `src/api/controllers/TaskController.ts:103-163`, `src/api/pipeline-routes-registrar.ts:128-145`
- **Description**: `POST /v1/tasks/:id/retry` only requires authentication (JWT). It does not verify that the user has permission to retry the task, that the task belongs to the user's tenant, or that the task's parent pipeline belongs to the user's tenant.
- **Impact**: Any authenticated user can retry any failed task across all tenants.
- **Recommended Fix**: Traverse the task's stage and run to verify tenant ownership, and check the user's role before allowing retry.

### SEC-012: PipelineRun List/Detail Without Tenant Filtering

- **Severity**: Medium
- **File**: `src/api/controllers/PipelineRunController.ts:161-196` (list), `src/api/controllers/PipelineRunController.ts:202-265` (getById)
- **Description**: The `list()` endpoint accepts `pipelineId` and other filters from the query string but does not scope the query to the authenticated user's tenant. The `getById()` endpoint fetches any run by ID without tenant validation.
- **Impact**: Information disclosure -- users can enumerate pipeline runs and access execution details (including injected parameters, stage configs, task results) across all tenants.
- **Recommended Fix**: Add tenant scoping to all list and detail queries.

### SEC-013: Heartbeat Watchdog Disabled -- Stuck Tasks Not Detected

- **Severity**: Medium
- **File**: `src/services/guardian/ExecutionGuardian.ts:76-87`
- **Description**: The heartbeat watchdog is commented out (TODO) because heartbeats are not wired into the sandbox execution loop. This means stuck or zombie tasks will only be detected by the global timeout (30 minutes by default), not by heartbeat failures.
- **Impact**: Zombie processes consume resources for up to 30 minutes before being killed.
- **Recommended Fix**: Wire the heartbeat mechanism into `PluginSandbox.executeInSandbox()` with periodic `guardian.heartbeat(taskId)` calls during execution.

### SEC-014: Container Plugin Environment Variables Not Sanitized

- **Severity**: Medium
- **File**: `src/services/plugin-executor-service.ts:744-755`
- **Description**: Container plugins do not go through `buildCleanEnvironment()`. The container uses the default Docker environment (inherits host env vars via the Docker daemon). This could leak host environment variables including secrets into the container.
- **Impact**: Secret leakage into container plugin environment.
- **Recommended Fix**: Pass an explicit `--env-file` or `--env` list with only the required variables. Add `--env CLEAR_CONTAINER=true` to ensure no inherited vars.

### SEC-015: Plugin Executor Results Stored in Memory Map -- Potential DoS

- **Severity**: Low
- **File**: `src/services/plugin-executor-service.ts:147`
- **Description**: Execution results are stored in a `Map<string, ...>` with TTL-based eviction (5 minutes). While there is an eviction timer, the map has no maximum size cap. Under sustained load, this could grow unbounded.
- **Impact**: Memory exhaustion under high-throughput pipeline workloads.
- **Recommended Fix**: Add a maximum size limit to the executions Map. When the limit is reached, evict the oldest entries before inserting new ones.

### SEC-016: Debug Endpoints Expose Execution State Without Role Check

- **Severity**: Low
- **File**: `src/api/plugin-routes.ts:146-186`
- **Description**: The debug endpoints (`/v1/plugins-enhanced/:runId/debug/pause`, `/resume`, `/step`, `/state`) are registered under `pluginEnhancedRoutes` which has `roleGuard(['admin', 'platform_admin'])`. While this is role-protected, debug pause/resume could interfere with production pipeline execution. Additionally, the debug state could contain sensitive execution data.
- **Impact**: Potential interference with production pipelines; sensitive data exposure via debug state.
- **Recommended Fix**: Restrict debug endpoints to a dedicated `platform_admin` role only. Add audit logging for all debug actions. Consider disabling debug endpoints in production environments via a feature flag.

### SEC-017: Pipeline YAML Condition Evaluation Uses String Matching

- **Severity**: Low
- **File**: `src/engine/PipelineEngine.ts:375-407`
- **Description**: The `evaluateCondition` method uses a simple regex-based string matching (`/(\S+)\s*==\s*'([^']+)'/`). It does not support complex expressions (AND, OR, NOT, regex matching) and defaults to `true` for unrecognized patterns (line 406). This means any malformed condition expression silently evaluates to true, potentially executing stages that should be skipped.
- **Impact**: Incorrect stage execution in conditional pipelines.
- **Recommended Fix**: Use a proper expression evaluator (e.g., `expr-eval`) with a restricted function set. Never default to `true` for unparseable expressions.

### SEC-018: No Rate Limiting on Pipeline Trigger or Script Execution

- **Severity**: Low
- **Files**: `src/api/pipeline-routes-registrar.ts:77`, `src/api/script-routes.ts:121`
- **Description**: Neither the pipeline trigger endpoint nor the script execution endpoint has rate limiting. An authenticated attacker could flood the system with execution requests.
- **Impact**: Resource exhaustion, denial of service.
- **Recommended Fix**: Add rate limiting middleware (e.g., `fastify-rate-limit`) to pipeline and script endpoints with per-user and per-tenant quotas.

---

## Summary Table

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| SEC-001 | Critical | Authorization | No tenant/project check on pipeline trigger |
| SEC-003 | Critical | Secrets | Secrets in env vars, not masked in logs |
| SEC-002 | High | Authorization | No authorization on pipeline cancel |
| SEC-004 | High | Isolation | Shared /tmp workspace, no per-run isolation |
| SEC-005 | High | Isolation | Docker daemon access, no container hardening |
| SEC-006 | High | Authorization | Script execution lacks tenant verification |
| SEC-007 | High | Supply Chain | No image signature verification |
| SEC-008 | Medium | Input Validation | Array format bypasses command checks |
| SEC-009 | Medium | Privilege Escalation | Process plugins run with host UID/GID |
| SEC-010 | Medium | Audit | Sensitive data in audit log snapshots |
| SEC-011 | Medium | Authorization | Task retry without tenant verification |
| SEC-012 | Medium | Authorization | PipelineRun list/detail without tenant filter |
| SEC-013 | Medium | Availability | Heartbeat watchdog disabled |
| SEC-014 | Medium | Secrets | Container plugins inherit host env vars |
| SEC-015 | Low | Availability | Unbounded execution result map |
| SEC-016 | Low | Authorization | Debug endpoints need tighter controls |
| SEC-017 | Low | Input Validation | Condition evaluation defaults to true |
| SEC-018 | Low | Availability | No rate limiting on trigger/execute |

---

## Priority Remediation Roadmap

1. **Immediate (P0)**: SEC-001 (tenant authz on trigger), SEC-003 (secret masking)
2. **Short-term (P1)**: SEC-002 (cancel authz), SEC-004 (workspace isolation), SEC-005 (container hardening), SEC-007 (image signatures)
3. **Medium-term (P2)**: SEC-006, SEC-008, SEC-009, SEC-010, SEC-011, SEC-012, SEC-014
4. **Backlog (P3)**: SEC-013, SEC-015, SEC-016, SEC-017, SEC-018
