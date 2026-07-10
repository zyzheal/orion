package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/database"
	"orion/knowledge-svc-go/internal/models"
)

// KnowledgeRepository provides data access for knowledge base operations.
type KnowledgeRepository struct {
	database.BaseRepository
}

func NewKnowledgeRepository(db *database.DB) *KnowledgeRepository {
	return &KnowledgeRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

// ============================================================================
// Space operations
// ============================================================================

func (r *KnowledgeRepository) CreateSpace(ctx context.Context, space *models.KnowledgeSpace) error {
	query := `INSERT INTO kb_spaces (id, tenant_id, name, type, source, owner_id, team_id, description, doc_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, created_at, updated_at`
	err := r.DB().QueryRowContext(ctx, query,
		space.ID, space.TenantID, space.Name, space.Type, space.Source,
		space.OwnerID, space.TeamID, space.Description, space.DocCount,
		space.CreatedAt, space.UpdatedAt,
	).Scan(&space.ID, &space.CreatedAt, &space.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create space: %w", err)
	}
	return nil
}

func (r *KnowledgeRepository) FindSpaceByID(ctx context.Context, id string) (*models.KnowledgeSpace, error) {
	var space models.KnowledgeSpace
	err := r.DB().GetContext(ctx, &space,
		"SELECT id, tenant_id, name, type, source, owner_id, team_id, description, doc_count, created_at, updated_at FROM kb_spaces WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find space: %w", err)
	}
	return &space, nil
}

func (r *KnowledgeRepository) FindSpaceByTenantID(ctx context.Context, tenantID, id string) (*models.KnowledgeSpace, error) {
	var space models.KnowledgeSpace
	err := r.DB().GetContext(ctx, &space,
		"SELECT id, tenant_id, name, type, source, owner_id, team_id, description, doc_count, created_at, updated_at FROM kb_spaces WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find space: %w", err)
	}
	return &space, nil
}

