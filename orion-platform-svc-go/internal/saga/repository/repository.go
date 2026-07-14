package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/saga/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = errors.New("not found")
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// unixNow returns current unix seconds.
func unixNow() int64 {
	return time.Now().UTC().Unix()
}

// --- SagaTransaction ---

func (r *Repository) CreateTransaction(ctx context.Context, tx *models.SagaTransaction) error {
	tx.ID = uuid.New().String()
	now := unixNow()
	tx.CreatedAt = now
	tx.UpdatedAt = now
	tx.StartedAt = ptrInt64(now)

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO saga_transactions (id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		tx.ID, tx.TenantID, tx.SagaName, tx.RequestID, string(tx.Status),
		tx.Input, tx.Metadata, tx.CurrentStep, nullString(tx.Error),
		nullInt64(tx.StartedAt), nullInt64(tx.CompletedAt), now, now,
)
	return err
}

func (r *Repository) GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error) {
	var tx models.SagaTransaction
	err := r.db.GetContext(ctx, &tx,
		`SELECT id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at
		 FROM saga_transactions WHERE id=$1 AND tenant_id=$2`, txID, tenantID)
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *Repository) GetTransactionByRequestID(ctx context.Context, tenantID, requestID string) (*models.SagaTransaction, error) {
	var tx models.SagaTransaction
	err := r.db.GetContext(ctx, &tx,
		`SELECT id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at
		 FROM saga_transactions WHERE request_id=$1 AND tenant_id=$2
		 ORDER BY created_at DESC LIMIT 1`, requestID, tenantID)
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *Repository) UpdateTransactionStatus(ctx context.Context, tenantID, txID string, status models.SagaStatus, currentStep int, errMsg *string, completedAt *int64) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE saga_transactions SET status=$1, current_step=$2, error=$3, completed_at=$4, updated_at=$5
		 WHERE id=$6 AND tenant_id=$7`,
		string(status), currentStep, nullString(errMsg), nullInt64(completedAt), updated, txID, tenantID)
	return err
}

func (r *Repository) ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) ([]models.SagaTransaction, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var query string
	var args []interface{}

	status := ""
	if q.Status != nil {
		status = *q.Status
	}
	sagaName := ""
	if q.SagaName != nil {
		sagaName = *q.SagaName
	}

	if status != "" && sagaName != "" {
		query = `SELECT id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at
			FROM saga_transactions WHERE tenant_id=$1 AND status=$2 AND saga_name=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
		args = []interface{}{tenantID, status, sagaName, q.Limit, q.Offset}
	} else if status != "" {
		query = `SELECT id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at
			FROM saga_transactions WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, status, q.Limit, q.Offset}
	} else if sagaName != "" {
		query = `SELECT id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at
			FROM saga_transactions WHERE tenant_id=$1 AND saga_name=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, sagaName, q.Limit, q.Offset}
	} else {
		query = `SELECT id, tenant_id, saga_name, request_id, status, input, metadata, current_step, error, started_at, completed_at, created_at, updated_at
			FROM saga_transactions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		args = []interface{}{tenantID, q.Limit, q.Offset}
	}
	txs := make([]models.SagaTransaction, 0)
	err := r.db.SelectContext(ctx, &txs, query, args...)
	return txs, err
}

func (r *Repository) CountTransactions(ctx context.Context, tenantID string, status, sagaName string) (int, error) {
	var count int
	var query string
	var args []interface{}
	if status != "" && sagaName != "" {
		query = `SELECT COUNT(*) FROM saga_transactions WHERE tenant_id=$1 AND status=$2 AND saga_name=$3`
		args = []interface{}{tenantID, status, sagaName}
	} else if status != "" {
		query = `SELECT COUNT(*) FROM saga_transactions WHERE tenant_id=$1 AND status=$2`
		args = []interface{}{tenantID, status}
	} else if sagaName != "" {
		query = `SELECT COUNT(*) FROM saga_transactions WHERE tenant_id=$1 AND saga_name=$2`
		args = []interface{}{tenantID, sagaName}
	} else {
		query = `SELECT COUNT(*) FROM saga_transactions WHERE tenant_id=$1`
		args = []interface{}{tenantID}
	}
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// --- SagaStep ---

func (r *Repository) CreateStep(ctx context.Context, step *models.SagaStep) error {
	step.ID = uuid.New().String()
	now := unixNow()
	step.CreatedAt = now
	step.UpdatedAt = now
	step.StartedAt = ptrInt64(now)

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO saga_steps (id, tenant_id, transaction_id, step_name, sequence, status, input, output, error, retry_count, started_at, completed_at, compensation_started_at, compensation_completed_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
		step.ID, step.TenantID, step.TransactionID, step.StepName, step.Sequence, string(step.Status),
		step.Input, nullString(step.Output), nullString(step.Error), step.RetryCount,
		nullInt64(step.StartedAt), nullInt64(step.CompletedAt),
		nullInt64(step.CompensationStartedAt), nullInt64(step.CompensationCompletedAt),
		now, now,
)
	return err
}

func (r *Repository) GetStepsByTransaction(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error) {
	steps := make([]models.SagaStep, 0)
	err := r.db.SelectContext(ctx, &steps,
		`SELECT id, tenant_id, transaction_id, step_name, sequence, status, input, output, error, retry_count, started_at, completed_at, compensation_started_at, compensation_completed_at, created_at, updated_at
			FROM saga_steps WHERE transaction_id=$1 AND tenant_id=$2 ORDER BY sequence`, txID, tenantID)
	return steps, err
}

func (r *Repository) GetStep(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error) {
	var step models.SagaStep
	err := r.db.GetContext(ctx, &step,
		`SELECT id, tenant_id, transaction_id, step_name, sequence, status, input, output, error, retry_count, started_at, completed_at, compensation_started_at, compensation_completed_at, created_at, updated_at
			FROM saga_steps WHERE id=$1 AND tenant_id=$2`, stepID, tenantID)
	if err != nil {
		return nil, err
	}
	return &step, nil
}

func (r *Repository) UpdateStepStatus(ctx context.Context, tenantID, stepID string, status models.SagaStepStatus, errMsg *string, output *string, retryCount int, completedAt *int64) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE saga_steps SET status=$1, error=$2, output=$3, retry_count=$4, completed_at=$5, updated_at=$6
			WHERE id=$7 AND tenant_id=$8`,
		string(status), nullString(errMsg), nullString(output), retryCount, nullInt64(completedAt), updated, stepID, tenantID)
	return err
}

