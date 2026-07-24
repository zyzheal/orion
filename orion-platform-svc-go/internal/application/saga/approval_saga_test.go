package saga

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

func makeApprovalSagaInstance() *saga.SagaInstance {
	return &saga.SagaInstance{
		ID:    "approval-saga-1",
		SagaType: "approval_workflow",
		Status:  saga.StatusRunning,
		TotalSteps: 3,
		ContextData: map[string]interface{}{
			"title":    "Project Budget Approval",
			"type":     "multi_level",
			"levels":   3,
			"user_id":  "user-42",
		},
		Steps:           make([]saga.SagaStepResult, 0),
		CompensationLog: make([]saga.SagaCompensation, 0),
	}
}

func TestApprovalSaga_StepStructure(t *testing.T) {
	steps := CreateApprovalSagaSteps()
	assert.Len(t, steps, 3)

	expected := []string{"create_approval_request", "create_approval_level", "assign_approver"}
	for i, s := range steps {
		assert.Equal(t, expected[i], s.ID)
		assert.NotNil(t, s.ExecuteFunc)
		assert.NotNil(t, s.CompensateFunc)
		assert.NotEmpty(t, s.Name)
	}
}

// --- Step 1: CreateApprovalRequest ---

func TestApprovalSaga_Step1_CreateApprovalRequest(t *testing.T) {
	steps := CreateApprovalSagaSteps()
	step := steps[0]

	t.Run("creates an approval request and records step result", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		approvalID := result["approval_id"].(string)
		assert.True(t, strings.HasPrefix(approvalID, "approval-"))
		assert.Equal(t, "Project Budget Approval", result["title"])
		assert.Equal(t, "multi_level", result["type"])
		assert.Equal(t, 3, result["total_levels"])
		assert.Equal(t, "user-42", result["req_by_id"])
		// default status is "pending"
		assert.Equal(t, "pending", result["status"])
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "create_approval_request", inst.Steps[0].StepID)
		assert.Equal(t, "COMPLETED", inst.Steps[0].Status)
	})

	t.Run("uses fallback values when context data is missing", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		inst.ContextData = map[string]interface{}{}
		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.Equal(t, "Untitled Approval", result["title"])
		assert.Equal(t, "multi_level", result["type"])
		assert.Equal(t, 1, result["total_levels"])
		assert.Equal(t, "", result["req_by_id"])
	})

	t.Run("compensates by deleting the approval request", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		err := step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "create_approval_request", inst.CompensationLog[0].StepID)
		assert.Equal(t, "COMPLETED", inst.CompensationLog[0].Status)
	})

	t.Run("compensate is no-op when approval_id is nil", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when approval_id is empty string", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{"approval_id": ""})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Step 2: CreateApprovalLevel ---

func TestApprovalSaga_Step2_CreateApprovalLevel(t *testing.T) {
	steps := CreateApprovalSagaSteps()
	step := steps[1]

	t.Run("creates an approval level and records step result", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		// Simulate step 1 having already written approval_id
		inst.ContextData["approval_id"] = "approval-fake-id"
		inst.ContextData["approver_id"] = "user-99"
		inst.ContextData["approver_name"] = "Alice"

		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		levelID := result["level_id"].(string)
		assert.True(t, strings.HasPrefix(levelID, "level-"))
		assert.Equal(t, "approval-fake-id", result["approval_id"])
		assert.Equal(t, 1, result["level"])
		assert.Equal(t, "user-99", result["approver_id"])
		assert.Equal(t, "Alice", result["approver_name"])
		assert.Equal(t, "pending", result["status"])
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "create_approval_level", inst.Steps[0].StepID)
	})

	t.Run("compensates by deleting the approval level", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		inst.ContextData["approval_id"] = "approval-fake-id"

		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		err := step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		_, ok := result["level_id"]
		assert.True(t, ok)
		assert.Equal(t, "create_approval_level", inst.CompensationLog[0].StepID)
	})

	t.Run("compensate is no-op when level_id is nil", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{})
		_ = err
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when level_id is empty string", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{"level_id": ""})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Step 3: AssignApprover ---

