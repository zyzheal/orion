package service

import (
	"context"
	"encoding/json"
	"errors"

	"orion/platform-svc-go/internal/saga/models"
)

var (
	ErrTransactionLogNotFound = errors.New("transaction log entry not found")
)

// TransactionLog provides state persistence and query capabilities for saga transactions.
//
// Mirrors TS TransactionLog, providing:
// - Transaction state recording
// - Transaction recovery support
// - Transaction query with filters
// - Step execution recording
type TransactionLog struct {
	repo Repository
}

// NewTransactionLog creates a new TransactionLog backed by Postgres.
func NewTransactionLog(repo Repository) *TransactionLog {
	return &TransactionLog{repo: repo}
}

// StartRecord creates a new transaction log entry in PENDING state.
func (tl *TransactionLog) StartRecord(ctx context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error) {
	inputJSON, err := json.Marshal(req.Input)
	if err != nil {
		return nil, err
	}
	tx := &models.SagaTransaction{
		TenantID:  tenantID,
		SagaName:  req.SagaName,
		Status:    models.SagaStatusPending,
		Input:     string(inputJSON),
		Metadata:  "{}",
		RequestID: req.SagaName,
	}
	if req.Metadata != nil {
		if b, err := json.Marshal(req.Metadata); err == nil {
			tx.Metadata = string(b)
		}
	}
	err = tl.repo.CreateTransaction(ctx, tx)
	if err != nil {
		return nil, err
	}
	return tx, nil
}

// GetRecord retrieves a transaction log entry by ID.
func (tl *TransactionLog) GetRecord(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error) {
	tx, err := tl.repo.GetTransaction(ctx, tenantID, txID)
	if err != nil {
		return nil, ErrTransactionLogNotFound
	}
	return tx, nil
}

// GetRecordByRequestId retrieves a transaction by request_id (for idempotency).
func (tl *TransactionLog) GetRecordByRequestId(ctx context.Context, tenantID, requestId string) (*models.SagaTransaction, error) {
	tx, err := tl.repo.GetTransactionByRequestID(ctx, tenantID, requestId)
	if err != nil {
		return nil, ErrTransactionLogNotFound
	}
	return tx, nil
}

// DeleteRecord soft-deletes a transaction log entry by marking it failed.
func (tl *TransactionLog) DeleteRecord(ctx context.Context, tenantID, txID string) error {
	now := unixNow()
	return tl.repo.UpdateTransactionStatus(ctx, tenantID, txID, models.SagaStatusFailed, 0,
		ptrString("deleted via TransactionLog"), &now)
}

// RecordStepStart records that a step execution has started.
func (tl *TransactionLog) RecordStepStart(ctx context.Context, tenantID, stepID string) error {
	now := unixNow()
	return tl.repo.UpdateStepStatus(ctx, tenantID, stepID, models.SagaStepStatusExecuting, nil, nil, 0, &now)
}

// RecordStepSuccess records step completion with output.
func (tl *TransactionLog) RecordStepSuccess(ctx context.Context, tenantID, stepID string, output map[string]interface{}, retryCount int) error {
	outputJSON, _ := json.Marshal(output)
	now := unixNow()
	return tl.repo.UpdateStepStatus(ctx, tenantID, stepID, models.SagaStepStatusCompleted, nil, ptrString(string(outputJSON)), retryCount, &now)
}

// RecordStepFailure records step failure with error.
func (tl *TransactionLog) RecordStepFailure(ctx context.Context, tenantID, stepID string, errMsg string, retryCount int) error {
	now := unixNow()
	return tl.repo.UpdateStepStatus(ctx, tenantID, stepID, models.SagaStepStatusFailed, ptrString(errMsg), nil, retryCount, &now)
}

// RecordCompensation records compensation execution for a step.
func (tl *TransactionLog) RecordCompensation(ctx context.Context, tenantID, stepID string, compensated bool) error {
	now := unixNow()
	if compensated {
		return tl.repo.UpdateStepCompensation(ctx, tenantID, stepID, models.SagaStepStatusCompensated, &now)
	}
	return tl.repo.UpdateStepCompensation(ctx, tenantID, stepID, models.SagaStepStatusCompensationFailed, &now)
}

// ListRecords queries transaction log entries with optional filters.
func (tl *TransactionLog) ListRecords(ctx context.Context, tenantID string, q models.ListSagasQuery) (*models.SagaListResponse, error) {
	txs, err := tl.repo.ListTransactions(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	status := ""
	if q.Status != nil {
		status = *q.Status
	}
	sagaName := ""
	if q.SagaName != nil {
		sagaName = *q.SagaName
	}
	total, _ := tl.repo.CountTransactions(ctx, tenantID, status, sagaName)
	return &models.SagaListResponse{
		Data:  txs,
		Total: total,
	}, nil
}

// GetSteps retrieves all step executions for a transaction.
func (tl *TransactionLog) GetSteps(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error) {
	return tl.repo.GetStepsByTransaction(ctx, tenantID, txID)
}

// FindRunningTransactions finds all transactions still in RUNNING status.
// Used during startup recovery to identify orphaned sagas.
func (tl *TransactionLog) FindRunningTransactions(ctx context.Context, tenantID string) ([]models.SagaTransaction, error) {
	q := models.ListSagasQuery{Status: ptrString("running"), Limit: 100}
	return tl.repo.ListTransactions(ctx, tenantID, q)
}

// RebuildFromRepository reconstructs the transaction log from the saga_transactions table.
func (tl *TransactionLog) RebuildFromRepository(ctx context.Context, tenantID string) ([]models.SagaTransaction, error) {
	return tl.FindRunningTransactions(ctx, tenantID)
}

// --- helpers ---

func ptrString(s string) *string {
	return &s
}
