package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/graph/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// GraphNodeRepository provides data access for graph nodes.
type GraphNodeRepository struct {
	db *sqlx.DB
}

// NewGraphNodeRepository creates a new GraphNodeRepository.
func NewGraphNodeRepository(db *sqlx.DB) *GraphNodeRepository {
	return &GraphNodeRepository{db: db}
}

// rowToNode converts a database row to a GraphNode.
func (r *GraphNodeRepository) rowToNode(row map[string]interface{}) *models.GraphNode {
	labels := []string{}
	if raw, ok := row["labels"]; ok && raw != nil {
		if s, ok := raw.(string); ok {
			json.Unmarshal([]byte(s), &labels)
		}
	}

	properties := map[string]interface{}{}
	if raw, ok := row["properties"]; ok && raw != nil {
		if s, ok := raw.(string); ok {
			json.Unmarshal([]byte(s), &properties)
		}
	}

	return &models.GraphNode{
		ID:         toString(row["id"]),
		TenantID:   toString(row["tenant_id"]),
		Labels:     toString(row["labels"]),
		Properties: properties,
		CreatedAt:  toTime(row["created_at"]),
		UpdatedAt:  toTime(row["updated_at"]),
	}
}

// CreateNode inserts a new node.
func (r *GraphNodeRepository) CreateNode(ctx context.Context, tenantID string, req models.CreateNodeRequest) (*models.GraphNode, error) {
	id := uuid.New().String()
	labels, _ := json.Marshal(req.Labels)
	properties, _ := json.Marshal(req.Properties)
	now := time.Now().UTC()

	query := `INSERT INTO graph_nodes (id, tenant_id, labels, properties, created_at, updated_at)
		VALUES (:id, :tenant_id, :labels, :properties, :created_at, :updated_at)`

	params := map[string]interface{}{
		"id":         id,
		"tenant_id":  tenantID,
		"labels":     string(labels),
		"properties": string(properties),
		"created_at": now,
		"updated_at": now,
	}
	_, err := r.db.NamedExecContext(ctx, query, params)
	if err != nil {
		return nil, err
	}

	return &models.GraphNode{
		ID:         id,
		TenantID:   tenantID,
		Labels:     string(labels),
		Properties: req.Properties,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

// GetNode retrieves a node by ID.
func (r *GraphNodeRepository) GetNode(ctx context.Context, id string) (*models.GraphNode, error) {
	var node models.GraphNode
	err := r.db.GetContext(ctx, &node,
		`SELECT * FROM graph_nodes WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &node, nil
}

// GetNodeByTenant retrieves a node by ID and tenant (tenancy isolation).
func (r *GraphNodeRepository) GetNodeByTenant(ctx context.Context, tenantID, id string) (*models.GraphNode, error) {
	var node models.GraphNode
	err := r.db.GetContext(ctx, &node,
		`SELECT * FROM graph_nodes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &node, nil
}

// ListNodesByTenant returns nodes for a tenant with optional label filter.
func (r *GraphNodeRepository) ListNodesByTenant(ctx context.Context, tenantID string, label string, limit int) ([]models.GraphNode, error) {
	query := `SELECT * FROM graph_nodes WHERE tenant_id = $1`
	args := []interface{}{tenantID}

	if label != "" {
		query += ` AND labels::jsonb ? $2`
		args = append(args, label)
	}

	query += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprintf("%d", len(args))
	args = append(args, limit)

	var nodes []models.GraphNode
	err := r.db.SelectContext(ctx, &nodes, query, args...)
	if err != nil {
		return nil, err
	}

	// Re-parse JSON fields
	for i := range nodes {
		n := r.rowToNode(map[string]interface{}{
			"id":         nodes[i].ID,
			"tenant_id":  nodes[i].TenantID,
			"labels":     nodes[i].Labels,
			"properties": nodes[i].Properties,
			"created_at": nodes[i].CreatedAt,
			"updated_at": nodes[i].UpdatedAt,
		})
		nodes[i] = *n
	}
	return nodes, nil
}

// UpdateNode applies partial updates to a node.
func (r *GraphNodeRepository) UpdateNode(ctx context.Context, tenantID, id string, req models.UpdateNodeRequest) (*models.GraphNode, error) {
	updates := []string{}
	args := []interface{}{}
	idx := 1

	if req.Labels != nil {
		labels, _ := json.Marshal(*req.Labels)
		updates = append(updates, fmt.Sprintf("labels = $%d", idx))
		args = append(args, string(labels))
		idx++
	}
	if req.Properties != nil {
		props, _ := json.Marshal(req.Properties)
		updates = append(updates, fmt.Sprintf("properties = $%d", idx))
		args = append(args, string(props))
		idx++
	}

	if len(updates) == 0 {
		return r.GetNodeByTenant(ctx, tenantID, id)
	}

	updates = append(updates, fmt.Sprintf("updated_at = $%d", idx))
	args = append(args, time.Now().UTC())
	idx++

	args = append(args, id, tenantID)

	query := fmt.Sprintf(`UPDATE graph_nodes SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *`,
		strings.Join(updates, ", "), idx, idx+1)

	var node models.GraphNode
	err := r.db.GetContext(ctx, &node, query, args...)
	if err != nil {
		return nil, err
	}
	return &node, nil
}

// DeleteNode deletes a node by ID and tenant.
func (r *GraphNodeRepository) DeleteNode(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM graph_nodes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CountNodesByTenant returns the number of nodes for a tenant.
func (r *GraphNodeRepository) CountNodesByTenant(ctx context.Context, tenantID string) (int64, error) {
	var count int64
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM graph_nodes WHERE tenant_id=$1`, tenantID)
	return count, err
}

// NodeExists checks if a node exists (by tenant).
func (r *GraphNodeRepository) NodeExists(ctx context.Context, tenantID, nodeID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM graph_nodes WHERE id=$1 AND tenant_id=$2)`, nodeID, tenantID)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// --- Helpers ---

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return fmt.Sprintf("%v", v)
}

func toTime(v interface{}) time.Time {
	if v == nil {
		return time.Time{}
	}
	if t, ok := v.(time.Time); ok {
		return t
	}
	if s, ok := v.(string); ok {
		t, _ := time.Parse("2006-01-02 15:04:05", s)
		return t
	}
	return time.Time{}
}
