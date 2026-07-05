package repository

import (
	"context"
	"database/sql"
	"fmt"

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
	return err
}

func (r *KnowledgeRepository) FindSpaceByID(ctx context.Context, id string) (*models.KnowledgeSpace, error) {
	var space models.KnowledgeSpace
	query := `SELECT id, tenant_id, name, type, source, owner_id, team_id, description, doc_count, created_at, updated_at
		FROM kb_spaces WHERE id = $1`
	err := r.DB().GetContext(ctx, &space, query, id)
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
	if filters.Search != nil && *filters.Search != "" {
		query += fmt.Sprintf(" AND name ILIKE $%d", argIdx)
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
	setParts := []string{}
	args := []interface{}{}
	argIdx := 1

	for _, field := range []string{"name", "type", "source", "team_id", "description"} {
		if val, ok := updates[field]; ok && val != nil {
			setParts = append(setParts, fmt.Sprintf("%s = $%d", field, argIdx))
			args = append(args, val)
			argIdx++
		}
	}

	if len(setParts) == 0 {
		return nil
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, "now()")
	argIdx++

	args = append(args, id)
	query := fmt.Sprintf("UPDATE kb_spaces SET %s WHERE id = $%d", joinSet(setParts), argIdx)
	_, err := r.DB().ExecContext(ctx, query, args...)
	return err
}

func (r *KnowledgeRepository) DeleteSpace(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx, "DELETE FROM kb_spaces WHERE id = $1", id)
	return err
}

// ============================================================================
// Document operations
// ============================================================================

func (r *KnowledgeRepository) CreateDoc(ctx context.Context, doc *models.KnowledgeDoc) error {
	query := `INSERT INTO kb_docs (id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, embedding, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, version, created_at, updated_at`
	err := r.DB().QueryRowContext(ctx, query,
		doc.ID, doc.TenantID, doc.SpaceID, doc.Title, doc.Content,
		doc.Type, doc.Source, doc.Tags, doc.Status, doc.Version,
		doc.AuthorID, doc.Embedding, doc.CreatedAt, doc.UpdatedAt,
	).Scan(&doc.ID, &doc.Version, &doc.CreatedAt, &doc.UpdatedAt)
	return err
}

func (r *KnowledgeRepository) FindDocByID(ctx context.Context, id string) (*models.KnowledgeDoc, error) {
	var doc models.KnowledgeDoc
	query := `SELECT id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, embedding, created_at, updated_at
		FROM kb_docs WHERE id = $1`
	err := r.DB().GetContext(ctx, &doc, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find doc: %w", err)
	}
	return &doc, nil
}

