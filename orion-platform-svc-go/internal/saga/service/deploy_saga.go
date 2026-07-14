package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/saga/models"
	"orion/platform-svc-go/internal/saga/repository"
)

// DeploySaga is a lightweight deployment saga built on top of SagaCoordinator.
type DeploySaga struct {
	coordinator *SagaCoordinator
	repo        *repository.Repository
}

// NewDeploySaga creates a new DeploySaga bound to the given coordinator and repo.
func NewDeploySaga(coordinator *SagaCoordinator, repo *repository.Repository) *DeploySaga {
	return &DeploySaga{coordinator: coordinator, repo: repo}
}

// deploySteps defines the fixed execution order for a deploy saga.
var deploySteps = []string{
	"validate",
	"prepare",
	"build",
	"deploy",
	"verify",
}

// ExecuteInput holds the parameters for a deploy saga execution.
type ExecuteInput struct {
	Target    string                 `json:"target"`
	Version   string                 `json:"version"`
	Variables map[string]interface{} `json:"variables"`
}

// ExecuteResult holds the outcome of a deploy saga execution.
type ExecuteResult struct {
	TransactionID string       `json:"transaction_id"`
	Status        string       `json:"status"`
	Error         string       `json:"error,omitempty"`
	Steps         []StepResult `json:"steps"`
}

// StepResult records the outcome of a single step.
type StepResult struct {
	StepName string `json:"step_name"`
	Status   string `json:"status"`
	Error    string `json:"error,omitempty"`
}

// Execute runs a deploy saga: validate → prepare → build → deploy → verify.
// On any step failure it triggers compensation. Each step is simulated with a 5ms delay.
func (d *DeploySaga) Execute(ctx context.Context, tenantID, deployID string, input ExecuteInput) (*ExecuteResult, error) {
	// Marshal step input JSON
	inputJSON, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}

	// Start the saga transaction via coordinator
	req := &models.CreateSagaRequest{
		SagaName: "deploy",
		Input: map[string]interface{}{
			"deploy_id": deployID,
			"target":    input.Target,
			"version":   input.Version,
		},
		Metadata: map[string]interface{}{
			"deploy_id": deployID,
			"source":    "DeploySaga",
		},
	}

	tx, err := d.coordinator.Start(ctx, tenantID, req)
	if err != nil {
		return nil, err
	}

	// Pre-create step records
	steps := make([]models.SagaStep, len(deploySteps))
	for i, name := range deploySteps {
		steps[i] = models.SagaStep{
			TenantID:      tenantID,
			TransactionID: tx.ID,
			StepName:      name,
			Sequence:      i,
			Status:        models.SagaStepStatusPending,
			Input:         string(inputJSON),
		}
		if err := d.repo.CreateStep(ctx, &steps[i]); err != nil {
			errStr := fmt.Sprintf("create step %s: %v", name, err)
			_ = d.repo.UpdateTransactionStatus(ctx, tenantID, tx.ID, models.SagaStatusFailed, 0, &errStr, nil)
			return nil, fmt.Errorf("create step %s: %w", name, err)
		}
	}

	// Execute steps sequentially
	result := &ExecuteResult{
		TransactionID: tx.ID,
		Steps:         make([]StepResult, len(deploySteps)),
	}

	for i, name := range deploySteps {
		step := &steps[i]

		// Mark executing
		now := time.Now().UTC().Unix()
		_ = d.repo.UpdateStepStatus(ctx, tenantID, step.ID, models.SagaStepStatusExecuting, nil, nil, 0, nil)
		_ = d.repo.UpdateTransactionStatus(ctx, tenantID, tx.ID, models.SagaStatusRunning, i, nil, nil)

		// Simulate step execution (sleep 5ms)
		time.Sleep(5 * time.Millisecond)

		// Check context cancellation
		select {
		case <-ctx.Done():
			errMsg := fmt.Sprintf("context cancelled at step %s", name)
			_ = d.repo.UpdateStepStatus(ctx, tenantID, step.ID, models.SagaStepStatusFailed, &errMsg, nil, 0, ptrInt64(now))
			result.Steps[i] = StepResult{StepName: name, Status: "failed", Error: errMsg}
			_ = d.coordinator.StartCompensation(ctx, tenantID, tx.ID, errMsg)
			result.Status = "failed"
			result.Error = errMsg
			return result, nil
		default:
		}

		// Mark step completed
		_ = d.repo.UpdateStepStatus(ctx, tenantID, step.ID, models.SagaStepStatusCompleted, nil, nil, 0, ptrInt64(now))
		result.Steps[i] = StepResult{StepName: name, Status: "completed"}
	}

	// All steps completed — mark saga done
	now := time.Now().UTC().Unix()
	_ = d.repo.UpdateTransactionStatus(ctx, tenantID, tx.ID, models.SagaStatusCompleted, 0, nil, ptrInt64(now))
	result.Status = "completed"
	return result, nil
}

// ListDeployments returns all deploy saga transactions for a tenant.
func (d *DeploySaga) ListDeployments(ctx context.Context, tenantID string) ([]models.SagaTransaction, error) {
	sagaName := "deploy"
	q := models.ListSagasQuery{
		SagaName: &sagaName,
		Limit:    50,
		Offset:   0,
	}
	resp, err := d.coordinator.ListTransactions(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return resp.Data, nil
}

// GetDeployment retrieves a deploy saga transaction by ID.
func (d *DeploySaga) GetDeployment(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error) {
	tx, err := d.coordinator.GetTransaction(ctx, tenantID, txID)
	if err != nil {
		return nil, err
	}
	if tx.SagaName != "deploy" {
		return nil, fmt.Errorf("transaction %s is not a deploy saga", txID)
	}
	return tx, nil
}

// --- helpers ---
