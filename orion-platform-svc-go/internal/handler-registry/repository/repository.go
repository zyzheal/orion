package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/handler-registry/models"

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

// ====== Legacy CRUD methods (backward compatibility) ======

func (r *Repository) Create(ctx context.Context, m *models.HandlerRegistry) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO handler_registries (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.HandlerRegistry, error) {
	var m models.HandlerRegistry
	err := r.db.GetContext(ctx, &m, `SELECT * FROM handler_registries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.HandlerRegistry, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.HandlerRegistry
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM handler_registries WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `UPDATE handler_registries SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM handler_registries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ====== Handler SPI Registry methods ======

func (r *Repository) CreateEntry(ctx context.Context, entry *models.HandlerRegistryEntry) error {
	entry.ID = uuid.New().String()
	entry.CreatedAt = time.Now().UTC()
	entry.UpdatedAt = time.Now().UTC()
	cfgJSON := []byte("{}")
	if entry.Config != nil {
		cfgBytes, err := json.Marshal(entry.Config)
		if err != nil {
			return fmt.Errorf("failed to marshal config: %w", err)
		}
		cfgJSON = cfgBytes
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO handler_registry_entries (id, tenant_id, domain, name, display_name, description, status, config, registered_by, created_at, updated_at)
		VALUES (:id, :tenant_id, :domain, :name, :display_name, :description, :status, :config, :registered_by, :created_at, :updated_at)
	`, &struct {
		ID           string     `db:"id"`
		TenantID     string     `db:"tenant_id"`
		Domain       string     `db:"domain"`
		Name         string     `db:"name"`
		DisplayName  string     `db:"display_name"`
		Description  string     `db:"description"`
		Status       string     `db:"status"`
		Config       string     `db:"config"`
		RegisteredBy string     `db:"registered_by"`
		CreatedAt    time.Time  `db:"created_at"`
		UpdatedAt    time.Time  `db:"updated_at"`
	}{
		ID:           entry.ID,
		TenantID:     entry.TenantID,
		Domain:       entry.Domain,
		Name:         entry.Name,
		DisplayName:  entry.DisplayName,
		Description:  entry.Description,
		Status:       entry.Status,
		Config:       string(cfgJSON),
		RegisteredBy: entry.RegisteredBy,
		CreatedAt:    entry.CreatedAt,
		UpdatedAt:    entry.UpdatedAt,
	})
	return err
}

func (r *Repository) GetEntry(ctx context.Context, tenantID, domain, name string) (*models.HandlerRegistryEntry, error) {
	var e models.HandlerRegistryEntry
	var cfgJSON sql.NullString
	row := r.db.QueryRowxContext(ctx, `SELECT * FROM handler_registry_entries WHERE tenant_id=$1 AND domain=$2 AND name=$3`, tenantID, domain, name)
	if err := row.Scan(&e.ID, &e.TenantID, &e.Domain, &e.Name, &e.DisplayName, &e.Description, &e.Status, &cfgJSON, &e.RegisteredBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("Handler %s/%s not found", domain, name)
		}
		return nil, err
	}
	if cfgJSON.Valid && cfgJSON.String != "" {
		if cfg, parseErr := parseConfig(cfgJSON.String); parseErr == nil {
			e.Config = cfg
		} else {
			e.Config = make(map[string]interface{})
		}
	} else {
		e.Config = make(map[string]interface{})
	}
	return &e, nil
}

func (r *Repository) GetDomains(ctx context.Context, tenantID string) ([]string, error) {
	var domains []string
	err := r.db.SelectContext(ctx, &domains, `SELECT DISTINCT domain FROM handler_registry_entries WHERE tenant_id=$1 ORDER BY domain`, tenantID)
	if err != nil {
		return nil, err
	}
	return domains, nil
}

func (r *Repository) ListEntries(ctx context.Context, tenantID string, opts models.ListHandlerRegistryOptions) ([]models.HandlerRegistryEntry, error) {
	var query string = `SELECT * FROM handler_registry_entries WHERE tenant_id=$1`
	var args []interface{} = []interface{}{tenantID}
	argIdx := 2
	if opts.Domain != "" {
		query += fmt.Sprintf(" AND domain=$%d", argIdx)
		args = append(args, opts.Domain)
		argIdx++
	}
	if opts.Status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, opts.Status)
		argIdx++
	}
	query += " ORDER BY domain, name"

	rows, err := r.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.HandlerRegistryEntry
	for rows.Next() {
		e := models.HandlerRegistryEntry{}
		var cfgJSON sql.NullString
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Domain, &e.Name, &e.DisplayName, &e.Description, &e.Status, &cfgJSON, &e.RegisteredBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		if cfgJSON.Valid && cfgJSON.String != "" {
			if cfg, parseErr := parseConfig(cfgJSON.String); parseErr == nil {
				e.Config = cfg
			} else {
				e.Config = make(map[string]interface{})
			}
		} else {
			e.Config = make(map[string]interface{})
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func (r *Repository) UpdateEntryStatus(ctx context.Context, tenantID, domain, name, status string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE handler_registry_entries SET status=$1, updated_at=NOW() WHERE tenant_id=$2 AND domain=$3 AND name=$4`, status, tenantID, domain, name)
	return err
}

func (r *Repository) DeleteEntry(ctx context.Context, tenantID, domain, name string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM handler_registry_entries WHERE tenant_id=$1 AND domain=$2 AND name=$3`, tenantID, domain, name)
	return err
}

// parseConfig parses a JSON string into a map.
func parseConfig(s string) (map[string]interface{}, error) {
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		return nil, err
	}
	return m, nil
}