func (r *Repository) UpdateStepCompensation(ctx context.Context, tenantID, stepID string, status models.SagaStepStatus, compensatedAt *int64) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE saga_steps SET status=$1, compensation_started_at=$2, compensation_completed_at=$3, updated_at=$4
			WHERE id=$5 AND tenant_id=$6`,
		string(status), nullInt64(compensatedAt), nullInt64(compensatedAt), updated, stepID, tenantID)
	return err
}

func (r *Repository) GetNextPendingStep(ctx context.Context, tenantID, txID string, currentStep int) (*models.SagaStep, error) {
	var step models.SagaStep
	err := r.db.GetContext(ctx, &step,
		`SELECT id, tenant_id, transaction_id, step_name, sequence, status, input, output, error, retry_count, started_at, completed_at, compensation_started_at, compensation_completed_at, created_at, updated_at
			FROM saga_steps WHERE transaction_id=$1 AND tenant_id=$2 AND sequence=$3 AND status='pending'
			ORDER BY sequence LIMIT 1`, txID, tenantID, currentStep)
	if err != nil {
		return nil, err
	}
	return &step, nil
}

// --- helpers ---

func ptrInt64(v int64) *int64 {
	return &v
}

func nullString(s *string) *string {
	return s
}

func nullInt64(i *int64) *int64 {
	return i
}

var _ = fmt.Sprintf
