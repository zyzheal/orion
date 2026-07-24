package repository

import (
	"context"
	"fmt"
	"orion/platform-svc-go/internal/approval/models"

	"github.com/jmoiron/sqlx"
)

type ApprovalRepository struct {
	db *sqlx.DB
}

func NewApprovalRepository(db *sqlx.DB) *ApprovalRepository {
	return &ApprovalRepository{db: db}
}

// RunInTx executes fn within a database transaction.
func (r *ApprovalRepository) RunInTx(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Create inserts a new approval record.
func (r *ApprovalRepository) Create(ctx context.Context, a *models.Approval) error {
	query := `
		INSERT INTO approvals (tenant_id, definition_id, resource_type, resource_id, title, status, requested_by, current_step, total_steps, required_approvals, level_config)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		a.TenantID, a.DefinitionID, a.ResourceType, a.ResourceID, a.Title,
		a.Status, a.RequestedBy, a.CurrentStep, a.TotalSteps, a.RequiredApprovals, a.LevelConfigs,
	).Scan(&a.ID, &a.CreatedAt)
	return err
}

// GetByID returns an approval by tenant and ID.
func (r *ApprovalRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Approval, error) {
	var a models.Approval
	query := `SELECT * FROM approvals WHERE tenant_id = $1 AND id = $2`
	err := r.db.GetContext(ctx, &a, query, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("approval not found: %w", err)
	}
	return &a, nil
}

// GetByIDForUpdate returns an approval by tenant and ID with FOR UPDATE lock.
// Used within transactions to prevent race conditions.
func (r *ApprovalRepository) GetByIDForUpdate(ctx context.Context, tx *sqlx.Tx, tenantID, id string) (*models.Approval, error) {
	var a models.Approval
	query := `SELECT * FROM approvals WHERE tenant_id = $1 AND id = $2 FOR UPDATE`
	err := tx.GetContext(ctx, &a, query, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("approval not found: %w", err)
	}
	return &a, nil
}

// ListByTenant returns paginated approvals for a tenant.
func (r *ApprovalRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.Approval, error) {
	var approvals []models.Approval
	query := `SELECT * FROM approvals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &approvals, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return approvals, nil
}

// FindByResource returns approvals matching a resource type and ID.
func (r *ApprovalRepository) FindByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]models.Approval, error) {
	var approvals []models.Approval
	query := `SELECT * FROM approvals WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &approvals, query, tenantID, resourceType, resourceID)
	if err != nil {
		return nil, err
	}
	return approvals, nil
}

// FindPendingByUser returns pending approvals where the user has a pending step.
func (r *ApprovalRepository) FindPendingByUser(ctx context.Context, tenantID, userID string) ([]models.Approval, error) {
	var approvals []models.Approval
	query := `
		SELECT DISTINCT a.* FROM approvals a
		INNER JOIN approval_steps s ON s.approval_id = a.id
		WHERE a.tenant_id = $1
		  AND a.status = 'pending'
		  AND s.approver_id = $2
		  AND s.status IN ('pending', 'waiting')
		ORDER BY a.created_at DESC
	`
	err := r.db.SelectContext(ctx, &approvals, query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return approvals, nil
}

// UpdateStatus updates the status and completed_at of an approval, scoped to tenant.
func (r *ApprovalRepository) UpdateStatus(ctx context.Context, tenantID, id string, status models.ApprovalStatus) error {
	query := `UPDATE approvals SET status = $1, completed_at = NOW() WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

// UpdateStatusTx updates the status and completed_at of an approval within a transaction.
func (r *ApprovalRepository) UpdateStatusTx(ctx context.Context, tx *sqlx.Tx, tenantID, id string, status models.ApprovalStatus) error {
	query := `UPDATE approvals SET status = $1, completed_at = NOW() WHERE id = $2 AND tenant_id = $3`
	_, err := tx.ExecContext(ctx, query, status, id, tenantID)
	return err
}

// AdvanceStep increments the current_step counter for a pending approval.
func (r *ApprovalRepository) AdvanceStep(ctx context.Context, id string) error {
	query := `UPDATE approvals SET current_step = current_step + 1 WHERE id = $1 AND status = 'pending'`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// AdvanceStepTx increments the current_step counter within a transaction.
func (r *ApprovalRepository) AdvanceStepTx(ctx context.Context, tx *sqlx.Tx, id string) error {
	query := `UPDATE approvals SET current_step = current_step + 1 WHERE id = $1 AND status = 'pending'`
	_, err := tx.ExecContext(ctx, query, id)
	return err
}

// GetStats returns aggregate approval statistics for a tenant.
func (r *ApprovalRepository) GetStats(ctx context.Context, tenantID string) (*models.ApprovalStats, error) {
	var stats models.ApprovalStats
	query := `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status = 'pending') AS pending,
			COUNT(*) FILTER (WHERE status = 'approved') AS approved,
			COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
			COUNT(*) FILTER (WHERE status = 'canceled') AS canceled
		FROM approvals
		WHERE tenant_id = $1
	`
	err := r.db.GetContext(ctx, &stats, query, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// Delete removes an approval by tenant and ID.
func (r *ApprovalRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM approvals WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, id)
	return err
}

// Count returns the total number of approvals for a tenant.
func (r *ApprovalRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM approvals WHERE tenant_id = $1`
	err := r.db.GetContext(ctx, &count, query, tenantID)
	return count, err
}

// ========== Step Operations ==========

// CreateStep inserts a new approval step.
func (r *ApprovalRepository) CreateStep(ctx context.Context, s *models.ApprovalStep) error {
	query := `
		INSERT INTO approval_steps (approval_id, step_index, level, approver_id, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	err := r.db.QueryRowContext(ctx, query,
		s.ApprovalID, s.StepIndex, s.Level, s.ApproverID, s.Status,
	).Scan(&s.ID)
	return err
}

// GetStepsByApprovalID returns all steps for an approval, ordered by step_index.
func (r *ApprovalRepository) GetStepsByApprovalID(ctx context.Context, approvalID string) ([]models.ApprovalStep, error) {
	var steps []models.ApprovalStep
	query := `SELECT * FROM approval_steps WHERE approval_id = $1 ORDER BY step_index`
	err := r.db.SelectContext(ctx, &steps, query, approvalID)
	if err != nil {
		return nil, err
	}
	return steps, nil
}

// GetStepsByApprovalIDTx returns all steps for an approval within a transaction.
func (r *ApprovalRepository) GetStepsByApprovalIDTx(ctx context.Context, tx *sqlx.Tx, approvalID string) ([]models.ApprovalStep, error) {
	var steps []models.ApprovalStep
	query := `SELECT * FROM approval_steps WHERE approval_id = $1 ORDER BY step_index`
	err := tx.SelectContext(ctx, &steps, query, approvalID)
	if err != nil {
		return nil, err
	}
	return steps, nil
}

// FindStepByApprovalAndApprover returns the first matching step for a given approval and approver.
func (r *ApprovalRepository) FindStepByApprovalAndApprover(ctx context.Context, approvalID, approverID string) (*models.ApprovalStep, error) {
	var step models.ApprovalStep
	query := `SELECT * FROM approval_steps WHERE approval_id = $1 AND approver_id = $2 ORDER BY step_index LIMIT 1`
	err := r.db.GetContext(ctx, &step, query, approvalID, approverID)
	if err != nil {
		return nil, fmt.Errorf("step not found for approver %s: %w", approverID, err)
	}
	return &step, nil
}

// FindStepByApprovalAndApproverTx returns the first matching step within a transaction.
func (r *ApprovalRepository) FindStepByApprovalAndApproverTx(ctx context.Context, tx *sqlx.Tx, approvalID, approverID string) (*models.ApprovalStep, error) {
	var step models.ApprovalStep
	query := `SELECT * FROM approval_steps WHERE approval_id = $1 AND approver_id = $2 ORDER BY step_index LIMIT 1`
	err := tx.GetContext(ctx, &step, query, approvalID, approverID)
	if err != nil {
		return nil, fmt.Errorf("step not found for approver %s: %w", approverID, err)
	}
	return &step, nil
}

// UpdateStepStatus updates a step's status, comment, and acted_at timestamp.
func (r *ApprovalRepository) UpdateStepStatus(ctx context.Context, id string, status models.StepStatus, comment *string) error {
	query := `UPDATE approval_steps SET status = $1, comment = $2, acted_at = NOW() WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, status, comment, id)
	return err
}

// UpdateStepStatusTx updates a step's status within a transaction.
func (r *ApprovalRepository) UpdateStepStatusTx(ctx context.Context, tx *sqlx.Tx, id string, status models.StepStatus, comment *string) error {
	query := `UPDATE approval_steps SET status = $1, comment = $2, acted_at = NOW() WHERE id = $3`
	_, err := tx.ExecContext(ctx, query, status, comment, id)
	return err
}

// ActivateWaitingSteps transitions all 'waiting' steps for an approval to 'pending'.
// Used in serial mode when advancing to the next level.
func (r *ApprovalRepository) ActivateWaitingSteps(ctx context.Context, approvalID string) error {
	query := `UPDATE approval_steps SET status = 'pending' WHERE approval_id = $1 AND status = 'waiting'`
	_, err := r.db.ExecContext(ctx, query, approvalID)
	return err
}

// ActivateWaitingStepsTx transitions waiting steps to pending within a transaction.
func (r *ApprovalRepository) ActivateWaitingStepsTx(ctx context.Context, tx *sqlx.Tx, approvalID string) error {
	query := `UPDATE approval_steps SET status = 'pending' WHERE approval_id = $1 AND status = 'waiting'`
	_, err := tx.ExecContext(ctx, query, approvalID)
	return err
}

// ========== Delegate / Reassign ==========

// DelegateStep transfers a pending step from one approver to another.
// It updates the step's approver_id and records the delegation.
func (r *ApprovalRepository) DelegateStepTx(ctx context.Context, tx *sqlx.Tx, approvalID, fromUserID, toUserID string) (*models.ApprovalStep, error) {
	var step models.ApprovalStep
	query := `SELECT * FROM approval_steps WHERE approval_id = $1 AND approver_id = $2 AND status = 'pending' ORDER BY step_index LIMIT 1`
	err := tx.GetContext(ctx, &step, query, approvalID, fromUserID)
	if err != nil {
		return nil, fmt.Errorf("step not found for approver %s: %w", fromUserID, err)
	}
	updateQuery := `UPDATE approval_steps SET approver_id = $1 WHERE id = $2`
	_, err = tx.ExecContext(ctx, updateQuery, toUserID, step.ID)
	if err != nil {
		return nil, err
	}
	step.ApproverID = &toUserID
	return &step, nil
}

// ReassignStep transfers a pending step from one approver to another (same as delegate but with audit reason).
// In the current schema, delegate and reassign are equivalent; the difference is in the audit trail.
func (r *ApprovalRepository) ReassignStepTx(ctx context.Context, tx *sqlx.Tx, approvalID, fromUserID, toUserID string) (*models.ApprovalStep, error) {
	return r.DelegateStepTx(ctx, tx, approvalID, fromUserID, toUserID)
}

// ========== History / Timeline ==========

// GetHistory returns the approval timeline as HistoryEvents derived from steps.
func (r *ApprovalRepository) GetHistory(ctx context.Context, approvalID string) ([]models.HistoryEvent, error) {
	steps, err := r.GetStepsByApprovalID(ctx, approvalID)
	if err != nil {
		return nil, err
	}
	events := make([]models.HistoryEvent, 0, len(steps))
	for _, s := range steps {
		level := s.Level
		stepIdx := s.StepIndex
		eventType := string(s.Status)
		// Map "waiting"/"pending" to "created" for history
		if s.Status == models.StepWaiting {
			eventType = "created"
		}
		approver := ""
		if s.ApproverID != nil {
			approver = *s.ApproverID
		}
		comment := ""
		if s.Comment != nil {
			comment = *s.Comment
		}
		timestamp := s.ActedAt
		if timestamp == nil {
			// Use the step index as a proxy; in production we'd store an explicit created_at per step
			continue // skip pending steps with no acted_at from timeline
		}
		events = append(events, models.HistoryEvent{
			EventType:  eventType,
			ActorID:    approver,
			Comment:    comment,
			Timestamp:  *timestamp,
			StepIndex:  &stepIdx,
			LevelIndex: &level,
		})
	}
	return events, nil
}

// ========== Trend / Statistics ==========

// GetTrend returns daily approval counts for a tenant within a date range.
func (r *ApprovalRepository) GetTrend(ctx context.Context, tenantID, startDate, endDate string) ([]models.ApprovalTrend, error) {
	var trends []models.ApprovalTrend
	query := `
		SELECT
			date_trunc('day', created_at)::date::text AS date,
			COUNT(*) AS submitted,
			COUNT(*) FILTER (WHERE status = 'approved') AS approved,
			COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
			COUNT(*) FILTER (WHERE status = 'canceled') AS canceled
		FROM approvals
		WHERE tenant_id = $1
		  AND date_trunc('day', created_at)::date >= $2::date
		  AND date_trunc('day', created_at)::date <= $3::date
		GROUP BY date_trunc('day', created_at)::date
		ORDER BY date
	`
	err := r.db.SelectContext(ctx, &trends, query, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	return trends, nil
}

// GetStatistics returns aggregate statistics for a tenant within a date range.
func (r *ApprovalRepository) GetStatistics(ctx context.Context, tenantID, startDate, endDate string) (*models.ApprovalStatistics, error) {
	var stats models.ApprovalStatistics
	query := `
		SELECT
			COUNT(*) AS total_submitted,
			COUNT(*) FILTER (WHERE status = 'approved') AS total_approved,
			COUNT(*) FILTER (WHERE status = 'rejected') AS total_rejected,
			COUNT(*) FILTER (WHERE status = 'canceled') AS total_canceled,
			AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) AS avg_duration_hours
		FROM approvals
		WHERE tenant_id = $1
		  AND date_trunc('day', created_at)::date >= $2::date
		  AND date_trunc('day', created_at)::date <= $3::date
	`
	err := r.db.GetContext(ctx, &stats, query, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	if stats.TotalSubmitted > 0 {
		stats.ApprovalRate = float64(stats.TotalApproved) / float64(stats.TotalSubmitted)
	}
	return &stats, nil
}

// ========== Templates ==========

// CreateTemplate inserts a new template.
func (r *ApprovalRepository) CreateTemplate(ctx context.Context, t *models.ApprovalTemplate) error {
	query := `
		INSERT INTO approval_templates (tenant_id, name, description, resource_type, levels, mode, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		t.TenantID, t.Name, t.Description, t.ResourceType, t.Levels, t.Mode, t.IsDefault,
	).Scan(&t.ID, &t.CreatedAt)
	return err
}

// GetTemplates returns all templates for a tenant.
func (r *ApprovalRepository) GetTemplates(ctx context.Context, tenantID string) ([]models.ApprovalTemplate, error) {
	var templates []models.ApprovalTemplate
	query := `SELECT * FROM approval_templates WHERE tenant_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &templates, query, tenantID)
	return templates, err
}

// ========== Emergency Approval ==========

// CreateEmergency inserts a new emergency approval.
func (r *ApprovalRepository) CreateEmergency(ctx context.Context, e *models.EmergencyApproval) error {
	query := `
		INSERT INTO emergency_approvals (tenant_id, title, description, requested_by, resource_type, resource_id, reason, impact_description, approver_ids, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		e.TenantID, e.Title, e.Description, e.RequestedBy, e.ResourceType, e.ResourceID,
		e.Reason, e.ImpactDescription, e.ApproverIDs, e.Status,
	).Scan(&e.ID, &e.CreatedAt)
	return err
}

// ========== My Pending ==========

// FindPendingByUserID returns pending approvals where the given user has a pending/active step,
// including the approver_id filter (same query as FindPendingByUser but with tenant_id scoping).
func (r *ApprovalRepository) FindPendingByUserID(ctx context.Context, tenantID, userID string) ([]models.Approval, error) {
	return r.FindPendingByUser(ctx, tenantID, userID)
}
