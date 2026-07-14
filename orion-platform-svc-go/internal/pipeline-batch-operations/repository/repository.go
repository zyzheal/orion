package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/pipeline-batch-operations/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

// Repository persists batch operation request records.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// BatchOperationRequest is a persisted record of a batch operation.
type BatchOperationRequest struct {
	ID        string     `db:"id" json:"id"`
	TenantID  string     `db:"tenant_id" json:"tenantId"`
	Operation string     `db:"operation" json:"operation"`
	TargetIDs string     `db:"target_ids" json:"targetIds"`
	Status    string     `db:"status" json:"status"`
	CreatedAt time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateOperationRequest inserts a new batch operation request record.
func (r *Repository) CreateOperationRequest(ctx context.Context, op *BatchOperationRequest) error {
	op.ID = uuid.New().String()
	now := time.Now().UTC()
	op.CreatedAt = now
	op.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_batch_requests (id, tenant_id, operation, target_ids, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :operation, :targetIds, :status, :createdAt, :updatedAt)`,
		op)
	return err
}

// UpdateOperationStatus updates the status of an existing batch operation request.
func (r *Repository) UpdateOperationStatus(ctx context.Context, id string, tenantID string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_batch_requests SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, time.Now().UTC(), id, tenantID)
	return err
}

// GetOperationRequest retrieves a batch operation request by ID.
func (r *Repository) GetOperationRequest(ctx context.Context, id string, tenantID string) (*BatchOperationRequest, error) {
	var req BatchOperationRequest
	err := r.db.GetContext(ctx, &req,
		`SELECT * FROM pipeline_batch_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &req, nil
}

// ListOperationRequests lists batch operation requests for a tenant.
func (r *Repository) ListOperationRequests(ctx context.Context, tenantID string, operation *string) ([]BatchOperationRequest, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if operation != nil && *operation != "" {
		where += fmt.Sprintf(" AND operation = $%d", argIdx)
		args = append(args, *operation)
	}
	var reqs []BatchOperationRequest
	err := r.db.SelectContext(ctx, &reqs,
		fmt.Sprintf(`SELECT * FROM pipeline_batch_requests %s ORDER BY created_at DESC`, where), args...)
	return reqs, err
}

// -- helpers to satisfy the service layer --

// RecordBatchStart creates a persisted record for a batch-start operation.
func (r *Repository) RecordBatchStart(ctx context.Context, req *models.BatchStartRequest, tenantID string) (string, error) {
	op := &BatchOperationRequest{
		TenantID:  tenantID,
		Operation: "start",
		TargetIDs: idsToJSON(req.PipelineIDs),
		Status:    "processing",
	}
	if err := r.CreateOperationRequest(ctx, op); err != nil {
		return "", err
	}
	return op.ID, nil
}

// RecordBatchStop creates a persisted record for a batch-stop operation.
func (r *Repository) RecordBatchStop(ctx context.Context, req *models.BatchStopRequest, tenantID string) (string, error) {
	op := &BatchOperationRequest{
		TenantID:  tenantID,
		Operation: "stop",
		TargetIDs: idsToJSON(req.ExecutionIDs),
		Status:    "processing",
	}
	if err := r.CreateOperationRequest(ctx, op); err != nil {
		return "", err
	}
	return op.ID, nil
}

// RecordBatchDelete creates a persisted record for a batch-delete operation.
func (r *Repository) RecordBatchDelete(ctx context.Context, req *models.BatchDeleteRequest, tenantID string) (string, error) {
	op := &BatchOperationRequest{
		TenantID:  tenantID,
		Operation: "delete",
		TargetIDs: idsToJSON(req.PipelineIDs),
		Status:    "processing",
	}
	if err := r.CreateOperationRequest(ctx, op); err != nil {
		return "", err
	}
	return op.ID, nil
}

// FinalizeOperationRequest marks an operation request as completed.
func (r *Repository) FinalizeOperationRequest(ctx context.Context, id string, tenantID string) error {
	return r.UpdateOperationStatus(ctx, id, tenantID, "completed")
}

// idsToJSON converts a slice of IDs to a JSON array string for storage.
func idsToJSON(ids []string) string {
	if len(ids) == 0 {
		return "[]"
	}
	// Keep it simple: manual JSON encoding avoids importing encoding/json here.
	s := "["
	for i, id := range ids {
		if i > 0 {
			s += ","
		}
		s += `"` + id + `"`
	}
	s += "]"
	return s
}
