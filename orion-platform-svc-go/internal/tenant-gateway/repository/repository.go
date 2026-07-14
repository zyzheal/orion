package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/tenant-gateway/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ensureTable creates the tenants table if it does not exist (schema migration aid).
func (r *Repository) ensureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS tenants (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			display_name VARCHAR(255),
			tier VARCHAR(32) NOT NULL DEFAULT 'standard',
			status VARCHAR(32) NOT NULL DEFAULT 'active',
			namespace_pool_id VARCHAR(255) NOT NULL,
			owner_email VARCHAR(255),
			business_unit VARCHAR(255),
			cost_center VARCHAR(255),
			tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
			quota_status JSONB,
			created_at BIGINT NOT NULL,
			updated_at BIGINT,
			expires_at BIGINT
		)`)
	if err != nil {
		return fmt.Errorf("tenant-gateway ensure tenants table: %w", err)
	}
	// Unique name index (excludes deleted tenants).
	_, err = r.db.ExecContext(ctx, `
		CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_name
		ON tenants (name)
		WHERE status != 'deleted'`)
	if err != nil {
		return fmt.Errorf("tenant-gateway ensure name index: %w", err)
	}
	return nil
}

// --- CRUD ---

func (r *Repository) Create(ctx context.Context, tenant *models.Tenant) error {
	if err := r.ensureTable(ctx); err != nil {
		return err
	}
	tenant.ID = "t" + fmt.Sprintf("%03d", uuid.New().ID())
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO tenants (
			id, name, display_name, tier, status, namespace_pool_id,
			owner_email, business_unit, cost_center, tenant_id,
			created_at, updated_at, expires_at
		) VALUES (
			:id, :name, :display_name, :tier, :status, :namespace_pool_id,
			:owner_email, :business_unit, :cost_center, :tenant_id,
			:created_at, :updated_at, :expires_at
		)`, tenant)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	var m models.Tenant
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM tenants WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetByName(ctx context.Context, tenantID, name string) (*models.Tenant, error) {
	var m models.Tenant
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM tenants WHERE name=$1 AND tenant_id=$2 AND status != 'deleted'`,
		name, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().Unix()
	fragments := make([]string, 0, len(updates))
	params := make(map[string]interface{})
	for k, v := range updates {
		params[k] = v
		fragments = append(fragments, fmt.Sprintf("%s = :%s", k, k))
	}
	if len(fragments) == 0 {
		return nil
	}
	setStr := joinFrags(fragments)
	query, args, err := sqlx.Named(
		`UPDATE tenants SET `+setStr+` WHERE id=$1 AND tenant_id=$2`, params)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, query, append(args, id, tenantID)...)
	return err
}

func (r *Repository) SoftDelete(ctx context.Context, tenantID, id string) error {
	now := time.Now().Unix()
	_, err := r.db.ExecContext(ctx,
		`UPDATE tenants SET status='deleted', updated_at=$1
		WHERE id=$2 AND tenant_id=$3`,
		now, id, tenantID)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) (*models.TenantListResponse, error) {
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Offset < 0 {
		q.Offset = 0
	}
	rows, err := r.listRows(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	total, err := r.countRows(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	items := rows
	if len(items) > q.Offset {
		items = items[q.Offset:]
	}
	if len(items) > q.Limit {
		items = items[:q.Limit]
	}
	return &models.TenantListResponse{Tenants: items, Total: total}, nil
}

func (r *Repository) listRows(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Tenant, error) {
	sql, args := buildListSQL(tenantID, q)
	var items []models.Tenant
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) countRows(ctx context.Context, tenantID string, q models.ListQuery) (int, error) {
	fromFrag, args := buildListFrom(tenantID, q)
	countSQL := `SELECT COUNT(*) FROM ` + fromFrag
	var total int
	err := r.db.GetContext(ctx, &total, countSQL, args...)
	return total, err
}

// buildListSQL returns a SELECT * query with ORDER BY.
func buildListSQL(tenantID string, q models.ListQuery) (string, []interface{}) {
	where, args := buildListWhere(tenantID, q)
	return where + ` ORDER BY created_at DESC`, args
}

// buildListWhere returns a SELECT ... WHERE ... fragment plus positional args.
func buildListWhere(tenantID string, q models.ListQuery) (string, []interface{}) {
	base := `SELECT * FROM tenants WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	pos := 1
	if q.Status != nil && string(*q.Status) != "" {
		pos++
		args = append(args, string(*q.Status))
		base += fmt.Sprintf(" AND status=$%d", pos)
	}
	if q.Tier != nil && string(*q.Tier) != "" {
		pos++
		args = append(args, string(*q.Tier))
		base += fmt.Sprintf(" AND tier=$%d", pos)
	}
	if q.NamespacePoolID != nil && *q.NamespacePoolID != "" {
		pos++
		args = append(args, *q.NamespacePoolID)
		base += fmt.Sprintf(" AND namespace_pool_id=$%d", pos)
	}
	return base, args
}

// buildListFrom returns a WHERE-less fragment used by countRows (COUNT wraps it).
func buildListFrom(tenantID string, q models.ListQuery) (string, []interface{}) {
	base := `tenants WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	pos := 1
	if q.Status != nil && string(*q.Status) != "" {
		pos++
		args = append(args, string(*q.Status))
		base += fmt.Sprintf(" AND status=$%d", pos)
	}
	if q.Tier != nil && string(*q.Tier) != "" {
		pos++
		args = append(args, string(*q.Tier))
		base += fmt.Sprintf(" AND tier=$%d", pos)
	}
	if q.NamespacePoolID != nil && *q.NamespacePoolID != "" {
		pos++
		args = append(args, *q.NamespacePoolID)
		base += fmt.Sprintf(" AND namespace_pool_id=$%d", pos)
	}
	return base, args
}

func joinFrags(fs []string) string {
	out := ""
	for i, f := range fs {
		if i > 0 {
			out += ", "
		}
		out += f
	}
	return out
}
