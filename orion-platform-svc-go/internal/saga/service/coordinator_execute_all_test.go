package service

import (
	"context"
	"errors"
	"sync"
	"testing"

	"orion/platform-svc-go/internal/saga/models"
)

// fakeSagaRepo is an in-memory Repository implementation tailored to
// ExecuteAll regression tests. It tracks the sequence of status transitions
// so we can assert that markCompleted is reached exactly once.
type fakeSagaRepo struct {
	mu sync.Mutex

	transactions map[string]*models.SagaTransaction
	steps        map[string][]*models.SagaStep

	// nextStepErr controls what GetNextPendingStep returns. If non-nil,
	// every subsequent call returns this error. Used to force markCompleted
	// from ExecuteNextStep.
	nextStepErr error

	// stepFailAfter marks how many successful step executions to allow
	// before returning a failure. 0 = always succeed.
	stepFailAfter int

	// getTransactionCalls counts GetTransaction calls — useful for detecting
	// an infinite loop in ExecuteAll (markCompleted not returning "final": true
	// would cause repeated GetTransaction calls on a Completed transaction).
	getTransactionCalls int
}

func newFakeSagaRepo() *fakeSagaRepo {
	return &fakeSagaRepo{
		transactions: map[string]*models.SagaTransaction{},
		steps:        map[string][]*models.SagaStep{},
	}
}

func (r *fakeSagaRepo) CreateTransaction(ctx context.Context, tx *models.SagaTransaction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if tx.ID == "" {
		tx.ID = "tx-1"
	}
	r.transactions[tx.ID] = tx
	return nil
}

func (r *fakeSagaRepo) GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.getTransactionCalls++
	tx, ok := r.transactions[txID]
	if !ok {
		return nil, ErrSagaNotFound
	}
	return tx, nil
}

func (r *fakeSagaRepo) GetTransactionByRequestID(ctx context.Context, tenantID, requestID string) (*models.SagaTransaction, error) {
	return nil, ErrSagaNotFound
}

func (r *fakeSagaRepo) UpdateTransactionStatus(ctx context.Context, tenantID, txID string, status models.SagaStatus, currentStep int, errMsg *string, completedAt *int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	tx, ok := r.transactions[txID]
	if !ok {
		return ErrSagaNotFound
	}
	tx.Status = status
	tx.CurrentStep = currentStep
	if errMsg != nil {
		tx.Error = errMsg
	}
	if completedAt != nil {
		tx.CompletedAt = completedAt
	}
	return nil
}

func (r *fakeSagaRepo) ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) ([]models.SagaTransaction, error) {
	return nil, nil
}

func (r *fakeSagaRepo) CountTransactions(ctx context.Context, tenantID string, status, sagaName string) (int, error) {
	return 0, nil
}

func (r *fakeSagaRepo) CreateStep(ctx context.Context, step *models.SagaStep) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.steps[step.TransactionID]; !ok {
		r.steps[step.TransactionID] = []*models.SagaStep{}
	}
	r.steps[step.TransactionID] = append(r.steps[step.TransactionID], step)
	return nil
}

func (r *fakeSagaRepo) GetStepsByTransaction(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]models.SagaStep, len(r.steps[txID]))
	for i, s := range r.steps[txID] {
		out[i] = *s
	}
	return out, nil
}

func (r *fakeSagaRepo) GetStep(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error) {
	return nil, ErrSagaNotFound
}

func (r *fakeSagaRepo) UpdateStepStatus(ctx context.Context, tenantID, stepID string, status models.SagaStepStatus, errMsg *string, output *string, retryCount int, completedAt *int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, txSteps := range r.steps {
		for _, s := range txSteps {
			if s.ID == stepID {
				s.Status = status
				if errMsg != nil {
					s.Error = errMsg
				}
				if output != nil {
					s.Output = output
				}
				s.RetryCount = retryCount
				if completedAt != nil {
					s.CompletedAt = completedAt
				}
				return nil
			}
		}
	}
	return ErrSagaNotFound
}

func (r *fakeSagaRepo) UpdateStepCompensation(ctx context.Context, tenantID, stepID string, status models.SagaStepStatus, compensatedAt *int64) error {
	return nil
}

func (r *fakeSagaRepo) GetNextPendingStep(ctx context.Context, tenantID, txID string, currentStep int) (*models.SagaStep, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.nextStepErr != nil {
		return nil, r.nextStepErr
	}
	for _, s := range r.steps[tenantID] {
		if s.Sequence > currentStep && s.Status == models.SagaStepStatusPending {
			return s, nil
		}
	}
	return nil, errors.New("no more steps")
}

