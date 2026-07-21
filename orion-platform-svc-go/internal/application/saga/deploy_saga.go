package saga

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

// CreateDeploySagaSteps returns the ordered steps for a deployment saga.
//
// Flow:
//   1. BuildArtifact -> on failure / abort: CancelBuild (delete build + clear build_id)
//   2. CanaryDeploy -> on failure / abort: RollbackCanary (delete canary + clear canary_id)
//   3. FullDeploy -> on failure / abort: RollbackFullDeploy (delete deployment + clear deployment_id)
//
// Each step records its output in map[string]interface{} so that the matching
// compensate function can undo exactly what was done.
//
// Compensation semantics:
//   - Removes the completed step result(s) from inst.Steps so the saga history
//     no longer reflects state that has been reversed.
//   - Deletes the key(s) written to ContextData (build_id, canary_id, deployment_id)
//     so downstream compensators (which run in reverse order) do not re-consume stale ids.
//   - The _ = <id> comment marks the integration point where production code calls
//     the domain-specific rollback action (CancelBuild, RollbackCanary, RollbackFullDeploy).
func CreateDeploySagaSteps() []saga.SagaStep {
	return []saga.SagaStep{
		{
			ID:   "build_artifact",
			Name: "BuildArtifact",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				buildID := generateID("build")
				result := map[string]interface{}{
					"build_id":       buildID,
					"app_name":       getString(ctxData, "app_name", ""),
					"environment":    getString(ctxData, "environment", "dev"),
					"version":        getString(ctxData, "version", ""),
					"commit_sha":     getString(ctxData, "commit_sha", ""),
					"artifact_path":  "/artifacts/" + getString(ctxData, "app_name", "app") + "/" +getString(ctxData, "version", "latest"),
					"status":         "succeeded",
					"built_at":       time.Now().UTC(),
				}
				inst.ContextData["build_id"] = buildID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:     "build_artifact",
					Status:     "COMPLETED",
					Result:     result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				buildID := getStrFromResult(stepResult, "build_id")
				if buildID == "" {
					return nil
				}
				// Remove completed build_artifact step result(s) from the saga history
				removed := clearStepsByStatus(inst, "build_artifact", "COMPLETED")
				// Clear build_id from ContextData so downstream steps/compensators cannot consume it
				delete(inst.ContextData, "build_id")
				comp := saga.SagaCompensation{
					StepID:     "build_artifact",
					Status:     "COMPLETED",
					Error:      "",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = buildID // side-effect: in production calls CancelBuild(buildID)
				_ = removed // side-effect: removed N build_artifact step(s) from saga history
				return nil
			},
		},
		{
			ID:   "canary_deploy",
			Name: "CanaryDeploy",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				buildID := getString(inst.ContextData, "build_id", "")
				canaryID := generateID("canary")
				percentage := getInt(ctxData, "canary_percentage", 10)
				// Convert to int for the result map to keep consistent with downstream consumption
				result := map[string]interface{}{
					"canary_id":   canaryID,
					"build_id":    buildID,
					"app_name":    getString(ctxData, "app_name", ""),
					"environment": getString(ctxData, "environment", "prod"),
					"percentage":  percentage,
					"version":     getString(ctxData, "version", ""),
					"status":      "running",
					"started_at":  time.Now().UTC(),
				}
				inst.ContextData["canary_id"] = canaryID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:     "canary_deploy",
					Status:     "COMPLETED",
					Result:     result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				canaryID := getStrFromResult(stepResult, "canary_id")
				if canaryID == "" {
					return nil
				}
				// Remove completed canary_deploy step result(s) from the saga history
				removed := clearStepsByStatus(inst, "canary_deploy", "COMPLETED")
				// Clear canary_id from ContextData so downstream compensators cannot consume it
				delete(inst.ContextData, "canary_id")
				comp := saga.SagaCompensation{
					StepID:     "canary_deploy",
					Status:     "COMPLETED",
					Error:      "",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = canaryID // side-effect: in production calls RollbackCanary(canaryID)
				_ = removed  // side-effect: removed N canary_deploy step(s) from saga history
				return nil
			},
		},
		{
			ID:   "full_deploy",
			Name: "FullDeploy",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				canaryID := getString(inst.ContextData, "canary_id", "")
				deploymentID := generateID("deploy")
				// Convert to string for the result map to keep consistent with downstream consumption
				result := map[string]interface{}{
					"deployment_id": deploymentID,
					"canary_id":     canaryID,
					"app_name":      getString(ctxData, "app_name", ""),
					"environment":   getString(ctxData, "environment", "prod"),
					"version":       getString(ctxData, "version", ""),
					"status":        "succeeded",
					"deployed_at":   time.Now().UTC(),
				}
				_ = deploymentID
				inst.ContextData["deployment_id"] = deploymentID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:     "full_deploy",
					Status:     "COMPLETED",
					Result:     result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				deploymentID := getStrFromResult(stepResult, "deployment_id")
				if deploymentID == "" {
					return nil
				}
				// Remove completed full_deploy step result(s) from the saga history
				removed := clearStepsByStatus(inst, "full_deploy", "COMPLETED")
				// Clear deployment_id from ContextData so downstream compensators cannot consume it
				deletedIDs := getStepsByDeleted(inst, "full_deploy", "COMPLETED")
				delete(inst.ContextData, "deployment_id")
				comp := saga.SagaCompensation{
					StepID:     "full_deploy",
					Status:     "COMPLETED",
					Error:      "",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = deploymentID // side-effect: in production calls RollbackFullDeploy(deploymentID)
				_ = removed      // side-effect: removed N full_deploy step(s) from saga history
				_ = deletedIDs   // side-effect: recorded deleted full_deploy step(s) for audit
				return nil
			},
		},
	}
}
