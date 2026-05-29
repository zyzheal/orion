package repository

import (
	"context"
	"fmt"
	"orion/approval-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type ApprovalRepository struct {
	db *sqlx.DB
}

func NewApprovalRepository(db *sqlx.DB) *ApprovalRepository {
	return &ApprovalRepository{db: db}
}

func (r *ApprovalRepository) Create(ctx context.Context, a *models.Approval) error {
	query := `
		INSERT INTO approvals (tenant_id, definition_id, resource_type, resource_id, title, status, requested_by, current_step, total_steps, required_approvals)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		a.TenantID, a.DefinitionID, a.ResourceType, a.ResourceID, a.Title,
		a.Status, a.RequestedBy, a.CurrentStep, a.TotalSteps, a.RequiredApprovals,
	).Scan(&a.ID, &a.CreatedAt)
	return err
}

func (r *ApprovalRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Approval, error) {
	var a models.Approval
	query := `SELECT * FROM approvals WHERE tenant_id = $1 AND id = $2`
	err := r.db.GetContext(ctx, &a, query, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("approval not found: %w", err)
	}
	return &a, nil
}

func (r *ApprovalRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.Approval, error) {
	var approvals []models.Approval
	query := `SELECT * FROM approvals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &approvals, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return approvals, nil
}

func (r *ApprovalRepository) UpdateStatus(ctx context.Context, id string, status models.ApprovalStatus) error {
	query := `UPDATE approvals SET status = $1, completed_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *ApprovalRepository) AdvanceStep(ctx context.Context, id string) error {
	query := `UPDATE approvals SET current_step = current_step + 1 WHERE id = $1 AND status = 'pending'`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Step operations

func (r *ApprovalRepository) CreateStep(ctx context.Context, s *models.ApprovalStep) error {
	query := `
		INSERT INTO approval_steps (approval_id, step_index, approver_id, status)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	err := r.db.QueryRowContext(ctx, query,
		s.ApprovalID, s.StepIndex, s.ApproverID, s.Status,
	).Scan(&s.ID)
	return err
}

func (r *ApprovalRepository) GetStepsByApprovalID(ctx context.Context, approvalID string) ([]models.ApprovalStep, error) {
	var steps []models.ApprovalStep
	query := `SELECT * FROM approval_steps WHERE approval_id = $1 ORDER BY step_index`
	err := r.db.SelectContext(ctx, &steps, query, approvalID)
	if err != nil {
		return nil, err
	}
	return steps, nil
}

func (r *ApprovalRepository) UpdateStepStatus(ctx context.Context, id string, status models.StepStatus, comment *string) error {
	query := `UPDATE approval_steps SET status = $1, comment = $2, acted_at = NOW() WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, status, comment, id)
	return err
}

func (r *ApprovalRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM approvals WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, id)
	return err
}

func (r *ApprovalRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM approvals WHERE tenant_id = $1`
	err := r.db.GetContext(ctx, &count, query, tenantID)
	return count, err
}
