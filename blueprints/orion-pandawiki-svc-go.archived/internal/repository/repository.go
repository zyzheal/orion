package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/pandawiki-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

func (r *Repository) CreateSpace(ctx context.Context, s *models.Space) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO kb_spaces (id, tenant_id, name, type, source, owner_id, team_id, description, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, s.ID, s.TenantID, s.Name, s.Type, s.Source, s.OwnerID, s.TeamID, s.Description, time.Now(), time.Now())
	return err
}

func (r *Repository) FindSpaceByID(ctx context.Context, tenantID, id string) (*models.Space, error) {
	var s models.Space
	err := r.db.GetContext(ctx, &s, `SELECT * FROM kb_spaces WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

type ListSpacesOpts struct {
	Type   *string
	Search *string
}

func (r *Repository) ListSpaces(ctx context.Context, tenantID string, offset, limit int, opts *ListSpacesOpts) ([]models.Space, int64, error) {
	clause, args := buildSpaceWhere(tenantID, opts)
	var total int64
	cargs := make([]interface{}, len(args))
	copy(cargs, args)
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM kb_spaces WHERE %s`, clause), cargs...)
	if err != nil {
		return nil, 0, err
	}
	largs := append(cargs, limit, offset)
	lQuery := fmt.Sprintf(`SELECT * FROM kb_spaces WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		clause, len(cargs)+1, len(cargs)+2)
	var spaces []models.Space
	err = r.db.SelectContext(ctx, &spaces, lQuery, largs...)
	if err != nil {
		return nil, total, err
	}
	return spaces, total, err
}

func (r *Repository) UpdateSpace(ctx context.Context, tenantID, id string, input *models.UpdateSpaceInput) (*models.Space, error) {
	set, args, n := buildSpaceSet(input)
	if n == 0 {
		return r.FindSpaceByID(ctx, tenantID, id)
	}
	args = append(args, id, tenantID)
	idIdx := n + 1
	tenantIdx := n + 2
	query := fmt.Sprintf(`
		UPDATE kb_spaces SET %s, updated_at = now()
		WHERE id = $%d AND tenant_id = $%d RETURNING *`, set, idIdx, tenantIdx)
	var s models.Space
	err := r.db.GetContext(ctx, &s, query, args...)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *Repository) DeleteSpace(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM kb_spaces WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("space not found")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

type ListDocsOpts struct {
	SpaceID *string
	Status  *string
	Tag     *string
	Search  *string
	Type    *string
	Source  *string
}

func (r *Repository) CreateDoc(ctx context.Context, doc *models.Doc) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	
	now := time.Now()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO kb_docs (id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, doc.ID, doc.TenantID, doc.SpaceID, doc.Title, doc.Content, doc.Type, doc.Source, doc.Tags, doc.Status, doc.Version, doc.AuthorID, now, now)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO kb_doc_versions (id, doc_id, version, title, content, tags, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`, uuid.New().String(), doc.ID, 1, doc.Title, doc.Content, doc.Tags, now)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE kb_spaces SET doc_count = doc_count + 1, updated_at = now() WHERE id = $1`, doc.SpaceID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *Repository) FindDocByID(ctx context.Context, tenantID, id string) (*models.Doc, error) {
	var d models.Doc
	err := r.db.GetContext(ctx, &d, `SELECT * FROM kb_docs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListDocs(ctx context.Context, tenantID string, offset, limit int, opts *ListDocsOpts) ([]models.Doc, int64, error) {
	clause, args := buildDocWhere(tenantID, opts)
	var total int64
	cargs := make([]interface{}, len(args))
	copy(cargs, args)
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM kb_docs WHERE %s`, clause), cargs...)
	if err != nil {
		return nil, 0, err
	}
	largs := append(cargs, limit, offset)
	lQuery := fmt.Sprintf(`SELECT * FROM kb_docs WHERE %s ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
		clause, len(cargs)+1, len(cargs)+2)
	var docs []models.Doc
	err = r.db.SelectContext(ctx, &docs, lQuery, largs...)
	if err != nil {
		return nil, total, err
	}
	return docs, total, err
}

