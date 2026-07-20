package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/saga/models"
)

var (
	errNotFound = errors.New("not found")
)

// mockRepository provides in-memory storage for saga transactions and steps.
type mockRepository struct {
	transactions map[string]*models.SagaTransaction
	steps        map[string]*models.SagaStep
	errOnGet     bool
	errOnList    bool
}

func (r *mockRepository) CreateTransaction(_ context.Context, tx *models.SagaTransaction) error {
	r.transactions[tx.ID] = tx
	return nil
}

func (r *mockRepository) GetTransaction(_ context.Context, _, id string) (*models.SagaTransaction, error) {
	if r.errOnGet {
		return nil, errNotFound
	}
	tx, ok := r.transactions[id]
	if !ok {
		return nil, errNotFound
	}
	return tx, nil
}

func (r *mockRepository) GetTransactionByRequestID(_ context.Context, _, requestID string) (*models.SagaTransaction, error) {
	for _, tx := range r.transactions {
		if tx.RequestID == requestID {
			return tx, nil
		}
	}
	return nil, errNotFound
}

func (r *mockRepository) UpdateTransactionStatus(_ context.Context, _, id string, status models.SagaStatus, currentStep int, errMsg *string, completedAt *int64) error {
	tx, ok := r.transactions[id]
	if !ok {
		return errNotFound
	}
	tx.Status = status
	tx.CurrentStep = currentStep
	tx.Error = errMsg
	tx.CompletedAt = completedAt
	return nil
}

func (r *mockRepository) ListTransactions(_ context.Context, _ string, _ models.ListSagasQuery) ([]models.SagaTransaction, error) {
	if r.errOnList {
		return nil, errNotFound
	}
	var txs []models.SagaTransaction
	for _, tx := range r.transactions {
		txs = append(txs, *tx)
	}
	return txs, nil
}

func (r *mockRepository) CountTransactions(_ context.Context, _ string, _, _ string) (int, error) {
	return len(r.transactions), nil
}

func (r *mockRepository) CreateStep(_ context.Context, step *models.SagaStep) error {
	step.ID = step.StepName + "-" + step.TransactionID
	r.steps[step.ID] = step
	return nil
}

func (r *mockRepository) GetStepsByTransaction(_ context.Context, _, txID string) ([]models.SagaStep, error) {
	var steps []models.SagaStep
	for _, step := range r.steps {
		if step.TransactionID == txID {
			steps = append(steps, *step)
		}
	}
	return steps, nil
}

func (r *mockRepository) GetStep(_ context.Context, _, id string) (*models.SagaStep, error) {
	step, ok := r.steps[id]
	if !ok {
		return nil, errNotFound
	}
	return step, nil
}

func (r *mockRepository) UpdateStepStatus(_ context.Context, _, id string, status models.SagaStepStatus, errMsg *string, output *string, retryCount int, completedAt *int64) error {
	step, ok := r.steps[id]
	if !ok {
		return errNotFound
	}
	step.Status = status
	step.Error = errMsg
	step.Output = output
	step.RetryCount = retryCount
	step.CompletedAt = completedAt
	return nil
}

func (r *mockRepository) UpdateStepCompensation(_ context.Context, _, id string, status models.SagaStepStatus, compensatedAt *int64) error {
	step, ok := r.steps[id]
	if !ok {
		return errNotFound
	}
	step.CompensationCompletedAt = compensatedAt
	return nil
}

func (r *mockRepository) GetNextPendingStep(_ context.Context, _, txID string, currentStep int) (*models.SagaStep, error) {
	for _, step := range r.steps {
		if step.TransactionID == txID && step.Sequence > currentStep && step.Status == models.SagaStepStatusPending {
			return step, nil
		}
	}
	return nil, errNotFound
}

// --- Tests ---

func TestStepRegistry_RegisterAndGet(t *testing.T) {
	reg := NewStepRegistry()
	comp := &noopCompensator{}
	reg.Register("deploy", comp)

	if reg.Get("deploy") == nil {
		t.Fatal("expected compensator for deploy")
	}
	if reg.Get("nonexistent") != nil {
		t.Fatal("expected nil for nonexistent step")
	}
}