func (r *KnowledgeRepository) ListSpaces(ctx context.Context, tenantID string, filters models.SpaceListFilters) ([]models.KnowledgeSpace, error) {
	query := `SELECT id, tenant_id, name, type, source, owner_id, team_id, description, doc_count, created_at, updated_at
		FROM kb_spaces WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.Type != nil && *filters.Type != "" {
		query += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, *filters.Type)
		argIdx++
	}
	if filters.Source != nil && *filters.Source != "" {
		query += fmt.Sprintf(" AND source = $%d", argIdx)
		_ = args
		args = append(args, *filters.Source)
		argIdx++
	}
	if filters.Search != nil && *filters.Search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+*filters.Search+"%")
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, filters.Limit, filters.Offset)

	var spaces []models.KnowledgeSpace
	if err := r.DB().SelectContext(ctx, &spaces, query, args...); err != nil {
		return nil, fmt.Errorf("failed to list spaces: %w", err)
	}
	return spaces, nil
}

func (r *KnowledgeRepository) UpdateSpace(ctx context.Context, id string, updates map[string]interface{}) error {
	setParts, args, argIdx := buildSet(updates, []string{"name", "type", "source", "team_id", "description"})
	if len(setParts) == 0 {
		return nil
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, "now()")
	argIdx++
	args = append(args, id)

	query := fmt.Sprintf("UPDATE kb_spaces SET %s WHERE id = $%d", joinSet(setParts), argIdx)
	_, err := r.DB().ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update space: %w", err)
	}
	return nil
}

func (r *KnowledgeRepository) DeleteSpace(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx, "DELETE FROM kb_spaces WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete space: %w", err)
	}
	return nil
}

// ============================================================================
// Document operations
// ============================================================================

// CreateDoc inserts a document, its initial version, and increments the space's
// doc_count — all in a single database transaction, mirroring TS KnowledgeRepository.
func (r *KnowledgeRepository) CreateDoc(ctx context.Context, doc *models.KnowledgeDoc) error {
	tx, err := r.DB().BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 1. Insert document
	err = tx.QueryRowContext(ctx, `
		INSERT INTO kb_docs (id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, embedding, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, version, created_at, updated_at`,
		doc.ID, doc.TenantID, doc.SpaceID, doc.Title, doc.Content,
		doc.Type, doc.Source, doc.Tags, doc.Status, doc.Version,
		doc.AuthorID, doc.Embedding, doc.CreatedAt, doc.UpdatedAt,
	).Scan(&doc.ID, &doc.Version, &doc.CreatedAt, &doc.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert doc: %w", err)
	}

	// 2. Insert initial version snapshot
	version := &models.DocVersion{
		ID:        newID(),
		DocID:     doc.ID,
		Version:   1,
		Title:     doc.Title,
		Content:   doc.Content,
		Tags:      doc.Tags,
		CreatedAt: doc.CreatedAt,
	}
	err = insertDocVersionInTx(ctx, tx, version)
	if err != nil {
		return fmt.Errorf("failed to insert doc version: %w", err)
	}

	// 3. Increment space doc_count
	_, err = tx.ExecContext(ctx,
		"UPDATE kb_spaces SET doc_count = doc_count + 1, updated_at = now() WHERE id = $1", doc.SpaceID)
	if err != nil {
		return fmt.Errorf("failed to update space doc_count: %w", err)
	}

	return tx.Commit()
}

func (r *KnowledgeRepository) FindDocByID(ctx context.Context, id string) (*models.KnowledgeDoc, error) {
	var doc models.KnowledgeDoc
	err := r.DB().GetContext(ctx, &doc,
		"SELECT id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, embedding, created_at, updated_at FROM kb_docs WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find doc: %w", err)
	}
	return &doc, nil
}

func (r *KnowledgeRepository) ListDocs(ctx context.Context, tenantID string, filters models.DocListFilters) ([]models.KnowledgeDoc, error) {
	selectCols := `SELECT id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, embedding, created_at, updated_at FROM kb_docs WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.SpaceID != nil && *filters.SpaceID != "" {
		selectCols += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *filters.SpaceID)
		argIdx++
	}
	if filters.Status != nil && *filters.Status != "" {
		selectCols += fmt.Sprintf(" AND status = $%d", argIdx)
		_ = args
		args = append(args, *filters.Status)
		argIdx++
	}
	if filters.Tag != nil && *filters.Tag != "" {
		selectCols += fmt.Sprintf(" AND $%d = ANY(tags)", argIdx)
		args = append(args, *filters.Tag)
		argIdx++
	}
	if filters.Search != nil && *filters.Search != "" {
		selectCols += fmt.Sprintf(" AND (title ILIKE $%d OR content ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+*filters.Search+"%")
		_ = args
		argIdx++
	}
	if filters.Type != nil && *filters.Type != "" {
		selectCols += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, *filters.Type)
		_ = args
		argIdx++
	}
	if filters.Source != nil && *filters.Source != "" {
		selectCols += fmt.Sprintf(" AND source = $%d", argIdx)
		args = append(args, *filters.Source)
		_ = args
		argIdx++
	}

	selectCols += fmt.Sprintf(" ORDER BY updated_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, filters.Limit, filters.Offset)

	var docs []models.KnowledgeDoc
	if err := r.DB().SelectContext(ctx, &docs, selectCols, args...); err != nil {
		return nil, fmt.Errorf("failed to list docs: %w", err)
	}
	return docs, nil
}

func (r *KnowledgeRepository) UpdateDoc(ctx context.Context, id string, updates map[string]interface{}) error {
	setParts, args, argIdx := buildSet(updates, []string{"title", "content", "tags", "status", "source"})
	if len(setParts) == 0 {
		return nil
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, "now()")
	argIdx++
	args = append(args, id)

	query := fmt.Sprintf("UPDATE kb_docs SET %s WHERE id = $%d", joinSet(setParts), argIdx)
	_, err := r.DB().ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update doc: %w", err)
	}
	return nil
}

// DeleteDoc deletes a document and decrements the space's doc_count — in a single
// transaction, mirroring TS KnowledgeRepository.deleteDoc().
func (r *KnowledgeRepository) DeleteDoc(ctx context.Context, id string) error {
	tx, err := r.DB().BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Get space_id
	var spaceID string
	err = tx.GetContext(ctx, &spaceID, "SELECT space_id FROM kb_docs WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil // already gone
		}
		return fmt.Errorf("failed to get doc space: %w", err)
	}

	// Delete doc (FK cascade removes versions)
	_, err = tx.ExecContext(ctx, "DELETE FROM kb_docs WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete doc: %w", err)
	}

	// Decrement doc_count
	_, err = tx.ExecContext(ctx,
		"UPDATE kb_spaces SET doc_count = GREATEST(doc_count - 1, 0), updated_at = now() WHERE id = $1", spaceID)
	if err != nil {
		return fmt.Errorf("failed to update space doc_count: %w", err)
	}

	return tx.Commit()
}

