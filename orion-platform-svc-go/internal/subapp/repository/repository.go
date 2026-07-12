package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/subapp/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// SubApp CRUD
// ---------------------------------------------------------------------------

func (r *Repository) Create(ctx context.Context, m *models.SubApp) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO subapp_configs (
			id, tenant_id, name, key, version, entry_dev, entry_prod, routes, permissions,
			keep_alive, preload, description, icon, api_domain, status, sort_order, created_by, created_at, updated_at
		) VALUES (
			:id, :tenant_id, :name, :key, :version, :entry_dev, :entry_prod, :routes, :permissions,
			:keep_alive, :preload, :description, :icon, :api_domain, :status, :sort_order, :created_by, :created_at, :updated_at
		)`, m)
	return err
}

func (r *Repository) GetByKey(ctx context.Context, tenantID, key string) (*models.SubApp, error) {
	var m models.SubApp
	err := r.db.GetContext(ctx, &m, `SELECT * FROM subapp_configs WHERE key=$1 AND tenant_id=$2`, key, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetAll(ctx context.Context, tenantID string) ([]models.SubApp, error) {
	var items []models.SubApp
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM subapp_configs WHERE tenant_id=$1 ORDER BY sort_order ASC, created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetEnabled(ctx context.Context, tenantID string) ([]models.SubApp, error) {
	var items []models.SubApp
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM subapp_configs WHERE tenant_id=$1 AND status=$2 ORDER BY sort_order ASC`, tenantID, models.SubAppStatusEnabled)
	return items, err
}

func (r *Repository) Update(ctx context.Context, m *models.SubApp) error {
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE subapp_configs SET
			name=:name, key=:key, version=:version, entry_dev=:entry_dev, entry_prod=:entry_prod,
			routes=:routes, permissions=:permissions, keep_alive=:keep_alive, preload=:preload,
			description=:description, icon=:icon, api_domain=:api_domain, status=:status, sort_order=:sort_order,
			updated_by=:updated_by, updated_at=:updated_at
		WHERE id=:id AND tenant_id=:tenant_id`, m)
	return err
}

func (r *Repository) UpdatePartial(ctx context.Context, tenantID, key string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	set, args, err := sqlx.Named("SET " + buildSetClause(updates), updates)
	if err != nil {
		return err
	}
	query := fmt.Sprintf(`UPDATE subapp_configs %s WHERE key=$1 AND tenant_id=$2`, set)
	// Rebind named params to $N and append key, tenantID
	_, err = r.db.ExecContext(ctx, query, append(args, key, tenantID)...)
	return err
}

func buildSetClause(updates map[string]interface{}) string {
	var clauses []string
	for k, v := range updates {
		if _, ok := v.(time.Time); ok {
			clauses = append(clauses, fmt.Sprintf("%s=:$"+k, k))
		} else {
			clauses = append(clauses, fmt.Sprintf("%s=:%s", k, k))
		}
	}
	return joinComma(clauses)
}

func joinComma(clauses []string) string {
	if len(clauses) == 0 {
		return ""
	}
	result := clauses[0]
	for _, c := range clauses[1:] {
		result += ", " + c
	}
	return result
}

func (r *Repository) ToggleStatus(ctx context.Context, tenantID, key string) (*models.SubApp, error) {
	current, err := r.GetByKey(ctx, tenantID, key)
	if err != nil {
		return nil, err
	}
	newStatus := models.SubAppStatusEnabled
	if current.Status == models.SubAppStatusEnabled {
		newStatus = models.SubAppStatusDisabled
	}
	var m models.SubApp
	err = r.db.GetContext(ctx, &m,
		`UPDATE subapp_configs SET status=$1, updated_at=NOW() WHERE key=$2 AND tenant_id=$3 RETURNING *`,
		newStatus, key, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, key string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM subapp_configs WHERE key=$1 AND tenant_id=$2`, key, tenantID)
	return err
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

func (r *Repository) AddHistory(ctx context.Context, h *models.SubAppConfigHistory) error {
	h.ID = uuid.New().String()
	h.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO subapp_config_history (id, subapp_key, action, old_value, new_value, changed_by, change_summary, created_at)
		VALUES (:id, :subapp_key, :action, :old_value, :new_value, :changed_by, :change_summary, :created_at)`, h)
	return err
}

func (r *Repository) GetHistory(ctx context.Context, tenantID, key string) ([]models.SubAppConfigHistory, error) {
	var items []models.SubAppConfigHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM subapp_config_history WHERE subapp_key=$1 ORDER BY created_at DESC`, key)
	return items, err
}
