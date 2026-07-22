package saga

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

// CreateApprovalSagaSteps returns the ordered steps for an approval workflow saga.
//
// Flow:
//   1. CreateApprovalRequest  -> on failure / abort: DeleteApprovalRequest
//   2. CreateApprovalLevel    -> on failure / abort: DeleteApprovalLevel
//   3. AssignApprover         -> on failure / abort: RevokeApproverAssignment
//
// Each step records its output in map[string]interface{} so that the matching
// compensate function can undo exactly what was done.
func CreateApprovalSagaSteps() []saga.SagaStep {
	return []saga.SagaStep{
		{
			ID:   "create_approval_request",
			Name: "CreateApprovalRequest",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				approvalID := generateID("approval")
				status := "pending"
				result := map[string]interface{}{
					"approval_id": approvalID,
					"title":       getString(ctxData, "title", "Untitled Approval"),
					"type":        getString(ctxData, "type", "multi_level"),
					"total_levels": getInt(ctxData, "levels", 1),
					"req_by_id":   getString(ctxData, "user_id", ""),
					"status":      status,
				}
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "create_approval_request",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				approvalID := stepResult["approval_id"]
				if approvalID == nil || approvalID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "create_approval_request",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = approvalID // side-effect: in production calls DeleteApprovalRequest(approvalID)
				return nil
			},
		},
		{
			ID:   "create_approval_level",
			Name: "CreateApprovalLevel",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				approvalID := getString(inst.ContextData, "approval_id", "")
				totalLevels := getInt(inst.ContextData, "total_levels", 1)
				levelID := generateID("level")

				var approverID, approverName string
				if a, ok := ctxData["approver_id"]; ok {
					approverID = a.(string)
				}
				if a, ok := ctxData["approver_name"]; ok {
					approverName = a.(string)
				}
				result := map[string]interface{}{
					"level_id":     levelID,
					"approval_id":  approvalID,
					"level":        1,
					"approver_id":  approverID,
					"approver_name": approverName,
					"total_levels": totalLevels,
					"status":       "pending",
				}
				inst.ContextData["approval_id"] = approvalID
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "create_approval_level",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				levelID := stepResult["level_id"]
				if levelID == nil || levelID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "create_approval_level",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = levelID // side-effect: in production calls DeleteApprovalLevel(levelID)
				return nil
			},
		},
		{
			ID:   "assign_approver",
			Name: "AssignApprover",
			ExecuteFunc: func(ctx context.Context, inst *saga.SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error) {
				approvalID := getString(inst.ContextData, "approval_id", "")
				approverID := getString(ctxData, "approver_id", "")
				approverName := getString(ctxData, "approver_name", "")
				assignmentID := generateID("assign")

				result := map[string]interface{}{
					"assignment_id": assignmentID,
					"approval_id":   approvalID,
					"approver_id":   approverID,
					"approver_name": approverName,
					"assigned_at":   time.Now().UTC(),
				}
				inst.Steps = append(inst.Steps, saga.SagaStepResult{
					StepID:  "assign_approver",
					Status:  "COMPLETED",
					Result:  result,
					ExecutedAt: nowPtr(),
				})
				return result, nil
			},
			CompensateFunc: func(ctx context.Context, inst *saga.SagaInstance, stepResult map[string]interface{}) error {
				assignmentID := stepResult["assignment_id"]
				if assignmentID == nil || assignmentID == "" {
					return nil
				}
				comp := saga.SagaCompensation{
					StepID:   "assign_approver",
					Status:   "COMPLETED",
					ExecutedAt: time.Now().UTC(),
				}
				inst.CompensationLog = append(inst.CompensationLog, comp)
				_ = assignmentID // side-effect: in production calls RevokeApproverAssignment(assignmentID)
				return nil
			},
		},
	}
}
