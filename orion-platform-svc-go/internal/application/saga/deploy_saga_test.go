package saga

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

func makeDeploySagaInstance() *saga.SagaInstance {
	return &saga.SagaInstance{
		ID:    "deploy-saga-1",
		SagaType: "deployment",
		Status:  saga.StatusRunning,
		TotalSteps: 3,
		ContextData: map[string]interface{}{
			"app_name":    "web-api",
			"environment": "prod",
			"version":     "1.0.0",
			"commit_sha":  "abc123def456",
		},
		Steps:           make([]saga.SagaStepResult, 0),
		CompensationLog: make([]saga.SagaCompensation, 0),
	}
}

func TestDeploySaga_StepStructure(t *testing.T) {
	steps := CreateDeploySagaSteps()
	assert.Len(t, steps, 3)

	expected := []string{"build_artifact", "canary_deploy", "full_deploy"}
	for i, s := range steps {
		assert.Equal(t, expected[i], s.ID)
		assert.NotNil(t, s.ExecuteFunc)
		assert.NotNil(t, s.CompensateFunc)
		assert.NotEmpty(t, s.Name)
	}
}

// --- Step 1: BuildArtifact ---

func TestDeploySaga_Step1_BuildArtifact(t *testing.T) {
	steps := CreateDeploySagaSteps()
	step := steps[0]

	t.Run("creates a build artifact and records step result", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		buildID := result["build_id"].(string)
		_, ok := inst.ContextData["build_id"]
		assert.True(t, ok)
		assert.True(t, strings.HasPrefix(buildID, "build-"))
		assert.Equal(t, "web-api", result["app_name"])
		assert.Equal(t, "prod", result["environment"])
		assert.Equal(t, "1.0.0", result["version"])
		assert.Equal(t, "abc123def456", result["commit_sha"])
		_, ok2 := result["artifact_path"]
		assert.True(t, ok2)
		_, ok3 := result["built_at"]
		assert.True(t, ok3)
		assert.Equal(t, "succeeded", result["status"])
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "build_artifact", inst.Steps[0].StepID)
		assert.Equal(t, "COMPLETED", inst.Steps[0].Status)
	})

	t.Run("uses fallback environment when absent", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		delete(inst.ContextData, "environment")
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.Equal(t, "dev", result["environment"])
	})

	t.Run("compensates by cancelling the build", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		err := step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "build_artifact", inst.CompensationLog[0].StepID)
		assert.Equal(t, "COMPLETED", inst.CompensationLog[0].Status)
	})

	t.Run("compensate is no-op when build_id is nil", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{"build_id": nil})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when build_id is empty string", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{"build_id": ""})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Step 2: CanaryDeploy ---

func TestDeploySaga_Step2_CanaryDeploy(t *testing.T) {
	steps := CreateDeploySagaSteps()
	step := steps[1]

	t.Run("deploys canary and records step result", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		inst.ContextData["build_id"] = "build-fake-id"
		inst.ContextData["canary_percentage"] = 25

		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		canaryID := result["canary_id"].(string)
		_, ok := inst.ContextData["canary_id"]
		assert.True(t, ok)
		assert.True(t, strings.HasPrefix(canaryID, "canary-"))
		assert.Equal(t, "build-fake-id", result["build_id"])
		assert.Equal(t, 25, result["percentage"])
		_, ok2 := result["started_at"]
		_ = ok2
		assert.Equal(t, "running", result["status"])
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "canary_deploy", inst.Steps[0].StepID)
	})

	t.Run("uses fallback percentage when absent", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		inst.ContextData["build_id"] = "build-fake-id"
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.Equal(t, 10, result["percentage"])
	})

	t.Run("compensates by rolling back canary", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		inst.ContextData["build_id"] = "build-fake-id"
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		err := step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "canary_deploy", inst.CompensationLog[0].StepID)
		assert.Equal(t, "COMPLETED", inst.CompensationLog[0].Status)
	})

	t.Run("compensate is no-op when canary_id is nil", func(t *testing.T) {
		install := makeDeploySagaInstance()
		err := steps[1].CompensateFunc(context.Background(), install, map[string]interface{}{"canary_id": nil})
		assert.NoError(t, err)
		assert.Len(t, install.CompensationLog, 0)
	})

	t.Run("compensate is no-op when canary_id is empty", func(t *testing.T) {
		install := makeDeploySagaInstance()
		err := steps[1].CompensateFunc(context.Background(), install, map[string]interface{}{"canary_id": ""})
		assert.NoError(t, err)
		assert.Len(t, install.CompensationLog, 0)
	})
}