// ============================================================================
// Document version operations
// ============================================================================

func (r *KnowledgeRepository) CreateDocVersion(ctx context.Context, version *models.DocVersion) error {
	tx, err := r.DB().BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	err = insertDocVersionInTx(ctx, tx, version)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func insertDocVersionInTx(ctx context.Context, tx *sqlx.Tx, version *models.DocVersion) error {
	err := tx.QueryRowContext(ctx, `
		INSERT INTO kb_doc_versions (id, doc_id, version, title, content, tags, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
		version.ID, version.DocID, version.Version, version.Title, version.Content, version.Tags, version.CreatedAt,
	).Scan(&version.ID, &version.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create doc version: %w", err)
	}
	return nil
}

func (r *KnowledgeRepository) ListDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error) {
	var versions []models.DocVersion
	err := r.DB().SelectContext(ctx, &versions,
		"SELECT id, doc_id, version, title, content, tags, created_at FROM kb_doc_versions WHERE doc_id = $1 ORDER BY version DESC", docID)
	if err != nil {
		return nil, fmt.Errorf("failed to list doc versions: %w", err)
	}
	return versions, nil
}

// ============================================================================
// Search operations
// ============================================================================

// SearchDocs performs ILIKE-based search on published docs, mirroring the TS
// KnowledgeRepository.search() with title/content similarity scoring.
func (r *KnowledgeRepository) SearchDocs(ctx context.Context, tenantID, query string, spaceID *string, limit int) ([]models.KnowledgeSearchResult, error) {
	likePattern := "%" + query + "%"
	queryStr := `
		SELECT id, title, content, space_id, tags, status,
			(CASE
				WHEN title ILIKE $2 THEN 0.9
				WHEN content ILIKE $2 THEN 0.5
				ELSE 0.1
			END) AS similarity
		FROM kb_docs
		WHERE tenant_id = $1 AND status = 'published' AND (title ILIKE $2 OR content ILIKE $2)`
	args := []interface{}{tenantID, likePattern}
	argIdx := 3

	if spaceID != nil && *spaceID != "" {
		queryStr += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *spaceID)
		argIdx++
	}

	queryStr += fmt.Sprintf(" ORDER BY similarity DESC LIMIT $%d", argIdx)
	args = append(args, limit)

	var results []models.KnowledgeSearchResult
	if err := r.DB().SelectContext(ctx, &results, queryStr, args...); err != nil {
		return nil, fmt.Errorf("failed to search docs: %w", err)
	}
	return results, nil
}

// ============================================================================
// Tag / Stats operations
// ============================================================================

func (r *KnowledgeRepository) GetDocTags(ctx context.Context, tenantID string) ([]models.DocTag, error) {
	var tags []models.DocTag
	query := `SELECT DISTINCT jsonb_array_elements_text(tags) AS name, COUNT(*) AS count
		FROM kb_docs WHERE tenant_id = $1 AND tags IS NOT NULL
		GROUP BY name ORDER BY count DESC`
	if err := r.DB().SelectContext(ctx, &tags, query, tenantID); err != nil {
		return nil, fmt.Errorf("failed to get doc tags: %w", err)
	}
	return tags, nil
}

func (r *KnowledgeRepository) GetNextDocVersion(ctx context.Context, docID string) (int, error) {
	var version int
	err := r.DB().GetContext(ctx, &version,
		"SELECT COALESCE(MAX(version), 0) + 1 FROM kb_doc_versions WHERE doc_id = $1", docID)
	if err != nil {
		return 0, fmt.Errorf("failed to get next version: %w", err)
	}
	return version, nil
}

// ============================================================================
// Helpers
// ============================================================================

func buildSet(updates map[string]interface{}, fields []string) ([]string, []interface{}, int) {
	setParts := []string{}
	args := []interface{}{}
	argIdx := 1
	for _, field := range fields {
		if val, ok := updates[field]; ok && val != nil {
			setParts = append(setParts, fmt.Sprintf("%s = $%d", field, argIdx))
			args = append(args, val)
			argIdx++
		}
	}
	return setParts, args, argIdx
}

func joinSet(parts []string) string {
	result := ""
	for i, part := range parts {
		if i > 0 {
			result += ", "
		}
		result += part
	}
	return result
}