func (r *KnowledgeRepository) ListDocs(ctx context.Context, tenantID string, filters models.DocListFilters) ([]models.KnowledgeDoc, error) {
	query := `SELECT id, tenant_id, space_id, title, content, type, source, tags, status, version, author_id, embedding, created_at, updated_at
		FROM kb_docs WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.SpaceID != nil && *filters.SpaceID != "" {
		query += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *filters.SpaceID)
		argIdx++
	}
	if filters.Status != nil && *filters.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filters.Status)
		argIdx++
	}
	if filters.Tag != nil && *filters.Tag != "" {
		query += fmt.Sprintf(" AND $%d = ANY(tags)", argIdx)
		args = append(args, *filters.Tag)
		argIdx++
	}
	if filters.Search != nil && *filters.Search != "" {
		query += fmt.Sprintf(" AND (title ILIKE $%d OR content ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+*filters.Search+"%")
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY updated_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, filters.Limit, filters.Offset)

	var docs []models.KnowledgeDoc
	if err := r.DB().SelectContext(ctx, &docs, query, args...); err != nil {
		return nil, fmt.Errorf("failed to list docs: %w", err)
	}
	return docs, nil
}

func (r *KnowledgeRepository) UpdateDoc(ctx context.Context, id string, updates map[string]interface{}) error {
	setParts := []string{}
	args := []interface{}{}
	argIdx := 1

	for _, field := range []string{"title", "content", "tags", "status", "source"} {
		if val, ok := updates[field]; ok && val != nil {
			setParts = append(setParts, fmt.Sprintf("%s = $%d", field, argIdx))
			args = append(args, val)
			argIdx++
		}
	}

	if len(setParts) == 0 {
		return nil
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, "now()")
	argIdx++

	args = append(args, id)
	query := fmt.Sprintf("UPDATE kb_docs SET %s WHERE id = $%d", joinSet(setParts), argIdx)
	_, err := r.DB().ExecContext(ctx, query, args...)
	return err
}

func (r *KnowledgeRepository) DeleteDoc(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx, "DELETE FROM kb_docs WHERE id = $1", id)
	return err
}

// ============================================================================
// Document version operations
// ============================================================================

func (r *KnowledgeRepository) CreateDocVersion(ctx context.Context, version *models.DocVersion) error {
	query := `INSERT INTO kb_doc_versions (id, doc_id, version, title, content, tags, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`
	err := r.DB().QueryRowContext(ctx, query,
		version.ID, version.DocID, version.Version, version.Title,
		version.Content, version.Tags, version.CreatedAt,
	).Scan(&version.ID, &version.CreatedAt)
	return err
}

func (r *KnowledgeRepository) ListDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error) {
	var versions []models.DocVersion
	query := `SELECT id, doc_id, version, title, content, tags, created_at
		FROM kb_doc_versions WHERE doc_id = $1 ORDER BY version DESC`
	if err := r.DB().SelectContext(ctx, &versions, query, docID); err != nil {
		return nil, fmt.Errorf("failed to list doc versions: %w", err)
	}
	return versions, nil
}

// ============================================================================
// Search operations
// ============================================================================

func (r *KnowledgeRepository) SearchDocs(ctx context.Context, tenantID, query string, spaceID *string, limit int) ([]models.KnowledgeSearchResult, error) {
	searchQuery := `
		SELECT id, title, content, space_id, tags, status,
			   1.0 / (1.0 + ABS(LENGTH(content) - LENGTH($2))) AS similarity
		FROM kb_docs
		WHERE tenant_id = $1 AND status = 'published'`
	args := []interface{}{tenantID, query}
	argIdx := 3

	if spaceID != nil && *spaceID != "" {
		searchQuery += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *spaceID)
		argIdx++
	}

	searchQuery += fmt.Sprintf(" ORDER BY similarity DESC LIMIT $%d", argIdx)
	args = append(args, limit)

	var results []models.KnowledgeSearchResult
	if err := r.DB().SelectContext(ctx, &results, searchQuery, args...); err != nil {
		return nil, fmt.Errorf("failed to search docs: %w", err)
	}
	return results, nil
}

func (r *KnowledgeRepository) GetDocTags(ctx context.Context, tenantID string) ([]models.DocTag, error) {
	var tags []models.DocTag
	query := `
		SELECT DISTINCT unnest(tags) as name, COUNT(*) as count
		FROM kb_docs
		WHERE tenant_id = $1 AND tags IS NOT NULL
		GROUP BY name
		ORDER BY count DESC`
	if err := r.DB().SelectContext(ctx, &tags, query, tenantID); err != nil {
		return nil, fmt.Errorf("failed to get doc tags: %w", err)
	}
	return tags, nil
}

func (r *KnowledgeRepository) GetNextDocVersion(ctx context.Context, docID string) (int, error) {
	var version int
	query := `SELECT COALESCE(MAX(version), 0) + 1 FROM kb_doc_versions WHERE doc_id = $1`
	if err := r.DB().GetContext(ctx, &version, query, docID); err != nil {
		return 0, fmt.Errorf("failed to get next version: %w", err)
	}
	return version, nil
}

// ============================================================================
// Helpers
// ============================================================================

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
