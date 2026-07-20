package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/change-request/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Change Requests ---

func (r *Repository) CreateRequest(ctx context.Context, req *models.ChangeRequest) error {
	req.ID = uuid.New().String()
	req.CreatedAt = time.Now().UTC()
	req.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO change_requests (id, tenant_id, title, description, type, risk_level, status, impact_scope, rollback_plan, scheduled_start, scheduled_end, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :title, :description, :type, :riskLevel, :status, :impactScope, :rollbackPlan, :scheduledStart, :scheduledEnd, :createdBy, :createdAt, :updatedAt)`,
		req)
	return err
}

func (r *Repository) GetRequestByID(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error) {
	var req models.ChangeRequest
	err := r.db.GetContext(ctx, &req,
		`SELECT * FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *Repository) ListRequests(ctx context.Context, tenantID string, filters *models.ListChangeRequestRequest) ([]models.ChangeRequest, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if filters != nil {
		if filters.Status != nil && *filters.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filters.Status)
			argIdx++
		}
		if filters.ChangeType != nil && *filters.ChangeType != "" {
			where += fmt.Sprintf(" AND type = $%d", argIdx)
			args = append(args, *filters.ChangeType)
			argIdx++
		}
		if filters.RiskLevel != nil && *filters.RiskLevel != "" {
			where += fmt.Sprintf(" AND risk_level = $%d", argIdx)
			args = append(args, *filters.RiskLevel)
			argIdx++
		}
	}
	var reqs []models.ChangeRequest
	err := r.db.SelectContext(ctx, &reqs,
		fmt.Sprintf(`SELECT * FROM change_requests %s ORDER BY created_at DESC`, where), args...)
	return reqs, err
}

func (r *Repository) UpdateRequest(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ChangeRequest, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE change_requests SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetRequestByID(ctx, id, tenantID)
}

func (r *Repository) DeleteRequest(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) UpdateRequestStatus(ctx context.Context, id string, tenantID string, status string) (*models.ChangeRequest, error) {
	return r.UpdateRequest(ctx, id, tenantID, map[string]interface{}{"status": status})
}

// --- Approvals ---

func (r *Repository) CreateApproval(ctx context.Context, approval *models.ChangeApproval) error {
	approval.ID = uuid.New().String()
	approval.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO change_approvals (id, request_id, approver_id, decision, comments, created_at)
		 VALUES (:id, :requestId, :approverId, :decision, :comments, :createdAt)`,
		approval)
	return err
}

func (r *Repository) GetApprovalChain(ctx context.Context, requestID string, tenantID string) ([]models.ChangeApproval, error) {
	var approvals []models.ChangeApproval
	err := r.db.SelectContext(ctx, &approvals,
		`SELECT a.* FROM change_approvals a
		 JOIN change_requests r ON a.request_id = r.id
		 WHERE a.request_id=$1 AND r.tenant_id=$2
		 ORDER BY a.created_at DESC`, requestID, tenantID)
	if err != nil {
		return nil, err
	}
	return approvals, nil
}

func (r *Repository) GetApproval(ctx context.Context, approvalID string, requestID string, tenantID string) (*models.ChangeApproval, error) {
	var approval models.ChangeApproval
	err := r.db.GetContext(ctx, &approval,
		`SELECT a.* FROM change_approvals a
		 JOIN change_requests r ON a.request_id = r.id
		 WHERE a.id=$1 AND a.request_id=$2 AND r.tenant_id=$3`, approvalID, requestID, tenantID)
	if err != nil {
		return nil, err
	}
	return &approval, nil
}

func (r *Repository) UpdateApprovalDecision(ctx context.Context, approvalID string, tenantID string, decision string, comments *string) (*models.ChangeApproval, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_approvals a
		 SET decision = $1, comments = $2
		 FROM change_requests r
		 WHERE a.id = $3 AND a.request_id = r.id AND r.tenant_id = $4`,
		decision, sql.NullString{Valid: comments != nil, String: getStringVal(comments)}, approvalID, tenantID)
	if err != nil {
		return nil, err
	}
	var approval models.ChangeApproval
	err = r.db.GetContext(ctx, &approval,
		`SELECT a.* FROM change_approvals a
		 JOIN change_requests r ON a.request_id = r.id
		 WHERE a.id=$1 AND r.tenant_id=$2`, approvalID, tenantID)
	if err != nil {
		return nil, err
	}
	return &approval, nil
}

// --- Executions ---

func (r *Repository) CreateExecution(ctx context.Context, execution *models.ExecutionStep) error {
	execution.ID = uuid.New().String()
	execution.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO change_executions (id, request_id, status, started_at, completed_at, result, created_at)
		 VALUES (:id, :requestId, :status, :startedAt, :completedAt, :result, :createdAt)`,
		execution)
	return err
}

func (r *Repository) GetExecutionProgress(ctx context.Context, requestID string, tenantID string) ([]models.ExecutionStep, error) {
	var steps []models.ExecutionStep
	err := r.db.SelectContext(ctx, &steps,
		`SELECT e.* FROM change_executions e
		 JOIN change_requests r ON e.request_id = r.id
		 WHERE e.request_id=$1 AND r.tenant_id=$2
		 ORDER BY e.created_at ASC`, requestID, tenantID)
	if err != nil {
		return nil, err
	}
	return steps, nil
}

func (r *Repository) UpdateExecutionStep(ctx context.Context, stepID string, tenantID string, status string, result map[string]any, startedAt *time.Time, completedAt *time.Time) (*models.ExecutionStep, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_executions e
		 SET status = $1, started_at = $2, completed_at = $3
		 FROM change_requests r
		 WHERE e.id = $4 AND e.request_id = r.id AND r.tenant_id = $5`,
		status, startedAt, completedAt, stepID, tenantID)
	if err != nil {
		return nil, err
	}
	var step models.ExecutionStep
	err = r.db.GetContext(ctx, &step,
		`SELECT e.* FROM change_executions e
		 JOIN change_requests r ON e.request_id = r.id
		 WHERE e.id=$1 AND r.tenant_id=$2`, stepID, tenantID)
	if err != nil {
		return nil, err
	}
	return &step, nil
}

// Helper: return sql.NullString from a pointer.
func getStringVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