func (r *Repository) UpdateDoc(ctx context.Context, tenantID, id string, input *models.UpdateDocInput) (*models.Doc, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	

	var d models.Doc
	err = tx.QueryRowContext(ctx, `SELECT id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, created_at, updated_at FROM kb_docs WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(&d.ID, &d.TenantID, &d.SpaceID, &d.Title, &d.Content, &d.Type, &d.Source, &d.Tags, &d.Status, &d.Version, &d.AuthorID, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	newVersion := d.Version + 1
	setParts := []string{fmt.Sprintf("version = $%d", 1)}
	args := []interface{}{newVersion}
	idx := 2

	if input.Title != nil {
		setParts = append(setParts, fmt.Sprintf("title = $%d", idx))
		args = append(args, *input.Title)
		idx++
	}
	if input.Content != nil {
		setParts = append(setParts, fmt.Sprintf("content = $%d", idx))
		args = append(args, *input.Content)
		idx++
	}
	if input.Tags != nil {
		setParts = append(setParts, fmt.Sprintf("tags = $%d", idx))
		args = append(args, models.JSONArray(*input.Tags))
		idx++
	}
	if input.Status != nil {
		status := *input.Status
		setParts = append(setParts, fmt.Sprintf("status = $%d", idx))
		args = append(args, status)
		idx++
	}
	if input.Source != nil {
		setParts = append(setParts, fmt.Sprintf("source = $%d", idx))
		args = append(args, *input.Source)
		idx++
	}

	args = append(args, id)
	whereIdx := idx
	query := fmt.Sprintf(`
		UPDATE kb_docs SET %s, updated_at = now()
		WHERE id = $%d RETURNING *`,
		joinStrings(setParts, ", "), whereIdx)

	var updated models.Doc
	err = tx.QueryRowContext(ctx, query, args...).Scan(&updated.ID, &updated.TenantID, &updated.SpaceID, &updated.Title, &updated.Content, &updated.Type, &updated.Source, &updated.Tags, &updated.Status, &updated.Version, &updated.AuthorID, &updated.CreatedAt, &updated.UpdatedAt)
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO kb_doc_versions (id, doc_id, version, title, content, tags, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.New().String(), updated.ID, updated.Version, updated.Title, updated.Content, updated.Tags, time.Now())
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &updated, nil
}

func (r *Repository) DeleteDoc(ctx context.Context, tenantID, id string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var spaceID string
	err = tx.QueryRowContext(ctx, `SELECT space_id FROM kb_docs WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(&spaceID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("document not found")
		}
		return err
	}

	_, err = tx.ExecContext(ctx, `DELETE FROM kb_docs WHERE id = $1`, id)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE kb_spaces SET doc_count = GREATEST(doc_count - 1, 0), updated_at = now() WHERE id = $1`, spaceID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *Repository) GetDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error) {
	var versions []models.DocVersion
	err := r.db.SelectContext(ctx, &versions, `
		SELECT * FROM kb_doc_versions WHERE doc_id = $1 ORDER BY version DESC`, docID)
	return versions, err
}

// ---------------------------------------------------------------------------
// Search / RAG
// ---------------------------------------------------------------------------

func (r *Repository) Search(ctx context.Context, tenantID, query string, spaceID *string, limit int) ([]models.SearchResult, error) {
	where, args := buildSearchWhere(tenantID, query, spaceID)
	args = append(args, limit)
	limitIdx := len(args)
	queryStr := fmt.Sprintf(`
		SELECT id, title, content, space_id, tags, status,
			CASE
				WHEN title ILIKE $2 THEN 0.9
				WHEN content ILIKE $2 THEN 0.5
				ELSE 0.1
			END as similarity
		FROM kb_docs
		WHERE %s
		ORDER BY similarity DESC LIMIT $%d`, where, limitIdx)
	var results []models.SearchResult
	err := r.db.SelectContext(ctx, &results, queryStr, args...)
	return results, err
}

// ---------------------------------------------------------------------------
// Document Center
// ---------------------------------------------------------------------------

func (r *Repository) GetDocTags(ctx context.Context, tenantID string) ([]models.DocTag, error) {
	var rows []struct {
		Name  string `db:"name"`
		Count int    `db:"count"`
	}
	err := r.db.SelectContext(ctx, &rows, `
		SELECT UNNEST(tags) AS name, COUNT(*) AS count
		FROM kb_docs WHERE tenant_id = $1 AND type = 'docs'
		GROUP BY name ORDER BY count DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	tags := make([]models.DocTag, len(rows))
	for i, row := range rows {
		tags[i] = models.DocTag{Name: row.Name, Count: row.Count}
	}
	return tags, nil
}

