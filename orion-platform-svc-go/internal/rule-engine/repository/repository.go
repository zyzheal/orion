package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/rule-engine/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the data access contract for the rule-engine module.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Rule) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Rule, error)
	List(ctx context.Context, tenantID string) ([]models.Rule, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Rule, error)
	Delete(ctx context.Context, tenantID, id string) error
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)

// Create inserts a new rule and assigns a UUID and timestamps.
func (r *Repository) Create(ctx context.Context, m *models.Rule) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Priority == 0 {
		m.Priority = 100
	}
	query := `INSERT INTO rules (id, tenant_id, name, description, priority, conditions, actions, is_enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :priority, :conditions, :actions, :is_enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

// GetByID retrieves a rule by ID for a given tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Rule, error) {
	var m models.Rule
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

// List returns all rules for a given tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Rule, error) {
	var items []models.Rule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM rules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// Update updates fields on a rule. Returns NotFound if the rule doesn't exist.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Rule, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sql := fmt.Sprintf(`UPDATE rules SET %s WHERE id=$1 AND tenant_id=$2`, joinStrings(fields, ", "))
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	result, err := r.db.NamedExecContext(ctx, sql, args)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

// Delete hard-deletes a rule.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
