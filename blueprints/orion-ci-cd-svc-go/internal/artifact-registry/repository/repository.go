package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/ci-cd-svc-go/internal/artifact-registry/models"
)

type ArtifactRegistryRepository struct {
	DB *sql.DB
}

func NewArtifactRegistryRepository(db *sql.DB) *ArtifactRegistryRepository {
	return &ArtifactRegistryRepository{DB: db}
}

// CreateRegistry creates a new artifact registry.
func (r *ArtifactRegistryRepository) CreateRegistry(ctx context.Context, tenantID string, req *models.CreateRegistryRequest) (*models.ArtifactRegistry, error) {
	now := time.Now()
	id := fmt.Sprintf("reg_%d", time.Now().UnixNano())

	query := `INSERT INTO artifact_registries (id, tenant_id, name, type, base_url, description, config, is_enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	_, err := r.DB.ExecContext(ctx, query, id, tenantID, req.Name, req.Type, req.BaseURL, req.Description, req.Config, true, now, now)
	if err != nil {
		return nil, fmt.Errorf("create artifact registry: %w", err)
	}

	return &models.ArtifactRegistry{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Type:        req.Type,
		BaseURL:     req.BaseURL,
		Description: req.Description,
		Config:      req.Config,
		IsEnabled:   true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// QueryRegistries returns paginated registries.
func (r *ArtifactRegistryRepository) QueryRegistries(ctx context.Context, tenantID string, limit, offset int) (models.RegistryResponse, error) {
	var resp models.RegistryResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM artifact_registries WHERE tenant_id = $1`
	query := `SELECT id, tenant_id, name, type, base_url, description, config, is_enabled, created_at, updated_at FROM artifact_registries WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	if err := r.DB.QueryRowContext(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count registries: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query registries: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var reg models.ArtifactRegistry
		if err := rows.Scan(&reg.ID, &reg.TenantID, &reg.Name, &reg.Type, &reg.BaseURL, &reg.Description, &reg.Config, &reg.IsEnabled, &reg.CreatedAt, &reg.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan registry: %w", err)
		}
		resp.Data = append(resp.Data, reg)
	}
	return resp, nil
}

// GetRegistry returns a registry by ID.
func (r *ArtifactRegistryRepository) GetRegistry(ctx context.Context, tenantID, id string) (*models.ArtifactRegistry, error) {
	var reg models.ArtifactRegistry
	query := `SELECT id, tenant_id, name, type, base_url, description, config, is_enabled, created_at, updated_at FROM artifact_registries WHERE id = $1 AND tenant_id = $2`
	if err := r.DB.QueryRowContext(ctx, query, id, tenantID).Scan(
		&reg.ID, &reg.TenantID, &reg.Name, &reg.Type, &reg.BaseURL, &reg.Description, &reg.Config, &reg.IsEnabled, &reg.CreatedAt, &reg.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("registry not found: %s", id)
		}
		return nil, fmt.Errorf("get registry: %w", err)
	}
	return &reg, nil
}

// PushArtifact pushes an artifact to the registry.
func (r *ArtifactRegistryRepository) PushArtifact(ctx context.Context, tenantID string, req *models.PushArtifactRequest) (*models.ArtifactEntry, error) {
	now := time.Now()
	id := fmt.Sprintf("art_%d", time.Now().UnixNano())

	metadataJSON, _ := json.Marshal(req.Metadata)

	query := `INSERT INTO artifact_entries (id, registry_id, name, version, content_type, size, checksum, storage_path, metadata, is_latest, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
	_, err := r.DB.ExecContext(ctx, query, id, req.RegistryID, req.Name, req.Version, req.ContentType, req.Size, req.Checksum, req.StoragePath, string(metadataJSON), true, now)
	if err != nil {
		return nil, fmt.Errorf("push artifact: %w", err)
	}

	return &models.ArtifactEntry{
		ID:            id,
		RegistryID:    req.RegistryID,
		Name:          req.Name,
		Version:       req.Version,
		ContentType:   req.ContentType,
		Size:          req.Size,
		Checksum:      req.Checksum,
		StoragePath:   req.StoragePath,
		Metadata:      string(metadataJSON),
		IsLatest:      true,
		CreatedAt:     now,
	}, nil
}

// QueryArtifacts returns paginated artifacts.
func (r *ArtifactRegistryRepository) QueryArtifacts(ctx context.Context, tenantID string, registryID, name string, limit, offset int) (models.ArtifactResponse, error) {
	var resp models.ArtifactResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"r.tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if registryID != "" {
		where = append(where, fmt.Sprintf("e.registry_id = $%d", argIdx))
		args = append(args, registryID)
		argIdx++
	}
	if name != "" {
		where = append(where, fmt.Sprintf("e.name = $%d", argIdx))
		args = append(args, name)
		argIdx++
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM artifact_entries e JOIN artifact_registries r ON e.registry_id = r.id %s`, whereClause)
	query := fmt.Sprintf(`
		SELECT e.id, e.registry_id, e.name, e.version, e.content_type, e.size, e.checksum, e.storage_path, e.metadata, e.is_latest, e.created_at
		FROM artifact_entries e
		JOIN artifact_registries r ON e.registry_id = r.id
		%s
		ORDER BY e.created_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.DB.QueryRowContext(ctx, countQuery, countArgs...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count artifacts: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query artifacts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var art models.ArtifactEntry
		var metadataStr sql.NullString
		if err := rows.Scan(&art.ID, &art.RegistryID, &art.Name, &art.Version, &art.ContentType, &art.Size, &art.Checksum, &art.StoragePath, &metadataStr, &art.IsLatest, &art.CreatedAt); err != nil {
			return resp, fmt.Errorf("scan artifact: %w", err)
		}
		if metadataStr.Valid {
			art.Metadata = metadataStr.String
		}
		resp.Data = append(resp.Data, art)
	}
	return resp, nil
}

// DeleteRegistry removes a registry.
func (r *ArtifactRegistryRepository) DeleteRegistry(ctx context.Context, tenantID, id string) error {
	// Delete all artifacts first
	_, _ = r.DB.ExecContext(ctx, `DELETE FROM artifact_entries WHERE registry_id = $1`, id)

	result, err := r.DB.ExecContext(ctx, `DELETE FROM artifact_registries WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete registry: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("registry not found: %s", id)
	}
	return nil
}

// DeleteArtifact removes an artifact.
func (r *ArtifactRegistryRepository) DeleteArtifact(ctx context.Context, tenantID, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM artifact_entries e JOIN artifact_registries r ON e.registry_id = r.id WHERE e.id = $1 AND r.tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete artifact: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("artifact not found: %s", id)
	}
	return nil
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}
