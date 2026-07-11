package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"

	"orion/incident-svc-go/internal/changerequest/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Change Requests ====================

func (r *Repository) Create(ctx context.Context, d *models.ChangeRequest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_request_rfc (id, tenant_id, title, description, change_type, risk_level, impact_scope, rollback_plan, status, scheduled_start, scheduled_end, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		d.ID, d.TenantID, d.Title, d.Description, d.ChangeType, d.RiskLevel, d.ImpactScope, d.RollbackPlan, d.Status, d.ScheduledStart, d.ScheduledEnd, d.CreatedBy)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int, filters map[string]string) ([]models.ChangeRequest, error) {
	conditions := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	idx := 2

	for _, field := range []string{"status", "change_type", "risk_level"} {
		if v, ok := filters[field]; ok && v != "" {
			conditions = append(conditions, fmt.Sprintf("%s=$%d", field, idx))
			args = append(args, v)
			idx++
		}
	}

	where := strings.Join(conditions, " AND ")
	args = append(args, offset, limit)
	query := fmt.Sprintf(`SELECT * FROM change_request_rfc WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d`, where, idx, idx+1)

	var items []models.ChangeRequest
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	var d models.ChangeRequest
	err := r.db.GetContext(ctx, &d, `SELECT * FROM change_request_rfc WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Title != nil { setClauses = append(setClauses, fmt.Sprintf("title=$%d", idx)); args = append(args, *req.Title); idx++ }
	if req.Description != nil { setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx)); args = append(args, *req.Description); idx++ }
	if req.ChangeType != nil { setClauses = append(setClauses, fmt.Sprintf("change_type=$%d", idx)); args = append(args, *req.ChangeType); idx++ }
	if req.RiskLevel != nil { setClauses = append(setClauses, fmt.Sprintf("risk_level=$%d", idx)); args = append(args, *req.RiskLevel); idx++ }
	if req.ImpactScope != nil { setClauses = append(setClauses, fmt.Sprintf("impact_scope=$%d", idx)); args = append(args, *req.ImpactScope); idx++ }
	if req.RollbackPlan != nil { setClauses = append(setClauses, fmt.Sprintf("rollback_plan=$%d", idx)); args = append(args, *req.RollbackPlan); idx++ }
	if req.Status != nil { setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx)); args = append(args, *req.Status); idx++ }
	if req.ScheduledStart != nil { setClauses = append(setClauses, fmt.Sprintf("scheduled_start=$%d", idx)); args = append(args, *req.ScheduledStart); idx++ }
	if req.ScheduledEnd != nil { setClauses = append(setClauses, fmt.Sprintf("scheduled_end=$%d", idx)); args = append(args, *req.ScheduledEnd); idx++ }

	if len(setClauses) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE change_request_rfc SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)

	var d models.ChangeRequest
	err := r.db.GetContext(ctx, &d, query, args...)
	return &d, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM change_request_rfc WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Approvals ====================

func (r *Repository) CreateApproval(ctx context.Context, a *models.Approval) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_request_approvals (id, change_request_id, approver_id, status)
		 VALUES ($1,$2,$3,$4)`,
		a.ID, a.ChangeRequestID, a.ApproverID, a.Status)
	return err
}

func (r *Repository) ListApprovals(ctx context.Context, changeRequestID string) ([]models.Approval, error) {
	var items []models.Approval
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_request_approvals WHERE change_request_id=$1 ORDER BY created_at ASC`, changeRequestID)
	return items, err
}

func (r *Repository) GetApproval(ctx context.Context, id string) (*models.Approval, error) {
	var a models.Approval
	err := r.db.GetContext(ctx, &a, `SELECT * FROM change_request_approvals WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) UpdateApproval(ctx context.Context, id, status string, comment *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_request_approvals SET status=$1, comment=$2, responded_at=NOW() WHERE id=$3`,
		status, comment, id)
	return err
}

// ==================== Execution Steps ====================

func (r *Repository) CreateExecutionSteps(ctx context.Context, steps []models.ExecutionStep) error {
	for _, step := range steps {
		_, err := r.db.ExecContext(ctx,
			`INSERT INTO change_request_execution_steps (id, change_request_id, step_name, step_order, status)
			 VALUES ($1,$2,$3,$4,$5)`,
			step.ID, step.ChangeRequestID, step.StepName, step.StepOrder, step.Status)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) ListExecutionSteps(ctx context.Context, changeRequestID string) ([]models.ExecutionStep, error) {
	var items []models.ExecutionStep
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_request_execution_steps WHERE change_request_id=$1 ORDER BY step_order ASC`, changeRequestID)
	return items, err
}

func (r *Repository) GetExecutionStep(ctx context.Context, stepID string) (*models.ExecutionStep, error) {
	var s models.ExecutionStep
	err := r.db.GetContext(ctx, &s, `SELECT * FROM change_request_execution_steps WHERE id=$1`, stepID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateExecutionStep(ctx context.Context, stepID string, req *models.UpdateExecutionStepRequest) (*models.ExecutionStep, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx))
		args = append(args, *req.Status)
		idx++
		if *req.Status == "running" {
			setClauses = append(setClauses, "started_at=NOW()")
		}
		if *req.Status == "completed" || *req.Status == "failed" {
			setClauses = append(setClauses, "completed_at=NOW()")
		}
	}

	if len(setClauses) == 0 {
		return r.GetExecutionStep(ctx, stepID)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, stepID)

	query := fmt.Sprintf("UPDATE change_request_execution_steps SET %s WHERE id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx)

	var s models.ExecutionStep
	err := r.db.GetContext(ctx, &s, query, args...)
	return &s, err
}