package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/data-lineage/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Lineage ---

func (r *Repository) CreateLineage(ctx context.Context, lineage *models.Lineage) error {
	lineage.ID = uuid.New().String()
	lineage.CreatedAt = time.Now().UTC()
	lineage.UpdatedAt = time.Now().UTC()
	lineage.Status = "active"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO data_lineage (id, tenant_id, name, description, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :status, :createdAt, :updatedAt)`,
		lineage)
	return err
}

func (r *Repository) GetLineageByID(ctx context.Context, tenantID, id string) (*models.Lineage, error) {
	var l models.Lineage
	err := r.db.GetContext(ctx, &l,
		`SELECT * FROM data_lineage WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &l, err
}

func (r *Repository) ListLineages(ctx context.Context, tenantID string, status *string) ([]models.Lineage, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	var lines []models.Lineage
	err := r.db.SelectContext(ctx, &lines,
		fmt.Sprintf(`SELECT * FROM data_lineage %s ORDER BY created_at DESC`, where), args...)
	return lines, err
}

func (r *Repository) UpdateLineage(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Lineage, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	clauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE data_lineage SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(clauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetLineageByID(ctx, tenantID, id)
}

func (r *Repository) DeleteLineage(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM data_lineage WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Node ---

func (r *Repository) CreateNode(ctx context.Context, node *models.Node) error {
	node.ID = uuid.New().String()
	node.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO lineage_nodes (id, lineage_id, name, type, properties, created_at)
		 VALUES (:id, :lineageId, :name, :type, :properties, :createdAt)`,
		node)
	return err
}

func (r *Repository) GetNodeByID(ctx context.Context, tenantID, id string) (*models.Node, error) {
	var n models.Node
	err := r.db.GetContext(ctx, &n,
		`SELECT ln.* FROM lineage_nodes ln
		 JOIN data_lineage dl ON ln.lineage_id = dl.id
		 WHERE ln.id=$1 AND dl.tenant_id=$2`, id, tenantID)
	return &n, err
}

func (r *Repository) ListNodesByLineage(ctx context.Context, tenantID, lineageID string) ([]models.Node, error) {
	var nodes []models.Node
	err := r.db.SelectContext(ctx, &nodes,
		`SELECT ln.* FROM lineage_nodes ln
		 JOIN data_lineage dl ON ln.lineage_id = dl.id
		 WHERE dl.tenant_id=$1 AND ln.lineage_id=$2
		 ORDER BY ln.id`, tenantID, lineageID)
	return nodes, err
}

// --- Relationship ---

func (r *Repository) CreateRelationship(ctx context.Context, rel *models.Relationship) error {
	rel.ID = uuid.New().String()
	rel.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO lineage_relationships (id, lineage_id, source_node_id, target_node_id, type, description, created_at)
		 VALUES (:id, :lineageId, :sourceNodeId, :targetNodeId, :type, :description, :createdAt)`,
		rel)
	return err
}

func (r *Repository) ListRelationshipsByLineage(ctx context.Context, tenantID, lineageID string) ([]models.Relationship, error) {
	var rels []models.Relationship
	err := r.db.SelectContext(ctx, &rels,
		`SELECT lr.* FROM lineage_relationships lr
		 JOIN data_lineage dl ON lr.lineage_id = dl.id
		 WHERE dl.tenant_id=$1 AND lr.lineage_id=$2
		 ORDER BY lr.id`, tenantID, lineageID)
	return rels, err
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.LineageStats, error) {
	stats := &models.LineageStats{}

	err := r.db.GetContext(ctx, &stats.TotalLineages,
		`SELECT COUNT(*) FROM data_lineage WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalNodes,
		`SELECT COUNT(*) FROM lineage_nodes ln
		 JOIN data_lineage dl ON ln.lineage_id = dl.id
		 WHERE dl.tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalRelationships,
		`SELECT COUNT(*) FROM lineage_relationships lr
		 JOIN data_lineage dl ON lr.lineage_id = dl.id
		 WHERE dl.tenant_id=$1`, tenantID)

	return stats, err
}