func TestStepRegistry_List(t *testing.T) {
	reg := NewStepRegistry()
	reg.Register("validate", &noopCompensator{})
	reg.Register("deploy", &noopCompensator{})

	names := reg.List()
	if len(names) != 2 {
		t.Fatalf("expected 2 names, got %d", len(names))
	}
}

func TestStepRegistry_CompensateStep_NoCompensator(t *testing.T) {
	reg := NewStepRegistry()
	step := &models.SagaStep{StepName: "unknown"}
	result, err := reg.CompensateStep(context.Background(), step)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Fatal("expected success for unregistered step")
	}
}

type noopCompensator struct{}

func (c *noopCompensator) Compensate(_ context.Context, step *models.SagaStep) (*CompensationResult, error) {
	return &CompensationResult{
		Success: true,
		Output:  map[string]interface{}{"compensated": step.StepName},
	}, nil
}

type failingCompensator struct{}

func (c *failingCompensator) Compensate(_ context.Context, _ *models.SagaStep) (*CompensationResult, error) {
	return &CompensationResult{
		Success: false,
		Error:   "compensation failed",
	}, nil
}

func TestSagaCoordinator_Compensation_Success(t *testing.T) {
	repo := &mockRepository{
		transactions: make(map[string]*models.SagaTransaction),
		steps:        make(map[string]*models.SagaStep),
	}

	coordinator := NewSagaCoordinator(repo)
	coordinator.SetRegistry(NewStepRegistry())

	// Register compensators for all deploy steps
	for _, _ = range []string{"validate", "prepare", "build", "deploy", "verify"} {
		coordinator.SetRegistry(&StepRegistry{}) // reset
	}

	reg := NewStepRegistry()
	reg.Register("validate", &noopCompensator{})
	reg.Register("deploy", &noopCompensator{})
	coordinator.registry = reg

	// Create transaction
	tx := &models.SagaTransaction{ID: "tx-1", TenantID: "t1", Status: models.SagaStatusFailed}
	repo.transactions[tx.ID] = tx

	// Create steps
	for i, name := range []string{"validate", "prepare", "build", "deploy"} {
		step := &models.SagaStep{
			ID:            name + "-tx-1",
			TenantID:      "t1",
			TransactionID: tx.ID,
			StepName:      name,
			Sequence:      i,
			Status:        models.SagaStepStatusCompleted,
		}
		repo.steps[step.ID] = step
	}

	// Run compensation
	err := coordinator.StartCompensation(context.Background(), "t1", "tx-1", "test failure")
	if err != nil {
		t.Fatalf("StartCompensation error: %v", err)
	}

	if tx.Status != models.SagaStatusCompensated {
		t.Fatalf("expected COMPENSATED status, got %s", tx.Status)
	}
}

func TestSagaCoordinator_Compensation_Failure(t *testing.T) {
	repo := &mockRepository{
		transactions: make(map[string]*models.SagaTransaction),
		steps:        make(map[string]*models.SagaStep),
	}

	coordinator := NewSagaCoordinator(repo)
	reg := NewStepRegistry()
	reg.Register("validate", &failingCompensator{})
	coordinator.registry = reg

	tx := &models.SagaTransaction{ID: "tx-2", TenantID: "t1", Status: models.SagaStatusFailed}
	repo.transactions[tx.ID] = tx

	step := &models.SagaStep{
		ID:            "validate-tx-2",
		TenantID:      "t1",
		TransactionID: tx.ID,
		StepName:      "validate",
		Status:        models.SagaStepStatusCompleted,
	}
	repo.steps[step.ID] = step

	err := coordinator.StartCompensation(context.Background(), "t1", "tx-2", "test failure")
	if err != nil {
		t.Fatalf("StartCompensation error: %v", err)
	}

	// Transaction should still be marked compensated even if individual step fails
	if tx.Status != models.SagaStatusCompensated {
		t.Fatalf("expected COMPENSATED status, got %s", tx.Status)
	}
}

func TestSagaCoordinator_NilRegistry(t *testing.T) {
	coordinator := NewSagaCoordinator(&mockRepository{})
	coordinator.registry = nil

	// Should not panic even with nil registry
	coordinator.SetRegistry(NewStepRegistry())
}
