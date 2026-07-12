package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/approval/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Approval requests ---

func (r *Repository) CreateApprovalRequest(ctx context.Context, m *models.ApprovalRequest) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	query := `INSERT INTO approval_requests (id, tenant_id, type, status, title, description,
		req_by_id, req_by_name, template_id, current_level, total_levels, created_at, updated_at)
		VALUES (:id, :tenant_id, :type, :status, :title, :description, :req_by_id, :req_by_name,
		:template_id, :current_level, :total_levels, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetApprovalRequest(ctx context.Context, tenantID, id string) (*models.ApprovalRequest, error) {
	var m models.ApprovalRequest
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM approval_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListApprovalRequests(ctx context.Context, tenantID, approvalType, status string, limit, offset int) ([]models.ApprovalRequest, error) {
	if limit <= 0 {
		limit = 50
	}
	args := []interface{}{tenantID}
	idx := 2
	conds := []string{"tenant_id=$1"}
	if approvalType != "" {
		conds = append(conds, fmt.Sprintf("type=$%d", idx))
		// idx incremented via args append below
		args = append(args, approvalType)
		idx++
	}
	if status != "" {
		conds = append(conds, fmt.Sprintf("status=$%d", idx))
		args = append(args, status)
		idx++
	}
	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += " AND " + conds[i]
	}
	sql := fmt.Sprintf("SELECT * FROM approval_requests WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, idx, idx+1)
	args = append(args, limit, offset)
	var items []models.ApprovalRequest
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateApprovalRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE approval_requests SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeleteApprovalRequest(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM approval_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Approval levels ---

func (r *Repository) CreateApprovalLevel(ctx context.Context, m *models.ApprovalLevel) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	query := `INSERT INTO approval_levels (id, tenant_id, approval_id, level, approver_id, approver_name,
		status, comment, created_at, updated_at)
		VALUES (:id, :tenant_id, :approval_id, :level, :approver_id, :approver_name,
		:status, :comment, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) ListLevelsByApproval(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalLevel, error) {
	var items []models.ApprovalLevel
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM approval_levels WHERE approval_id=$1 AND tenant_id=$2 ORDER BY level`, approvalID, tenantID)
	return items, err
}

// --- Approval history ---

func (r *Repository) CreateApprovalHistory(ctx context.Context, m *models.ApprovalHistory) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	query := `INSERT INTO approval_history (id, tenant_id, approval_id, action, actor_id, actor_name, comment, created_at)
		VALUES (:id, :tenant_id, :approval_id, :action, :actor_id, :actor_name, :comment, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) ListHistoryByApproval(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalHistory, error) {
	var items []models.ApprovalHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM approval_history WHERE approval_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, approvalID, tenantID)
	return items, err
}

// --- Templates ---

func (r *Repository) CreateTemplate(ctx context.Context, m *models.ApprovalTemplate) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	query := `INSERT INTO approval_templates (id, tenant_id, name, description, levels, is_active, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :levels, :is_active, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetTemplate(ctx context.Context, tenantID, id string) (*models.ApprovalTemplate, error) {
	var m models.ApprovalTemplate
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM approval_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID string, limit, offset int) ([]models.ApprovalTemplate, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.ApprovalTemplate
	//nolint:gosec // limit/offset are bounded in service layer
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM approval_templates WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) UpdateTemplate(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE approval_templates SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM approval_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Approval gates (pipeline) ---

func (r *Repository) CreateApprovalGate(ctx context.Context, m *models.ApprovalGate) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	query := `INSERT INTO approval_gates (id, tenant_id, run_id, stage_id, status, actor_id, actor_name, comment, created_at, updated_at)
		VALUES (:id, :tenant_id, :run_id, :stage_id, :status, :actor_id, :actor_name, :comment, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) ListGatesByRun(ctx context.Context, tenantID, runID string) ([]models.ApprovalGate, error) {
	var items []models.ApprovalGate
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM approval_gates WHERE run_id=$1 AND tenant_id=$2 ORDER BY created_at`, runID, tenantID)
	return items, err
}

func (r *Repository) GetGateByStage(ctx context.Context, tenantID, runID, stageID string) (*models.ApprovalGate, error) {
	var m models.ApprovalGate
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM approval_gates WHERE run_id=$1 AND stage_id=$2 AND tenant_id=$3`, runID, stageID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// --- Statistics ---

func (r *Repository) GetStatistics(ctx context.Context, tenantID string) (models.ApprovalStatistics, error) {
	var stats models.ApprovalStatistics
	_ = r.db.GetContext(ctx, &stats.Total,
		`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1`, tenantID)
	_ = r.db.GetContext(ctx, &stats.Pending,
		`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "pending")
	_ = r.db.GetContext(ctx, &stats.Approved,
		`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "approved")
	_ = r.db.GetContext(ctx, &stats.Rejected,
		`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "rejected")
	_ = r.db.GetContext(ctx, &stats.Withdrawn,
		`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "withdrawn")
	_ = r.db.GetContext(ctx, &stats.Cancelled,
		`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "cancelled")
	return stats, nil
}

// --- Pending approvals ---

func (r *Repository) ListPending(ctx context.Context, tenantID string) ([]models.ApprovalRequest, error) {
	var items []models.ApprovalRequest
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM approval_requests WHERE tenant_id=$1 AND status=$2 ORDER BY created_at`, tenantID, "pending")
	return items, err
}

func (r *Repository) ListMyPending(ctx context.Context, tenantID, userID string) ([]models.ApprovalRequest, error) {
	var items []models.ApprovalRequest
	err := r.db.SelectContext(ctx, &items,
		`SELECT ar.* FROM approval_requests ar
			INNER JOIN approval_levels al ON al.approval_id=ar.id
			WHERE ar.tenant_id=$1 AND ar.status=$2 AND al.approver_id=$3 AND al.status=$4
			ORDER BY ar.created_at`,
		tenantID, "pending", userID, "pending")
	return items, err
}

func (r *Repository) GetByStatus(ctx context.Context, tenantID, approvalID string) (*models.ApprovalRequest, error) {
	var m models.ApprovalRequest
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM approval_requests WHERE id=$1 AND tenant_id=$2`, approvalID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}
