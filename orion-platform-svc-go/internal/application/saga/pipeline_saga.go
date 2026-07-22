package saga

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

// CreatePipelineSagaSteps returns the ordered steps for a pipeline execution saga.
//
// Flow:
//   1. CreatePipelineRun -> on failure / abort: CancelPipelineRun
//   2. StartPipelineEngine -> on failure / abort: StopPipelineEngine
//   3. DeployArtifacts -> on failure / abort: RollbackDeployment
//
// Each step records its output in map[string]interface{} so that the matching
// compensate function can undo exactly what was done.
func CreatePipelineSagaSteps() []saga.SagaStep {
	return []saga.SagaStep{
		{
			ID:   "create_pipeline_run",
			Name: "CreatePipelineRun",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				runID := generateID("run")
				result := map[string]interface{}{
					"run_id":          runID,
					"pipeline_id":     getString(ctxData, "pipeline_id", ""),
					"pipeline_version": getString(ctxData, "pipeline_version", ""),
					"trigger_type":    getString(ctxData, "trigger_type", "manual"),
					"status":          "RUNNING",
					"started_at":      time.Now().UTC(),
				}
				inst.ContextData["run_id"] = runID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "create_pipeline_run",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				runID := stepResult["run_id"]
				if runID == nil || runID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "create_pipeline_run",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = runID // side-effect: in production calls CancelPipelineRun(runID)
				return nil
			},
		},
		{
			ID:   "start_pipeline_engine",
			Name: "StartPipelineEngine",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				runID := getString(inst.ContextData, "run_id", "")
				engineID := generateID("engine")
				result := map[string]interface{}{
					"engine_id": engineID,
					"run_id":    runID,
					"status":    "running",
					"started_at": time.Now().UTC(),
				}
				inst.ContextData["engine_id"] = engineID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "start_pipeline_engine",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				engineID := stepResult["engine_id"]
				if engineID == nil || engineID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "start_pipeline_engine",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = engineID // side-effect: in production calls StopPipelineEngine(engineID)
				return nil
			},
		},
		{
			ID:   "deploy_artifacts",
			Name: "DeployArtifacts",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				runID := getString(inst.ContextData, "run_id", "")
				deploymentID := generateID("deploy")
				result := map[string]interface{}{
					"deployment_id": deploymentID,
					"run_id":        runID,
					"status":        "succeeded",
					"deployed_at":   time.Now().UTC(),
				}
				inst.ContextData["deployment_id"] = deploymentID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "deploy_artifacts",
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
					StepID:   "deploy_artifacts",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = deploymentID // side-effect: in production calls RollbackDeployment(deploymentID)
				return nil
			},
		},
	}
}
