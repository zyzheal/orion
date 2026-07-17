package saga

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

func makePipelineSagaInstance() *saga.SagaInstance {
	return &saga.SagaInstance{
		ID:         uuid.New().String(),
		SagaType:   "pipeline_execution",
		TenantID:   "tenant-1",
		Status:     saga.StatusRunning,
		TotalSteps: 3,
		ContextData: map[string]interface{}{
			"pipeline_id":      "pipe-1",
			"pipeline_version": "v1.2.3",
		},
		Steps:           make([]saga.SagaStepResult, 0),
		CompensationLog: make([]saga.SagaCompensation, 0),
	}
}

// --- Step 1: CreatePipelineRun ---

func TestPipelineSaga_Step1_CreatePipelineRun(t *testing.T) {
	steps := CreatePipelineSagaSteps()
	step := steps[0]

	t.Run("creates a pipeline run and records step result", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "RUNNING", result["status"])
		assert.Equal(t, "pipe-1", result["pipeline_id"])
		assert.Equal(t, "v1.2.3", result["pipeline_version"])
		assert.Equal(t, "manual", result["trigger_type"])
		assert.True(t, strings.HasPrefix(result["run_id"].(string), "run-"))
		_, ok := inst.ContextData["run_id"]
		assert.True(t, ok)
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "create_pipeline_run", inst.Steps[0].StepID)
		assert.Equal(t, "COMPLETED", inst.Steps[0].Status)
	})

	t.Run("compensates by cancelling the run", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		err := step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		_, ok := result["run_id"]
		_ = ok
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "create_pipeline_run", inst.CompensationLog[0].StepID)
		assert.Equal(t, "COMPLETED", inst.CompensationLog[0].Status)
	})

	t.Run("compensate is no-op when run_id is missing", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		err := steps[0].CompensateFunc(context.Background(), inst, map[string]interface{}{})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when run_id is empty string", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		err := steps[0].CompensateFunc(context.Background(), inst, map[string]interface{}{"run_id": ""})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("defaults trigger_type to manual when absent", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		delete(inst.ContextData, "trigger_type")
		result, _ := steps[0].ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.Equal(t, "manual", result["trigger_type"])
	})
}

// --- Step 2: StartPipelineEngine ---

func TestPipelineSaga_Step2_StartPipelineEngine(t *testing.T) {
	steps := CreatePipelineSagaSteps()
	step := steps[1]

	t.Run("starts pipeline engine and records step result", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		inst.ContextData["run_id"] = "run-42"

		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "run-42", result["run_id"])
		assert.True(t, strings.HasPrefix(result["engine_id"].(string), "engine-"))
		assert.Equal(t, "running", result["status"])
		_, ok := inst.ContextData["engine_id"]
		assert.True(t, ok)
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "start_pipeline_engine", inst.Steps[0].StepID)
	})

	t.Run("compensates by stopping the engine", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		inst.ContextData["run_id"] = "run-42"
		_, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.NoError(t, err)
		stepResult := inst.Steps[0].Result

		err = step.CompensateFunc(context.Background(), inst, stepResult)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "start_pipeline_engine", inst.CompensationLog[0].StepID)
	})

	t.Run("compensate is no-op when engine_id is empty", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		err := steps[1].CompensateFunc(context.Background(), inst, map[string]interface{}{"engine_id": ""})
		_, ok := inst.ContextData["engine_id"]
		_ = ok
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when engine_id is nil", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		err := steps[1].CompensateFunc(context.Background(), inst, map[string]interface{}{"engine_id": nil})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Step 3: DeployArtifacts ---

func TestPipelineSaga_Step3_DeployArtifacts(t *testing.T) {
	steps := CreatePipelineSagaSteps()
	// no-op verification — steps[2] must exist
	_ = steps[2]
	step := steps[2]

	t.Run("deploys artifacts and records step result", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		inst.ContextData["run_id"] = "run-42"

		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		_, ok := result["deployment_id"]
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.True(t, ok)
		assert.Equal(t, "run-42", result["run_id"])
		assert.Equal(t, "succeeded", result["status"])
		_, ok2 := inst.ContextData["deployment_id"]
		_ = ok2
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "deploy_artifacts", inst.Steps[0].StepID)
	})

	t.Run("compensates by rolling back deployment", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		inst.ContextData["run_id"] = "run-42"
		stepResult, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.NoError(t, err)

		err = step.CompensateFunc(context.Background(), inst, stepResult)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "deploy_artifacts", inst.CompensationLog[0].StepID)
	})

	t.Run("compensate is no-op when deployment_id is nil", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		err := steps[2].CompensateFunc(context.Background(), inst, map[string]interface{}{"deployment_id": nil})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when deployment_id is empty", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		err := steps[2].CompensateFunc(context.Background(), inst, map[string]interface{}{"deployment_id": ""})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Integration: full pipeline saga execution ---

func TestPipelineSaga_FullExecution(t *testing.T) {
	steps := CreatePipelineSagaSteps()
	ctx := context.Background()

	t.Run("executes all 3 steps in order", func(t *testing.T) {
		inst := makePipelineSagaInstance()

		// Step 1
		r1, err := steps[0].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		_, ok := inst.ContextData["run_id"]
		assert.True(t, ok)

		// Step 2 uses run_id from step 1
		r2, err := steps[1].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		assert.Equal(t, r1["run_id"], r2["run_id"])
		_, ok2 := inst.ContextData["engine_id"]
		assert.True(t, ok2)

		// Step 3 uses run_id from step 1
		r3, err := steps[2].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		assert.Equal(t, r1["run_id"], r3["run_id"])

		assert.Len(t, inst.Steps, 3)
		assert.Contains(t, r3["deployment_id"], "deploy-")
	})

	t.Run("compensates all 3 steps in reverse on failure", func(t *testing.T) {
		inst := makePipelineSagaInstance()
		results := make([]map[string]interface{}, 3)

		// Execute all steps
		for i, step := range steps {
			results[i], _ = step.ExecuteFunc(ctx, inst, inst.ContextData)
		}

		// Compensate in reverse order
		for i := len(steps) - 1; i >= 0; i-- {
			err := steps[i].CompensateFunc(ctx, inst, results[i])
			assert.NoError(t, err)
		}

		assert.Len(t, inst.CompensationLog, 3)
		// Last step is compensated first (reverse order)
		assert.Equal(t, "deploy_artifacts", inst.CompensationLog[0].StepID)
		assert.Equal(t, "start_pipeline_engine", inst.CompensationLog[1].StepID)
		assert.Equal(t, "create_pipeline_run", inst.CompensationLog[2].StepID)
	})
}

// --- Test: saga steps structure ---

func TestPipelineSaga_StepStructure(t *testing.T) {
	steps := CreatePipelineSagaSteps()
	assert.Len(t, steps, 3)

	expected := []string{"create_pipeline_run", "start_pipeline_engine", "deploy_artifacts"}
	for i, s := range steps {
		assert.Equal(t, expected[i], s.ID)
		assert.NotNil(t, s.ExecuteFunc)
		assert.NotNil(t, s.CompensateFunc)
		assert.NotEmpty(t, s.Name)
	}
}
