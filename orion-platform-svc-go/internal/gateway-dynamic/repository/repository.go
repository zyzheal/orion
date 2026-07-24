package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/gateway-dynamic/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create persists a new gateway route. For backward compatibility it also accepts
// the simple "name" model (id/tenant_id/name/created_at/updated_at).
func (r *Repository) Create(ctx context.Context, m *models.GatewayRoute) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()

	metadataJSON := "{}"
	if len(m.Metadata) > 0 {
		metadataJSON = string(m.Metadata)
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO gateway_routes
			(id, tenant_id, path, methods, upstream_url, enabled, priority, metadata, created_by, updated_by, created_at, updated_at)
			VALUES (:id, :tenant_id, :path, :methods, :upstream_url, :enabled, :priority, :metadata, :created_by, :updated_by, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":           m.ID,
			"tenant_id":    m.TenantID,
			"path":         m.Path,
			"methods":      m.Methods,
			"upstream_url": m.UpstreamURL,
			"enabled":      m.Enabled,
			"priority":     m.Priority,
			"metadata":     metadataJSON,
			"created_by":   m.CreatedBy,
			"updated_by":   m.UpdatedBy,
			"created_at":   m.CreatedAt,
			"updated_at":   m.UpdatedAt,
		})
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.GatewayRoute, error) {
	var m models.GatewayRoute
	err := r.db.GetContext(ctx, &m, `SELECT * FROM gateway_routes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.GatewayRoute, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.GatewayRoute
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM gateway_routes WHERE tenant_id=$1 ORDER BY priority DESC, created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ListWithFilter lists routes with optional enabled and query (q) filters.
func (r *Repository) ListWithFilter(ctx context.Context, tenantID string, enabled *bool, q string, limit, offset int) ([]models.GatewayRoute, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	whereParts := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if enabled != nil {
		whereParts = append(whereParts, fmt.Sprintf("enabled=$%d", argIdx))
		args = append(args, *enabled)
		argIdx++
	}
	if q != "" {
		// Match against path (primary search) and metadata description.
		whereParts = append(whereParts, fmt.Sprintf("(path ILIKE $%d OR metadata::text ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+q+"%", "%"+q+"%")
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")
	selectStmt := fmt.Sprintf(`SELECT * FROM gateway_routes WHERE %s ORDER BY priority DESC, created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var items []models.GatewayRoute
	err := r.db.SelectContext(ctx, &items, selectStmt, args...)
	if err != nil {
		return nil, 0, err
	}

	// Count query for total
	countArgs := make([]interface{}, len(args)-2)
	for i := 0; i < len(countArgs); i++ {
		countArgs[i] = args[i]
	}
	var total int
	err = r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM gateway_routes WHERE %s`, whereClause), countArgs...)
	if err != nil {
		return items, 0, err
	}
	return items, total, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()

	// Build SET clause from the map.
	// Use $1..$N for SET values, $N+1 for id, $N+2 for tenant_id.
	orderedKeys := make([]string, 0, len(updates))
	for k := range updates {
		orderedKeys = append(orderedKeys, k)
	}

	setParts := make([]string, 0, len(orderedKeys))
	args := []interface{}{}
	for i, k := range orderedKeys {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", k, i+1))
		args = append(args, updates[k])
	}
	idArg := len(orderedKeys) + 1
	tenantArg := idArg + 1
	setClause := strings.Join(setParts, ", ")
	stmt := fmt.Sprintf(`UPDATE gateway_routes SET %s WHERE id=$%d AND tenant_id=$%d`, setClause, idArg, tenantArg)

	res, err := r.db.ExecContext(ctx, stmt, append(args, id, tenantID)...)
	if err != nil {
		return fmt.Errorf("failed to update: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("route not found")
	}
	return nil
}

// UpdateJSON updates a single JSON field (path, methods, upstream_url, etc.) plus
// returns the full row for the caller.
func (r *Repository) UpdateJSON(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `UPDATE gateway_routes SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM gateway_routes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetStats aggregates route statistics for the tenant.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.RouteStats, error) {
	var stats models.RouteStats
	err := r.db.GetContext(ctx, &stats,
		`SELECT COUNT(*) as total_routes,
			   SUM(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled_count,
			   SUM(CASE WHEN NOT enabled THEN 1 ELSE 0 END) as disabled_count,
			   COALESCE(SUM((metadata->>'request_count')::bigint), 0) as total_requests,
			   COALESCE(SUM((metadata->>'error_count')::bigint), 0) as total_errors
		   FROM gateway_routes
		   WHERE tenant_id=$1`,
		tenantID)
	if err != nil {
		return nil, err
	}
	if stats.TotalRequests > 0 {
		stats.ErrorRate = float64(stats.TotalErrors) / float64(stats.TotalRequests)
	}
	return &stats, nil
}

// Exists checks whether a route exists for the tenant.
func (r *Repository) Exists(ctx context.Context, tenantID, id string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM gateway_routes WHERE id=$1 AND tenant_id=$2)`, id, tenantID)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// MarshalStringSlice marshals a []string into a JSON array string for storage.
func MarshalStringSlice(s []string) (string, error) {
	if len(s) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

// UnmarshalStringSlice unmarshals a JSON array string back into []string.
func UnmarshalStringSlice(s string) ([]string, error) {
	if s == "" || s == "[]" {
		return []string{}, nil
	}
	var arr []string
	err := json.Unmarshal([]byte(s), &arr)
	return arr, err
}

// ParseMetadata attempts to parse the raw metadata JSON from the DB row, returning
// defaults when the field is missing or invalid.
func ParseMetadata(raw json.RawMessage) *models.RouteMetadata {
	m := &models.RouteMetadata{AuthRequired: true}
	if len(raw) == 0 {
		return m
	}
	if err := json.Unmarshal(raw, m); err != nil {
		return m
	}
	return m
}

var (
	ErrDuplicate = errors.New("route already exists")
	ErrNoRows    = sql.ErrNoRows
)