func TestApprovalSaga_Step3_AssignApprover(t *testing.T) {
	steps := CreateApprovalSagaSteps()
	step := steps[2]

	t.Run("assigns an approver and records step result", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		inst.ContextData["approval_id"] = "approval-fake-id"
		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		_, ok := result["assignment_id"]
		assert.True(t, ok)
		assert.Equal(t, "approval-fake-id", result["approval_id"])
		_, ok2 := result["assigned_at"]
		assert.True(t, ok2)
		assert.Len(t, inst.Steps, 1)
		assert.Equal(t, "assign_approver", inst.Steps[0].StepID)
		assert.Equal(t, "COMPLETED", inst.Steps[0].Status)
	})

	t.Run("uses approver_id and approver_name from context data", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		inst.ContextData["approval_id"] = "approval-fake-id"
		inst.ContextData["approver_id"] = "user-5"
		inst.ContextData["approver_name"] = "Bob"
		result, _ := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.Equal(t, "user-5", result["approver_id"])
		assert.Equal(t, "Bob", result["approver_name"])
	})

	t.Run("compensates by revoking the approver assignment", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		inst.ContextData["approval_id"] = "approval-fake-id"
		result, err := step.ExecuteFunc(context.Background(), inst, inst.ContextData)
		assert.NoError(t, err)

		err = step.CompensateFunc(context.Background(), inst, result)
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 1)
		assert.Equal(t, "assign_approver", inst.CompensationLog[0].StepID)
	})

	t.Run("compensate is no-op when assignment_id is nil", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{"assignment_id": nil})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensate is no-op when assignment_id is empty", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		err := step.CompensateFunc(context.Background(), inst, map[string]interface{}{"assignment_id": ""})
		assert.NoError(t, err)
		assert.Len(t, inst.CompensationLog, 0)
	})
}

// --- Integration: full approval saga execution ---

func TestApprovalSaga_FullExecution(t *testing.T) {
	steps := CreateApprovalSagaSteps()
	ctx := context.Background()

	t.Run("executes all 3 steps in order", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		// Step 1
		r1, err := steps[0].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		_, ok := r1["approval_id"]
		assert.True(t, ok)

		// Step 2 reads approval_id from ContextData (set by step 1 via step 1 result)
		inst.ContextData["approval_id"] = r1["approval_id"]
		inst.ContextData["total_levels"] = r1["total_levels"]
		r2, err := steps[1].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		assert.Equal(t, r1["approval_id"], r2["approval_id"])

		// Step 3 reads approval_id from ContextData
		r3, err := steps[2].ExecuteFunc(ctx, inst, inst.ContextData)
		assert.NoError(t, err)
		assert.Equal(t, r1["approval_id"], r3["approval_id"])

		assert.Len(t, inst.Steps, 3)
		assert.Len(t, inst.CompensationLog, 0)
	})

	t.Run("compensates all 3 steps in reverse on failure", func(t *testing.T) {
		inst := makeApprovalSagaInstance()
		results := make([]map[string]interface{}, 3)

		for i, step := range steps {
			if i > 0 {
				inst.ContextData["approval_id"] = results[0]["approval_id"]
			}
			if i == 1 {
				inst.ContextData["total_levels"] = results[0]["total_levels"]
			}
			results[i], _ = step.ExecuteFunc(ctx, inst, inst.ContextData)
		}

		// Compensate in reverse order
		for i := len(steps) - 1; i >= 0; i-- {
			err := steps[i].CompensateFunc(ctx, inst, results[i])
			assert.NoError(t, err)
		}

		assert.Len(t, inst.CompensationLog, 3)
		// Last step is compensated first (reverse order)
		assert.Equal(t, "assign_approver", inst.CompensationLog[0].StepID)
		assert.Equal(t, "create_approval_level", inst.CompensationLog[1].StepID)
		assert.Equal(t, "create_approval_request", inst.CompensationLog[2].StepID)
	})
}