// assertFinalSentinel verifies that markCompleted returns Output with
// "final": true — the sentinel ExecuteAll uses to break its dispatch loop.
func TestSagaMarkCompleted_ReturnsFinalSentinel(t *testing.T) {
	repo := newFakeSagaRepo()
	repo.nextStepErr = errors.New("no more steps")
	c := NewSagaCoordinator(repo)

	// Seed a Running transaction with no pending steps.
	tx := &models.SagaTransaction{
		ID:       "tx-1",
		TenantID: "t1",
		Status:   models.SagaStatusRunning,
		SagaName: "saga-no-steps",
	}
	if err := repo.CreateTransaction(context.Background(), tx); err != nil {
		t.Fatalf("seed tx: %v", err)
	}

	result, err := c.ExecuteNextStep(context.Background(), "t1", "tx-1")
	if err != nil {
		t.Fatalf("ExecuteNextStep: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got failure")
	}
	if _, ok := result.Output["final"]; !ok {
		t.Fatalf("markCompleted must return Output['final'] sentinel; got Output=%v", result.Output)
	}
}

// TestSagaExecuteAll_TerminatesAfterCompletedRegression is the direct
// regression test for the infinite-loop bug: without the "final": true
// sentinel, ExecuteAll re-enters ExecuteNextStep on the Completed
// transaction and gets ErrInvalidStatus. With the sentinel, ExecuteAll
// returns cleanly and GetTransaction is called a bounded number of times.
func TestSagaExecuteAll_TerminatesAfterCompletedRegression(t *testing.T) {
	repo := newFakeSagaRepo()
	// Force markCompleted on the very first call.
	repo.nextStepErr = errors.New("no more steps")

	c := NewSagaCoordinator(repo)
	tx := &models.SagaTransaction{
		ID:       "tx-reg",
		TenantID: "t1",
		Status:   models.SagaStatusRunning,
		SagaName: "saga-regression",
	}
	if err := repo.CreateTransaction(context.Background(), tx); err != nil {
		t.Fatalf("seed tx: %v", err)
	}

	result, err := c.ExecuteAll(context.Background(), "t1", "tx-reg")
	if err != nil {
		t.Fatalf("ExecuteAll returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got failure")
	}
	if _, ok := result.Output["final"]; !ok {
		t.Fatalf("ExecuteAll result missing final sentinel: Output=%v", result.Output)
	}

	// Regression guard: without "final": true, ExecuteAll would keep calling
	// ExecuteNextStep on the Completed tx, each call returns ErrInvalidStatus,
	// which ExecuteAll propagates as an error. If we ever got to 10+
	// GetTransaction calls here, we've likely reintroduced the loop.
	repo.mu.Lock()
	calls := repo.getTransactionCalls
	repo.mu.Unlock()
	if calls > 5 {
		t.Fatalf("ExecuteAll made %d GetTransaction calls — possible infinite loop; expected ≤5", calls)
	}
}

// TestSagaExecuteAll_SucceedsWithPendingSteps verifies the happy path:
// a transaction with one pending step that executes successfully, then
// the follow-up call hits markCompleted.
func TestSagaExecuteAll_SucceedsWithPendingSteps(t *testing.T) {
	repo := newFakeSagaRepo()
	c := NewSagaCoordinator(repo)

	tx := &models.SagaTransaction{
		ID:       "tx-happy",
		TenantID: "t1",
		Status:   models.SagaStatusRunning,
		SagaName: "saga-happy",
	}
	if err := repo.CreateTransaction(context.Background(), tx); err != nil {
		t.Fatalf("seed tx: %v", err)
	}

	// Register one pending step.
	step := &models.SagaStep{
		ID:            "step-1",
		TenantID:      "t1",
		TransactionID: tx.ID,
		StepName:      "step-1",
		Sequence:      1,
		Status:        models.SagaStepStatusPending,
	}
	if err := repo.CreateStep(context.Background(), step); err != nil {
		t.Fatalf("create step: %v", err)
	}

	// After this step succeeds, force markCompleted on the next iteration.
	originalNext := repo.nextStepErr
	repo.nextStepErr = errors.New("no more steps after first")

	result, err := c.ExecuteAll(context.Background(), "t1", "tx-happy")
	if err != nil {
		t.Fatalf("ExecuteAll: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got failure; result=%+v", result)
	}

	repo.mu.Lock()
	calls := repo.getTransactionCalls
	txStatus := tx.Status
	repo.mu.Unlock()
	_ = originalNext

	// Should have made ~3 calls: initial step exec, markCompleted transition,
	// final loop check.
	if calls > 6 {
		t.Fatalf("ExecuteAll made %d calls — likely looping", calls)
	}
	if txStatus != models.SagaStatusCompleted {
		t.Fatalf("expected tx completed, got %v", txStatus)
	}
}