func (r *Repository) GetDocToc(ctx context.Context, tenantID string) ([]models.DocTocItem, error) {
	var rows []struct {
		ID    string `db:"id"`
		Title string `db:"title"`
	}
	err := r.db.SelectContext(ctx, &rows, `
		SELECT id, title FROM kb_docs
		WHERE tenant_id = $1 AND type = 'docs' AND status = 'published'
		ORDER BY updated_at DESC LIMIT 200`, tenantID)
	if err != nil {
		return nil, err
	}
	toc := make([]models.DocTocItem, len(rows))
	for i, row := range rows {
		toc[i] = models.DocTocItem{ID: row.ID, Title: row.Title, Order: i}
	}
	return toc, nil
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

func (r *Repository) CreateSyncLog(ctx context.Context, sl *models.SyncLog) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO kb_sync_logs (id, tenant_id, status, source, total_docs, success_docs, failed_docs, error_message, started_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		sl.ID, sl.TenantID, sl.Status, sl.Source, sl.TotalDocs, sl.SuccessDocs, sl.FailedDocs, sl.ErrorMsg, sl.StartedAt, time.Now())
	return err
}

func (r *Repository) ListSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error) {
	var logs []models.SyncLog
	err := r.db.SelectContext(ctx, &logs, `
		SELECT * FROM kb_sync_logs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`, tenantID, limit)
	return logs, err
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

func buildSpaceWhere(tenantID string, opts *ListSpacesOpts) (string, []interface{}) {
	clause := "tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if opts != nil {
		if opts.Type != nil && *opts.Type != "" {
			clause += fmt.Sprintf(" AND type = $%d", idx)
			args = append(args, *opts.Type)
			idx++
		}
		if opts.Search != nil && *opts.Search != "" {
			clause += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", idx, idx)
			args = append(args, "%"+*opts.Search+"%")
			idx++
		}
	}
	return clause, args
}

func buildSpaceSet(input *models.UpdateSpaceInput) (string, []interface{}, int) {
	parts := []string{}
	args := []interface{}{}
	n := 0

	if input.Name != nil {
		n++
		parts = append(parts, fmt.Sprintf("name = $%d", n))
		args = append(args, *input.Name)
	}
	if input.Type != nil {
		n++
		parts = append(parts, fmt.Sprintf("type = $%d", n))
		args = append(args, *input.Type)
	}
	if input.Source != nil {
		n++
		parts = append(parts, fmt.Sprintf("source = $%d", n))
		args = append(args, *input.Source)
	}
	if input.TeamID != nil {
		n++
		parts = append(parts, fmt.Sprintf("team_id = $%d", n))
		args = append(args, *input.TeamID)
	}
	if input.Description != nil {
		n++
		parts = append(parts, fmt.Sprintf("description = $%d", n))
		args = append(args, *input.Description)
	}

	return joinStrings(parts, ", "), args, n
}

func buildDocWhere(tenantID string, opts *ListDocsOpts) (string, []interface{}) {
	clause := "tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if opts != nil {
		if opts.SpaceID != nil {
			clause += fmt.Sprintf(" AND space_id = $%d", idx)
			args = append(args, *opts.SpaceID)
			idx++
		}
		if opts.Status != nil && *opts.Status != "" {
			clause += fmt.Sprintf(" AND status = $%d", idx)
			args = append(args, *opts.Status)
			idx++
		}
		if opts.Tag != nil && *opts.Tag != "" {
			clause += fmt.Sprintf(" AND $%d = ANY(tags)", idx)
			args = append(args, *opts.Tag)
			idx++
		}
		if opts.Type != nil && *opts.Type != "" {
			clause += fmt.Sprintf(" AND type = $%d", idx)
			args = append(args, *opts.Type)
			idx++
		}
		if opts.Source != nil && *opts.Source != "" {
			clause += fmt.Sprintf(" AND source = $%d", idx)
			args = append(args, *opts.Source)
			idx++
		}
		if opts.Search != nil && *opts.Search != "" {
			clause += fmt.Sprintf(" AND (title ILIKE $%d OR content ILIKE $%d)", idx, idx)
			args = append(args, "%"+*opts.Search+"%")
			idx++
		}
	}
	return clause, args
}

func buildSearchWhere(tenantID, query string, spaceID *string) (string, []interface{}) {
	clause := "tenant_id = $1 AND status = 'published' AND (title ILIKE $2 OR content ILIKE $2)"
	args := []interface{}{tenantID, "%" + query + "%"}
	if spaceID != nil {
		clause += " AND space_id = $3"
		args = append(args, *spaceID)
	}
	return clause, args
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	out := parts[0]
	for _, p := range parts[1:] {
		out += sep + p
	}
	return out
}
