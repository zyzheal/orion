package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/cmdb/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CI CRUD ---

func (r *Repository) CreateCI(ctx context.Context, ci *models.CI) error {
	ci.ID = uuid.New().String()
	ci.CreatedAt = time.Now().UTC()
	ci.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO cmdb_cis (id, ci_id, name, ci_type, status, description, tenant_id, created_by, environment, tags, created_at, updated_at)
		VALUES (:id, :ciId, :name, :ciType, :status, :description, :tenantId, :createdBy, :environment, :tags, :createdAt, :updatedAt)`
	_, err := r.db.NamedExecContext(ctx, query, ci)
	return err
}

func (r *Repository) GetCIByID(ctx context.Context, id string) (*models.CI, error) {
	var ci models.CI
	err := r.db.GetContext(ctx, &ci,
		`SELECT * FROM cmdb_cis WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &ci, nil
}

func (r *Repository) GetCIByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error) {
	var ci models.CI
	if tenantID != nil {
		err := r.db.GetContext(ctx, &ci,
			`SELECT * FROM cmdb_cis WHERE ci_id=$1 AND tenant_id=$2`, ciID, *tenantID)
		if err != nil {
			return nil, err
		}
		return &ci, nil
	}
	err := r.db.GetContext(ctx, &ci,
		`SELECT * FROM cmdb_cis WHERE ci_id=$1`, ciID)
	if err != nil {
		return nil, err
	}
	return &ci, nil
}

func (r *Repository) UpdateCI(ctx context.Context, id string, updates map[string]interface{}) (*models.CI, error) {
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id)
	query := fmt.Sprintf(`UPDATE cmdb_cis SET %s WHERE id=$%d`, strings.Join(setClauses, ", "), i)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetCIByID(ctx, id)
}

