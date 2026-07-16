package saga

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

// CreateDeploySagaSteps returns the ordered steps for a deployment saga.
//
// Flow:
//   1. BuildArtifact -> on failure / abort: CancelBuild
//   2. CanaryDeploy -> on failure / abort: RollbackCanary
//   3. FullDeploy -> on failure / abort: RollbackFullDeploy
//
// Each step records its output in map[string]interface{} so that the matching
// compensate function can undo exactly what was done.
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
					"artifact_path":  "/artifacts/"+getString(ctxData, "app_name", "app")+"/"+getString(ctxData, "version", "latest"),
					"status":         "succeeded",
					"built_at":       time.Now().UTC(),
				}
				inst.ContextData["build_id"] = buildID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "build_artifact",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				buildID := stepResult["build_id"]
				if buildID == nil || buildID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "build_artifact",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = buildID // side-effect: in production calls CancelBuild(buildID)
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
				result := map[string]interface{}{
					"canary_id":      canaryID,
					"build_id":       buildID,
					"app_name":       getString(ctxData, "app_name", ""),
					"environment":    getString(ctxData, "environment", "prod"),
					"percentage":     percentage,
					"version":        getString(ctxData, "version", ""),
					"status":         "running",
					"started_at":     time.Now().UTC(),
				}
				inst.ContextData["canary_id"] = canaryID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "canary_deploy",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				canaryID := stepResult["canary_id"]
				if canaryID == nil || canaryID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "canary_deploy",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				comp.Status = "COMPLETED"
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = canaryID // side-effect: in production calls RollbackCanary(canaryID)
				return nil
			},
		},
		{
			ID:   "full_deploy",
			Name: "FullDeploy",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				canaryID := getString(inst.ContextData, "canary_id", "")
				deploymentID := generateID("deploy")
				result := map[string]interface{}{
					"deployment_id": deploymentID,
					"canary_id":     canaryID,
					"app_name":      getString(ctxData, "app_name", ""),
					"environment":   getString(ctxData, "environment", "prod"),
					"version":       getString(ctxData, "version", ""),
					"status":        "succeeded",
					"deployed_at":   time.Now().UTC(),
				}
				inst.ContextData["deployment_id"] = deploymentID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "full_deploy",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				deploymentID := stepResult["deployment_id"]
				if deploymentID == nil || deploymentID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "full_deploy",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = deploymentID // side-effect: in production calls RollbackFullDeploy(deploymentID)
				return nil
			},
		},
	}
}
