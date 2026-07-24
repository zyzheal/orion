package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/cluster/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the data access contract for the cluster module.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Cluster) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Cluster, error)
	List(ctx context.Context, tenantID string) ([]models.Cluster, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
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

// Create inserts a new cluster and assigns a UUID and timestamps.
func (r *Repository) Create(ctx context.Context, m *models.Cluster) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = models.StatusActive
	}
	query := `INSERT INTO clusters (id, tenant_id, name, api_endpoint, ca_cert, token, version, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :api_endpoint, :ca_cert, :token, :version, :status, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

// GetByID retrieves a cluster by ID for a given tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Cluster, error) {
	var m models.Cluster
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM clusters WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

// List returns all clusters for a given tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Cluster, error) {
	var items []models.Cluster
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM clusters WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// Update updates fields on a cluster. Returns NotFound if the cluster doesn't exist.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sql := fmt.Sprintf(`UPDATE clusters SET %s WHERE id=$1 AND tenant_id=$2`, joinStrings(fields, ", "))
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	result, err := r.db.NamedExecContext(ctx, sql, args)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

// Delete hard-deletes a cluster.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM clusters WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if err != nil {
		return err
	}
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
		// Ensure stable ordering so the UPDATE is deterministic
		result += sep + p
	}
	return result
}
