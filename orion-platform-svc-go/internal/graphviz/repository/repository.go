package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/graphviz/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository implements RepositoryInterface using sqlx.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new graph record.
func (r *Repository) Create(ctx context.Context, g *models.Graph) error {
	g.ID = uuid.New().String()
	g.CreatedAt = time.Now().UTC()
	g.UpdatedAt = g.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO graphviz_graphs (
			id, tenant_id, name, description, template_id, direction, layout,
			nodes_json, links_json, created_at, updated_at
		) VALUES (
			:id, :tenant_id, :name, :description, :template_id, :direction, :layout,
			:nodes_json, :links_json, :created_at, :updated_at
		)`, g)
	return err
}

// GetByID retrieves a graph by its ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Graph, error) {
	var g models.Graph
	err := r.db.GetContext(ctx, &g, `
		SELECT * FROM graphviz_graphs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &g, nil
}

// List returns all graphs for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Graph, error) {
	var graphs []models.Graph
	err := r.db.SelectContext(ctx, &graphs, `
		SELECT * FROM graphviz_graphs WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return graphs, err
}

// Update modifies a graph record.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Graph, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	setParts, args, idx := r.buildUpdateParts(updates)
	query := fmt.Sprintf(
		"UPDATE graphviz_graphs SET %s WHERE id = $%d AND tenant_id = $%d",
		strings.Join(setParts, ", "), idx-1, idx)
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// Delete removes a graph record.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM graphviz_graphs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// buildUpdateParts generates SET clause parts and args for an UPDATE.
func (r *Repository) buildUpdateParts(updates map[string]interface{}) ([]string, []interface{}, int) {
	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	return setParts, args, idx
}