// --- Step 3: FullDeploy ---

func TestDeploySaga_Step3_FullDeploy(t *testing.T) {
	steps := CreateDeploySagaSteps()
	step := steps[2]

	t.Run("performs full deploy and records step result", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		inst.ContextData["canary_id"] = "canary-fake-id"

		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		deploymentID := result["deployment_id"].(string)
		_, ok := inst.ContextData["deployment_id"]
		assert.True(t, ok)
		assert.True(t, strings.HasPrefix(deploymentID, "deploy-"))
		assert.Equal(t, "canary-fake-id", result["canary_id"])
		_, ok2 := result["deployed_at"]
		_ = ok2
		assert.Equal(t, "succeeded", result["status"])
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "full_deploy", inst.Steps[0].StepID)
		assert.Equal(t, "COMPLETED", inst.Steps[0].Status)
	})

	t.Run("compensates by rolling back full deploy", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		inst.ContextData["canary_id"] = "canary-fake-id"
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		err := step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "full_deploy", inst.CompensationLog[0].StepID)
		assert.Equal(t, "COMPLETED", inst.CompensationLog[0].Status)
	})

	t.Run("compensate is no-op when deployment_id is nil", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		err := steps[2].CompensateFunc(context.Background(), inst, map[string]interface{}{"deployment_id": nil})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when deployment_id is empty", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		err := steps[2].CompensateFunc(context.Background(), inst, map[string]interface{}{"deployment_id": ""})
		_ = err
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Integration: full deploy saga execution ---

func TestDeploySaga_FullExecution(t *testing.T) {
	steps := CreateDeploySagaSteps()
	ctx := context.Background()

	t.Run("executes all 3 steps in order", func(t *testing.T) {
		inst := makeDeploySagaInstance()

		// Step 1
		r1, err := steps[0].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		_, ok := inst.ContextData["build_id"]
		assert.True(t, ok)

		// Step 2 reads build_id from step 1
		r2, err := steps[1].ExecuteFunc(ctx, inst, inst.ContextData)
		_ = err
		assert.Equal(t, r1["build_id"], r2["build_id"])
		_, ok2 := inst.ContextData["canary_id"]
		assert.True(t, ok2)

		// Step 3 reads canary_id from step 2
		r3, err := steps[2].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		assert.Equal(t, r2["canary_id"], r3["canary_id"])

		assert.Len(t, inst.Steps, 3)
	})

	t.Run("compensates all 3 steps in reverse on failure", func(t *testing.T) {
		inst := makeDeploySagaInstance()
		results := make([]map[string]interface{}, 3)

		for i, step := range steps {
			results[i], _ = step.ExecuteFunc(ctx, inst, inst.ContextData)
		}

		// Compensate in reverse order
		for i := len(steps) - 1; i >= 0; i-- {
			err := steps[i].CompensateFunc(ctx, inst, results[i])
			_ = err
		}

		assert.Len(t, inst.CompensationLog, 3)
		// Last step is compensated first (reverse order)
		assert.Equal(t, "full_deploy", inst.CompensationLog[0].StepID)
		assert.Equal(t, "canary_deploy", inst.CompensationLog[1].StepID)
		assert.Equal(t, "build_artifact", inst.CompensationLog[2].StepID)
	})
}
