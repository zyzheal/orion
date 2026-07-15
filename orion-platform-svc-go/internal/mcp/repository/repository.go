package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/mcp/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Server CRUD ---

func (r *Repository) CreateServer(ctx context.Context, m *models.MCPServer) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO mcp_server (id, tenant_id, name, url, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :url, :enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetServer(ctx context.Context, tenantID, id string) (*models.MCPServer, error) {
	var m models.MCPServer
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM mcp_server WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListServers(ctx context.Context, tenantID string, q models.ListMCPServersQuery) ([]models.MCPServer, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var sql string
	var args []interface{}
	paramIdx := 1

	if q.Name != "" && q.Enabled != nil {
		sql = fmt.Sprintf(`SELECT * FROM mcp_server WHERE tenant_id=$%d AND name=$%d AND enabled=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3, paramIdx+4)
		args = []interface{}{tenantID, q.Name, *q.Enabled, q.Limit, q.Offset}
	} else if q.Name != "" {
		sql = fmt.Sprintf(`SELECT * FROM mcp_server WHERE tenant_id=$%d AND name=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			1, 2, 3, 4)
		args = []interface{}{tenantID, q.Name, q.Limit, q.Offset}
	} else if q.Enabled != nil {
		sql = fmt.Sprintf(`SELECT * FROM mcp_server WHERE tenant_id=$%d AND enabled=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			1, 2, 3, 4)
		args = []interface{}{tenantID, *q.Enabled, q.Limit, q.Offset}
	} else {
		sql = fmt.Sprintf(`SELECT * FROM mcp_server WHERE tenant_id=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			1, 2, 3)
		args = []interface{}{tenantID, q.Limit, q.Offset}
	}

	var items []models.MCPServer
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) CountServers(ctx context.Context, tenantID string, q models.ListMCPServersQuery) (int, error) {
	var sql string
	var args []interface{}

	if q.Name != "" && q.Enabled != nil {
		sql = `SELECT COUNT(*) FROM mcp_server WHERE tenant_id=$1 AND name=$2 AND enabled=$3 AND deleted_at IS NULL`
		args = []interface{}{tenantID, q.Name, *q.Enabled}
	} else if q.Name != "" {
		sql = `SELECT COUNT(*) FROM mcp_server WHERE tenant_id=$1 AND name=$2 AND deleted_at IS NULL`
		args = []interface{}{tenantID, q.Name}
	} else if q.Enabled != nil {
		sql = `SELECT COUNT(*) FROM mcp_server WHERE tenant_id=$1 AND enabled=$2 AND deleted_at IS NULL`
		args = []interface{}{tenantID, *q.Enabled}
	} else {
		sql = `SELECT COUNT(*) FROM mcp_server WHERE tenant_id=$1 AND deleted_at IS NULL`
		args = []interface{}{tenantID}
	}

	var count int
	err := r.db.GetContext(ctx, &count, sql, args...)
	return count, err
}

func (r *Repository) UpdateServer(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sql := fmt.Sprintf(`UPDATE mcp_server SET %s WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, joinStrings(fields, ", "))
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	_, err := r.db.NamedExecContext(ctx, sql, args)
	return err
}

func (r *Repository) SoftDeleteServer(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE mcp_server SET deleted_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Tool CRUD ---

func (r *Repository) CreateTool(ctx context.Context, m *models.MCPTool) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO mcp_tool (id, server_id, name, params, created_at)
			VALUES (:id, :server_id, :name, :params, :created_at)`,
		m)
	return err
}

func (r *Repository) ListTools(ctx context.Context, q models.ListMCPToolsQuery) ([]models.MCPTool, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var sql string
	var args []interface{}

	if q.ServerID != "" {
		sql = fmt.Sprintf(`SELECT * FROM mcp_tool WHERE server_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
			1, 2, 3)
			args = []interface{}{q.ServerID, q.Limit, q.Offset}
	} else {
		sql = fmt.Sprintf(`SELECT * FROM mcp_tool ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			1, 2)
		args = []interface{}{q.Limit, q.Offset}
	}

	var items []models.MCPTool
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) CountTools(ctx context.Context, q models.ListMCPToolsQuery) (int, error) {
	sql := `SELECT COUNT(*) FROM mcp_tool`
	var count int
	if q.ServerID != "" {
		sql = `SELECT COUNT(*) FROM mcp_tool WHERE server_id=$1`
		err := r.db.GetContext(ctx, &count, sql, q.ServerID)
		return count, err
	}
	err := r.db.GetContext(ctx, &count, sql)
	return count, err
}

// --- Helper ---

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