func (r *Repository) DeleteCI(ctx context.Context, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_cis WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) ListCIs(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	var items []models.CI
	var total int

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if ciType != nil && *ciType != "" {
		where += fmt.Sprintf(" AND ci_type = $%d", argIdx)
		ares := args
		ares = append(ares, *ciType)
		args = ares
		argIdx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM cmdb_cis %s`, where)
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	selectQuery := fmt.Sprintf(`SELECT * FROM cmdb_cis %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)
	err = r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) batchUpdateHelper(tx *sqlx.Tx, id string, tenantID string, updates map[string]interface{}) (int64, error) {
	now := time.Now().UTC()
	updates["updated_at"] = now
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE cmdb_cis SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	res, err := tx.ExecContext(context.Background(), query, args...)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

// BatchCreateCIs inserts multiple CIs in one transaction.
func (r *Repository) BatchCreateCIs(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result := &models.BatchResult{}
	for _, item := range items {
		ci := &models.CI{
			CIID:        item.CIID,
			Name:        item.Name,
			CIType:      item.CIType,
			Status:      item.Status,
			Description: item.Description,
			TenantID:    tenantID,
			CreatedBy:   createdBy,
			Environment: item.Environment,
			Tags:        item.Tags,
		}
		if ci.Status == "" {
			ci.Status = "active"
		}
		ci.ID = uuid.New().String()
		ci.CreatedAt = time.Now().UTC()
		ci.UpdatedAt = time.Now().UTC()
		_, err := tx.NamedExecContext(ctx,
			`INSERT INTO cmdb_cis (id, ci_id, name, ci_type, status, description, tenant_id, created_by, environment, tags, created_at, updated_at)
			 VALUES (:id, :ciId, :name, :ciType, :status, :description, :tenantId, :createdBy, :environment, :tags, :createdAt, :updatedAt)`,
			ci)
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
			result.Failed++
			continue
		}
		result.Success++
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

// BatchUpdateCIs updates multiple CIs in one transaction.
func (r *Repository) BatchUpdateCIs(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result := &models.BatchResult{}
	for _, item := range items {
		updates := map[string]interface{}{}
		if item.CIID != nil {
			updates["ci_id"] = *item.CIID
		}
		if item.Name != nil {
			updates["name"] = *item.Name
		}
		if item.CIType != nil {
			updates["ci_type"] = *item.CIType
		}
		if item.Status != nil {
			updates["status"] = *item.Status
		}
		if item.Description != nil {
			updates["description"] = *item.Description
		}
		if item.Environment != nil {
			updates["environment"] = *item.Environment
		}
		if item.Tags != nil {
			updates["tags"] = *item.Tags
		}
		if len(updates) == 0 {
			result.Errors = append(result.Errors, "no fields to update: "+item.ID)
			result.Failed++
			continue
		}
		n, err := r.batchUpdateHelper(tx, item.ID, tenantID, updates)
		if err != nil {
			eresult, _ := tx.ExecContext(context.Background(), `SELECT 1`)
			_ = eresult
			result.Errors = append(result.Errors, err.Error())
			_ = result.Errors // avoid unused on empty branches
			result.Failed++
			continue
		}
		if n == 0 {
			result.Errors = append(result.Errors, "not found: "+item.ID)
			result.Failed++
			continue
		}
		result.Success++
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

// BatchDeleteCIs deletes multiple CIs in one transaction.
func (r *Repository) BatchDeleteCIs(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result := &models.BatchResult{}
	for _, id := range ids {
		res, err := tx.ExecContext(ctx,
			`DELETE FROM cmdb_cis WHERE id=$1 AND tenant_id=$2`, id, tenantID)
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
			result.Failed++
			continue
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			result.Errors = append(result.Errors, "not found: "+id)
			result.Failed++
			continue
		}
		result.Success++
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

// BatchQueryCIs queries CIs with complex filters.
func (r *Repository) BatchQueryCIs(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error) {
	var items []models.CI
	var total int

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if q.CIType != nil && *q.CIType != "" {
		where += fmt.Sprintf(" AND ci_type = $%d", argIdx)
		args = append(args, *q.CIType)
		argIdx++
	}
	if q.Status != nil && *q.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *q.Status)
		argIdx++
	}
	if q.Environment != nil && *q.Environment != "" {
		where += fmt.Sprintf(" AND environment = $%d", argIdx)
		args = append(args, *q.Environment)
		argIdx++
	}
	if q.Tags != nil && *q.Tags != "" {
		where += fmt.Sprintf(" AND tags ILIKE $%d", argIdx)
		args = append(args, "%"+*q.Tags+"%")
		argIdx++
	}
	if q.Search != nil && *q.Search != "" {
		where += fmt.Sprintf(" AND (name ILIKE $%d OR ci_id ILIKE $%d)", argIdx, argIdx+1)
		pattern := "%" + *q.Search + "%"
		args = append(args, pattern, pattern)
		argIdx += 2
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM cmdb_cis %s`, where)
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	orderBy := "created_at"
	if q.OrderBy != nil && *q.OrderBy != "" {
		orderBy = *q.OrderBy
	}
	order := "DESC"
	if q.Order != nil && *q.Order != "" {
		order = *q.Order
	}

	limit := 20
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	offset := 0
	if q.Offset != nil && *q.Offset > 0 {
		offset = *q.Offset
	}

	selectQuery := fmt.Sprintf(`SELECT * FROM cmdb_cis %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, orderBy, order, argIdx, argIdx+1)
	args = append(args, limit, offset)
	err = r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ExportCIByCiId returns a CI exportable snapshot by ciId.
func (r *Repository) ExportCIByCiId(ctx context.Context, ciID string, tenantID string) (*models.CI, error) {
	return r.GetCIByCiId(ctx, ciID, &tenantID)
}

// ExportCIs returns CIs matching the export criteria.
func (r *Repository) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) ([]models.CI, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if !includeArchived {
		where += fmt.Sprintf(" AND status != $%d", argIdx)
		args = append(args, "archived")
		argIdx++
	}
	if ciType != nil && *ciType != "" {
		where += fmt.Sprintf(" AND ci_type = $%d", argIdx)
		args = append(args, *ciType)
		argIdx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	if environment != nil && *environment != "" {
		where += fmt.Sprintf(" AND environment = $%d", argIdx)
		args = append(args, *environment)
		argIdx++
	}
	if search != nil && *search != "" {
		where += fmt.Sprintf(" AND (name ILIKE $%d OR ci_id ILIKE $%d)", argIdx, argIdx+1)
		pattern := "%" + *search + "%"
		args = append(args, pattern, pattern)
		argIdx += 2
	}

	var items []models.CI
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM cmdb_cis %s ORDER BY created_at DESC`, where), args...)
	return items, err
}

// --- Relations ---

func (r *Repository) GetCIRelations(ctx context.Context, ciID string) ([]models.CIRelation, error) {
	var relations []models.CIRelation
	err := r.db.SelectContext(ctx, &relations,
		`SELECT * FROM cmdb_ci_relations WHERE from_ci_id=$1 OR to_ci_id=$1`, ciID)
	return relations, err
}

func (r *Repository) CreateRelation(ctx context.Context, rel *models.CIRelation) error {
	rel.ID = uuid.New().String()
	rel.CreatedAt = time.Now().UTC()
	rel.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cmdb_ci_relations (id, from_ci_id, to_ci_id, relation_type, description, tenant_id, created_by, created_at, updated_at)
		 VALUES (:id, :fromCiId, :toCiId, :relationType, :description, :tenantId, :createdBy, :createdAt, :updatedAt)`,
		rel)
	return err
}

func (r *Repository) DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_ci_relations WHERE id=$1 AND tenant_id=$2`, relationID, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Versions ---

func (r *Repository) GetCIVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) {
	var versions []models.CIVersion
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM cmdb_ci_versions WHERE ci_id=$1 ORDER BY version DESC`, ciID)
	return versions, err
}

func (r *Repository) GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error) {
	var v models.CIVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM cmdb_ci_versions WHERE ci_id=$1 ORDER BY version DESC LIMIT 1`, ciID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *Repository) CreateVersion(ctx context.Context, ciID string, version int, snapshot *string, createdBy string, tenantID string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cmdb_ci_versions (id, ci_id, version, snapshot, tenant_id, created_by, created_at)
		 VALUES (:id, :ciId, :version, :snapshot, :tenantId, :createdBy, :createdAt)`,
		map[string]interface{}{
			"id":        uuid.New().String(),
			"ciId":      ciID,
			"version":   version,
			"snapshot":  snapshot,
			"tenantId":  tenantID,
			"createdBy": createdBy,
			"createdAt": time.Now().UTC(),
		})
	return err
}

