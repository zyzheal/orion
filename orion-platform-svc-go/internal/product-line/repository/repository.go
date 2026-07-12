package repository

import (
	"context"
	"database/sql/driver"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/product-line/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

// ==================== ProductLine CRUD ====================

func (r *Repository) Create(ctx context.Context, m *models.ProductLine) error {
	m.ID = uuid.New().String()
	m.Phase = models.PhasePending
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO product_lines (id, tenant_id, name, phase, created_at, updated_at) VALUES (:id, :tenant_id, :name, :phase, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ProductLine, error) {
	var m models.ProductLine
	err := r.db.GetContext(ctx, &m, `SELECT * FROM product_lines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetByName(ctx context.Context, tenantID, name string) (*models.ProductLine, error) {
	var m models.ProductLine
	err := r.db.GetContext(ctx, &m, `SELECT * FROM product_lines WHERE name=$1 AND tenant_id=$2`, name, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.ProductLine, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.ProductLine
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM product_lines WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	setParts := make([]string, 0, len(updates))
	values := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", k, idx))
		values = append(values, v)
		idx++
	}
	values = append(values, id, tenantID)
	query := `UPDATE product_lines SET ` + strings.Join(setParts, ", ") + ` WHERE id=$1 AND tenant_id=$2`
	_, err := r.db.ExecContext(ctx, query, values...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM product_lines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// UpdatePhase updates the phase for a product line and returns the updated record.
func (r *Repository) UpdatePhase(ctx context.Context, tenantID, id string, phase models.Phase) (*models.ProductLine, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE product_lines SET phase=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, phase, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// ==================== ReleaseTrain CRUD ====================

func (r *Repository) CreateReleaseTrain(ctx context.Context, tenantID string, rt *models.ReleaseTrain) error {
	rt.ID = uuid.New().String()
	rt.CreatedAt = time.Now().UTC()
	rt.UpdatedAt = time.Now().UTC()
	if rt.State == "" {
		rt.State = "Idle"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO release_trains (id, product_line_id, tenant_id, name, schedule, target_branch, source_branch, auto_promote, approval_required, approvers, state, created_at, updated_at)
		   VALUES (:id, :product_line_id, :tenant_id, :name, :schedule, :target_branch, :source_branch, :auto_promote, :approval_required, :approvers, :state, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":                rt.ID,
			"product_line_id":   rt.ProductLineID,
			"tenant_id":         tenantID,
			"name":              rt.Name,
			"schedule":          rt.Schedule,
			"target_branch":     rt.TargetBranch,
			"source_branch":     rt.SourceBranch,
			"auto_promote":      rt.AutoPromote,
			"approval_required": rt.ApprovalRequired,
			"approvers":         rt.Approvers,
			"state":             rt.State,
			"created_at":        rt.CreatedAt,
			"updated_at":        rt.UpdatedAt,
		})
	return err
}

func (r *Repository) GetReleaseTrains(ctx context.Context, tenantID, productLineID string) ([]models.ReleaseTrain, error) {
	var items []models.ReleaseTrain
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM release_trains WHERE product_line_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, productLineID, tenantID)
	return items, err
}

// ==================== HotfixChannel CRUD ====================

func (r *Repository) CreateHotfixChannel(ctx context.Context, tenantID string, hc *models.HotfixChannel) error {
	hc.ID = uuid.New().String()
	hc.CreatedAt = time.Now().UTC()
	hc.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO hotfix_channels (id, product_line_id, tenant_id, name, enabled, branch_pattern, approval_required, approval_timeout, auto_merge, notify_on_call, max_duration, created_at, updated_at)
		   VALUES (:id, :product_line_id, :tenant_id, :name, :enabled, :branch_pattern, :approval_required, :approval_timeout, :auto_merge, :notify_on_call, :max_duration, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":                hc.ID,
			"product_line_id":   hc.ProductLineID,
			"tenant_id":         tenantID,
			"name":              hc.Name,
			"enabled":           hc.Enabled,
			"branch_pattern":    hc.BranchPattern,
			"approval_required": hc.ApprovalRequired,
			"approval_timeout":  hc.ApprovalTimeout,
			"auto_merge":        hc.AutoMerge,
			"notify_on_call":    hc.NotifyOnCall,
			"max_duration":      hc.MaxDuration,
			"created_at":        hc.CreatedAt,
			"updated_at":        hc.UpdatedAt,
		})
	return err
}

func (r *Repository) GetHotfixChannels(ctx context.Context, tenantID, productLineID string) ([]models.HotfixChannel, error) {
	var items []models.HotfixChannel
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM hotfix_channels WHERE product_line_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, productLineID, tenantID)
	return items, err
}

func (r *Repository) GetEnabledHotfixChannel(ctx context.Context, tenantID, productLineID string) (*models.HotfixChannel, error) {
	var hc models.HotfixChannel
	err := r.db.GetContext(ctx, &hc, `SELECT * FROM hotfix_channels WHERE product_line_id=$1 AND tenant_id=$2 AND enabled=true LIMIT 1`, productLineID, tenantID)
	if err != nil {
		return nil, err
	}
	return &hc, nil
}

// driver.Valuer interface assertion for compatibility.
var _ driver.Valuer = nil
