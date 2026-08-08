# Router Handler Registration Batch (2026-08-05)

## Task
Register 52 wired-but-unregistered handler variables in `cmd/server/router.go`.

## Approach
1. For each of the 52 handler variables, located the wire assignment (`var = handler.NewHandler(...)`) in wiring files
2. Verified each handler type has a `RegisterRoutes(*gin.RouterGroup)` method by checking the actual `.go` files
3. Added registration blocks in `router.go` inside the `api` group (after line 880, before closing `}`)
4. Skipped handlers whose type does NOT have `RegisterRoutes`

## Results

### Added: 42 handlers
- aiAgentRunH, aiModelsH
- ciArtRegH, ciArtVerH, ciBuildH, ciDeployH, ciPTmplH, ciRunnerH
- governanceH, governancePolicyH, governanceRiskH
- graphH
- identityApikeyH, identitySessionH, identitySsoH, identityTenantH
- infraBackupH, infraChaosH, infraDbaH, infraDegH, infraDrH, infraDTwinH, infraEEH, infraIacH, infraMultiH, infraMWnH, infraOCIH
- jobsourceH
- pipelineBudgetH, pipelineTemplatesH, pipelineVersionsH
- pluginMarketplaceH
- resilienceScoreH, runnerH, sbomH
- securityCrossDomainH, securityH, securityPrivacyH, securitySecretH, securityUebaH
- slaPolicyTicketH, ticketSourceTicketH

### Skipped: 10 handlers (no RegisterRoutes method)
- analyticsTicketH → AnalyticsHandler has no RegisterRoutes (only per-endpoint method handlers)
- dispatchH → DispatchHandler has no RegisterRoutes
- loadBalancerH → LoadBalancerHandler has no RegisterRoutes
- queueH → QueueHandler has no RegisterRoutes
- relationH → RelationHandler has no RegisterRoutes
- slaModH → SLAHandler has no RegisterRoutes
- suspendH → SuspendHandler has no RegisterRoutes
- ticketH → TicketHandler has no RegisterRoutes
- transferH → TransferHandler has no RegisterRoutes
- workflowModH → WorkflowHandler has no RegisterRoutes

All 10 skipped handlers reside in `internal/ticket/handler/` and are designed as standalone action handlers (each implements individual CRUD endpoints like `Create`, `GetAll`, `Update`, `Delete`) rather than a full `RegisterRoutes` pattern.

## Verification
- `go build ./cmd/server/` → PASSES (0 errors)
- `go test ./...` (excluding pre-existing failures) → 0 FAIL

### Pre-existing failures (NOT caused by this change)
- `cmd/server/wiring.go`: unused imports + undefined symbols (artifactVersion_handler, cache_mod_handler, cacheCleanup_handler) — these exist in the unmodified wiring.go
- `internal/logging/handler`: unused "bytes" import in test file

## Files modified
- `cmd/server/router.go` — added 42 registration blocks + comment noting 10 skipped
