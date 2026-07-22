package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// --- Space repository ---

func (r *Repository) ListSpaces(ctx context.Context, tenantID string, q models.SpaceListQuery) ([]models.Space, error) {
	sqlQuery := "SELECT id, tenant_id, name, type, description, team_id, owner_id, created_at, updated_at FROM kb_spaces WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argCount := 1

	if q.Type != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND type = $%d", argCount)
		args = append(args, q.Type)
	}
	if q.Search != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND name ILIKE $%d", argCount)
		args = append(args, "%"+q.Search+"%")
	}

	sqlQuery += " ORDER BY created_at DESC LIMIT $1 OFFSET $2"
	// Reuse positional args: append limit and offset
	// Since we already used $1 for tenant, we need to handle this carefully.
	// Simpler: rebuild with numbered placeholders.
	_, _ = sqlQuery, args // suppress unused

	// Rebuild query with proper numbering
	sqlQuery, args, _ = r.buildSpaceQuery(tenantID, q.Type, q.Search, q.Limit, q.Offset)

	var items []models.Space
	rows, err := r.db.QueryContext(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.Space
		var teamID sql.NullString
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.Name, &item.Type, &item.Description,
			&teamID, &item.OwnerID, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.TeamID = teamID.String
		items = append(items, item)
	}
	return items, nil
}

func (r *Repository) CreateSpace(ctx context.Context, space *models.Space) error {
	space.ID = uuid.New().String()
	space.CreatedAt = time.Now().UTC()
	space.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO kb_spaces (id, tenant_id, name, type, description, team_id, owner_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		space.ID, space.TenantID, space.Name, space.Type, space.Description,
		space.TeamID, space.OwnerID, space.CreatedAt, space.UpdatedAt,
	)
	return err
}