func (r *Repository) GetVersionSnapshot(ctx context.Context, ciID string, version int) (*string, error) {
	var snapshot string
	err := r.db.GetContext(ctx, &snapshot,
		`SELECT snapshot FROM cmdb_ci_versions WHERE ci_id=$1 AND version=$2`, ciID, version)
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

// --- Topology ---

func (r *Repository) GetTopologyNodes(ctx context.Context, ciType *string, tenantID string, limit int) ([]models.TopologyNode, error) {
	var nodes []models.TopologyNode
	if ciType != nil && *ciType != "" {
		err := r.db.SelectContext(ctx, &nodes,
			`SELECT id AS "id", ci_type AS "type", json_build_object('ci_id', ci_id, 'name', name, 'status', status) AS "data"
			 FROM cmdb_cis WHERE tenant_id=$1 AND ci_type=$2 LIMIT $3`,
			tenantID, *ciType, limit)
		return nodes, err
	}
	err := r.db.SelectContext(ctx, &nodes,
		`SELECT id AS "id", ci_type AS "type", json_build_object('ci_id', ci_id, 'name', name, 'status', status) AS "data"
		 FROM cmdb_cis WHERE tenant_id=$1 LIMIT $2`,
		tenantID, limit)
	return nodes, err
}

func (r *Repository) GetTopologyEdges(ctx context.Context, tenantID string, limit int) ([]models.TopologyEdge, error) {
	var edges []models.TopologyEdge
	err := r.db.SelectContext(ctx, &edges,
		`SELECT from_ci_id AS "source", to_ci_id AS "target", relation_type AS "relationType"
		 FROM cmdb_ci_relations WHERE tenant_id=$1 LIMIT $2`,
		tenantID, limit)
	return edges, err
}

func (r *Repository) GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	var relations []models.CIRelation
	err := r.db.SelectContext(ctx, &relations,
		`SELECT r.* FROM cmdb_ci_relations r
		 WHERE r.from_ci_id=$1 AND r.tenant_id=$2`, ciID, tenantID)
	return relations, err
}

func (r *Repository) GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	var relations []models.CIRelation
	err := r.db.SelectContext(ctx, &relations,
		`SELECT r.* FROM cmdb_ci_relations r
		 WHERE r.to_ci_id=$1 AND r.tenant_id=$2`, ciID, tenantID)
	return relations, err
}

// SearchCIs performs full-text search across CMDB CI fields (name, ci_id,
// ci_type, description) using PostgreSQL to_tsvector/to_tsquery with the
// GIN index defined in migrations/002_fts_search.sql.
func (r *Repository) SearchCIs(ctx context.Context, tenantID, query string, domain string, limit, offset int) ([]models.CI, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	if query == "" {
		return []models.CI{}, nil
	}

	var items []models.CI
	where := "WHERE tenant_id = $1 AND to_tsvector('english', coalesce(name, '') || ' ' || coalesce(ci_id, '') || ' ' || coalesce(ci_type, '') || ' ' || coalesce(description, '')) @@ to_tsquery('english', $2)"
	args := []interface{}{tenantID, fmt.Sprintf("%s:*", query)}
	argIdx := 3

	if domain != "" {
		where += fmt.Sprintf(" AND ci_type = $%d", argIdx)
		args = append(args, domain)
		argIdx++
	}

	orderBy := fmt.Sprintf(` ORDER BY ts_rank(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(ci_id, '') || ' ' || coalesce(ci_type, '') || ' ' || coalesce(description, '')), to_tsquery('english', $%d)) DESC `, argIdx)
	orderByArgs := args
	orderByArgs = append(orderByArgs, fmt.Sprintf("%s:*", query))
	argIdx++

	limitClause := fmt.Sprintf("LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	sql := fmt.Sprintf(`SELECT * FROM cmdb_cis %s%s%s`, where, orderBy, limitClause)
	args = append(orderByArgs, limit, offset)

	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

// NotYetImplemented returns a sentinel error for unimplemented operations.
func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
