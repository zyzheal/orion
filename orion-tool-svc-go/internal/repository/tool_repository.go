package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"

	"orion-tool-svc-go/internal/models"
)

// ToolRepository handles tool data access.
type ToolRepository struct {
	db *sqlx.DB
}

func NewToolRepository(db *sqlx.DB) *ToolRepository {
	return &ToolRepository{db: db}
}

func (r *ToolRepository) Create(ctx context.Context, tool *models.Tool) error {
	query := `INSERT INTO tools (id, tenant_id, name, display_name, description, category, type, version, config, endpoint, auth_type, auth_config, tags, status, created_by)
		VALUES (:id, :tenant_id, :name, :display_name, :description, :category, :type, :version, :config, :endpoint, :auth_type, :auth_config, :tags, :status, :created_by)`
	_, err := r.db.NamedExecContext(ctx, query, tool)
	return err
}

func (r *ToolRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Tool, error) {
	var tool models.Tool
	err := r.db.GetContext(ctx, &tool, `SELECT * FROM tools WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &tool, err
}

func (r *ToolRepository) List(ctx context.Context, tenantID string, params models.ToolListParams) ([]models.Tool, int, error) {
	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if params.Category != "" {
		where = append(where, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, params.Category)
		argIdx++
	}
	if params.Type != "" {
		where = append(where, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, params.Type)
		argIdx++
	}
	if params.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, params.Status)
		argIdx++
	}
	if params.Search != "" {
		where = append(where, fmt.Sprintf("(name ILIKE $%d OR display_name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+params.Search+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM tools WHERE %s", whereClause)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 || params.PageSize > 100 {
		params.PageSize = 20
	}
	offset := (params.Page - 1) * params.PageSize

	query := fmt.Sprintf("SELECT * FROM tools WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", whereClause, argIdx, argIdx+1)
	args = append(args, params.PageSize, offset)

	var tools []models.Tool
	if err := r.db.SelectContext(ctx, &tools, query, args...); err != nil {
		return nil, 0, err
	}
	return tools, total, nil
}

func (r *ToolRepository) Update(ctx context.Context, tool *models.Tool) error {
	query := `UPDATE tools SET display_name=:display_name, description=:description, category=:category, version=:version, config=:config, endpoint=:endpoint, auth_type=:auth_type, auth_config=:auth_config, tags=:tags, status=:status, updated_at=NOW() WHERE id=:id AND tenant_id=:tenant_id`
	_, err := r.db.NamedExecContext(ctx, query, tool)
	return err
}

func (r *ToolRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM tools WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *ToolRepository) GetCategories(ctx context.Context, tenantID string) ([]models.ToolCategory, error) {
	var cats []models.ToolCategory
	err := r.db.SelectContext(ctx, &cats, `SELECT * FROM tool_categories WHERE tenant_id=$1 ORDER BY sort_order`, tenantID)
	return cats, err
}

func (r *ToolRepository) Search(ctx context.Context, tenantID, query string, limit int) ([]models.Tool, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var tools []models.Tool
	err := r.db.SelectContext(ctx, &tools,
		`SELECT * FROM tools WHERE tenant_id=$1 AND status='active' AND (name ILIKE $2 OR display_name ILIKE $2 OR description ILIKE $2) ORDER BY name LIMIT $3`,
		tenantID, "%"+query+"%", limit)
	return tools, err
}