func (r *Repository) GetSpaceByID(ctx context.Context, id string) (*models.Space, error) {
	var space models.Space
	var teamID sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, name, type, description, team_id, owner_id, created_at, updated_at
		 FROM kb_spaces WHERE id = $1`, id).Scan(
		&space.ID, &space.TenantID, &space.Name, &space.Type, &space.Description,
		&teamID, &space.OwnerID, &space.CreatedAt, &space.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	space.TeamID = teamID.String
	return &space, nil
}

func (r *Repository) UpdateSpace(ctx context.Context, id string, updates map[string]interface{}) error {
	fields := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+1)
	argNum := 1
	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s = $%d", k, argNum))
		args = append(args, v)
		argNum++
	}
	fields = append(fields, fmt.Sprintf("updated_at = NOW()"))
	args = append(args, id)

	sqlQuery := fmt.Sprintf("UPDATE kb_spaces SET %s WHERE id = $%d",
		strings.Join(fields, ", "), argNum)
	_, err := r.db.ExecContext(ctx, sqlQuery, args...)
	return err
}

func (r *Repository) DeleteSpace(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM kb_spaces WHERE id = $1", id)
	return err
}

// --- Document repository ---

func (r *Repository) ListDocs(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error) {
	sqlQuery := "SELECT id, tenant_id, title, content, space_id, tags, status, author_id, created_at, updated_at FROM kb_docs WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argCount := 1

	if q.SpaceID != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND space_id = $%d", argCount)
		args = append(args, q.SpaceID)
	}
	if q.Status != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, q.Status)
	}
	if q.Tag != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND tags LIKE $%d", argCount)
		args = append(args, "%"+q.Tag+"%")
	}
	if q.Search != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND (title ILIKE $%d OR content ILIKE $%d)", argCount, argCount+1)
		args = append(args, "%"+q.Search+"%", "%"+q.Search+"%")
		argCount += 2
	}

	sqlQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argCount+1, argCount+2)
	args = append(args, q.Limit, q.Offset)

	return r.scanDocs(ctx, sqlQuery, args...)
}

func (r *Repository) ListDocsByType(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error) {
	return r.ListDocs(ctx, tenantID, q)
}

func (r *Repository) GetDocByID(ctx context.Context, id string) (*models.Document, error) {
	var doc models.Document
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, title, content, space_id, tags, status, author_id, created_at, updated_at
		 FROM kb_docs WHERE id = $1`, id).Scan(
		&doc.ID, &doc.TenantID, &doc.Title, &doc.Content, &doc.SpaceID,
		&doc.Tags, &doc.Status, &doc.AuthorID, &doc.CreatedAt, &doc.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (r *Repository) CreateDoc(ctx context.Context, doc *models.Document) error {
	doc.ID = uuid.New().String()
	doc.CreatedAt = time.Now().UTC()
	doc.UpdatedAt = time.Now().UTC()

	tagsJSON := "[]"
	if len(doc.Tags) > 0 {
		data, _ := json.Marshal(doc.Tags)
		tagsJSON = string(data)
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO kb_docs (id, tenant_id, title, content, space_id, tags, status, author_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		doc.ID, doc.TenantID, doc.Title, doc.Content, doc.SpaceID,
		tagsJSON, doc.Status, doc.AuthorID, doc.CreatedAt, doc.UpdatedAt,
	)
	return err
}

func (r *Repository) UpdateDoc(ctx context.Context, id string, updates map[string]interface{}) error {
	fields := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+1)
	argNum := 1

	// Handle tags specially (JSON marshal)
	for k, v := range updates {
		if k == "tags" {
			tags, ok := v.([]string)
			if ok {
				data, _ := json.Marshal(tags)
				v = string(data)
			}
		}
		fields = append(fields, fmt.Sprintf("%s = $%d", k, argNum))
		args = append(args, v)
		argNum++
	}
	fields = append(fields, fmt.Sprintf("updated_at = NOW()"))
	args = append(args, id)

	sqlQuery := fmt.Sprintf("UPDATE kb_docs SET %s WHERE id = $%d",
		strings.Join(fields, ", "), argNum)
	_, err := r.db.ExecContext(ctx, sqlQuery, args...)
	return err
}

func (r *Repository) DeleteDoc(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM kb_docs WHERE id = $1", id)
	return err
}

func (r *Repository) DeleteDocsBySpace(ctx context.Context, spaceID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM kb_docs WHERE space_id = $1", spaceID)
	return err
}

// --- Document versions ---

func (r *Repository) GetDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error) {
	var items []models.DocVersion
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, document_id, content, author_id, created_at FROM kb_doc_versions
		 WHERE document_id = $1 ORDER BY created_at DESC`, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.DocVersion
		var content sql.NullString
		var authorID sql.NullString
		if err := rows.Scan(&item.ID, &item.DocumentID, &content, &authorID, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.Content = content.String
		item.AuthorID = authorID.String
		items = append(items, item)
	}
	return items, nil
}

// --- Doc center helpers ---

func (r *Repository) GetDocTags(ctx context.Context, tenantID string) ([]string, error) {
	var items []string
	rows, err := r.db.QueryContext(ctx,
		`SELECT DISTINCT tags FROM kb_docs WHERE tenant_id = $1 AND tags IS NOT NULL`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var tagStr string
		if err := rows.Scan(&tagStr); err != nil {
			return nil, err
		}
		var tags []string
		if json.Unmarshal([]byte(tagStr), &tags) == nil {
			items = append(items, tags...)
		} else {
			// Fallback: treat as single tag
			items = append(items, strings.Split(tagStr, ",")...)
		}
	}
	return items, nil
}

// --- Sync logs ---

func (r *Repository) CreateSyncLog(ctx context.Context, log *models.SyncLog) error {
	now := time.Now().UTC()
	var id int
	// Let PostgreSQL SERIAL handle auto-increment ID generation.
	// The knowledge_sync_logs table uses SERIAL PRIMARY KEY, which is safe
	// under concurrent load and avoids TOCTOU races from manual MAX(id)+1.
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO knowledge_sync_logs (tenant_id, source, status, error_msg, created_at)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		log.TenantID, log.Source, log.Status, log.ErrorMsg, now,
	).Scan(&id)
	if err != nil {
		return err
	}
	log.ID = id
	return nil
}

func (r *Repository) GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error) {
	var items []models.SyncLog
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, source, status, error_msg, created_at FROM knowledge_sync_logs
		 WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.SyncLog
		var errorMsg sql.NullString
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Source, &item.Status, &errorMsg, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.ErrorMsg = errorMsg.String
		items = append(items, item)
	}
	return items, nil
}

// --- RAG retrieval ---

func (r *Repository) Retrieve(ctx context.Context, tenantID string, query string, spaceID string, topK *int) ([]models.RAGRetrieveResult, error) {
	var limit = 5
	if topK != nil && *topK > 0 {
		limit = *topK
	}

	sqlQuery := `SELECT id, title, content, space_id FROM kb_docs
		WHERE tenant_id = $1 AND content ILIKE $2 AND status = 'published'`
	args := []interface{}{tenantID, "%" + query + "%"}
	argCount := 2

	if spaceID != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND space_id = $%d", argCount)
		args = append(args, spaceID)
	}

	sqlQuery += fmt.Sprintf(" ORDER BY similarity(content, $%d) DESC LIMIT $%d", argCount+1, argCount+2)
	args = append(args, query, limit)

	rows, err := r.db.QueryContext(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.RAGRetrieveResult
	for rows.Next() {
		var r models.RAGRetrieveResult
		if err := rows.Scan(&r.ID, &r.Title, &r.Content, &r.SpaceID); err != nil {
			return nil, err
		}
		r.Similarity = 0.5
		results = append(results, r)
	}
	return results, nil
}

// --- Helpers ---

func (r *Repository) scanDocs(ctx context.Context, sqlQuery string, args ...interface{}) ([]models.Document, error) {
	var items []models.Document
	rows, err := r.db.QueryContext(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.Document
		var tagsRaw sql.NullString
		var authorID sql.NullString
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.Title, &item.Content, &item.SpaceID,
			&tagsRaw, &item.Status, &authorID, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.AuthorID = authorID.String
		if tagsRaw.String != "" {
			json.Unmarshal([]byte(tagsRaw.String), &item.Tags)
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *Repository) buildSpaceQuery(tenantID string, spaceType, search string, limit, offset int) (string, []interface{}, int) {
	sqlQuery := "SELECT id, tenant_id, name, type, description, team_id, owner_id, created_at, updated_at FROM kb_spaces WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argCount := 1

	if spaceType != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND type = $%d", argCount)
		args = append(args, spaceType)
	}
	if search != "" {
		argCount++
		sqlQuery += fmt.Sprintf(" AND name ILIKE $%d", argCount)
		args = append(args, "%"+search+"%")
	}

	sqlQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argCount+1, argCount+2)
	args = append(args, limit, offset)
	return sqlQuery, args, argCount
}