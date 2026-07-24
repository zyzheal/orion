package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"orion/platform-svc-go/internal/oci-registry/models"
)

var ErrRegistryNotEnabled = errors.New("registry is not enabled")

// ToggleRegistry enables or disables a registry by updating its enabled field.
func (s *Service) ToggleRegistry(ctx context.Context, tenantID, registryID string, req *models.ToggleRegistryRequest) (*models.OciRegistry, error) {
	registry, err := s.repo.GetByID(ctx, tenantID, registryID)
	if err != nil {
		return nil, err
	}
	registry.Enabled = req.Enabled
	registry.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, tenantID, registry.ID, map[string]interface{}{
		"enabled":    registry.Enabled,
		"updated_at": registry.UpdatedAt,
	})
}

// ListTags lists image tags for a given repository in a registry.
// NOTE: This is currently a simulated implementation. In production this should
// call the OCI registry's v2 manifest/catalog API to enumerate tags.
func (s *Service) ListTags(ctx context.Context, tenantID, registryID, repoName string, q *models.TagsQuery) (*models.TagsResponse, error) {
	// Verify registry exists and is enabled
	registry, err := s.repo.GetByID(ctx, tenantID, registryID)
	if err != nil {
		return nil, err
	}
	if !registry.Enabled {
		return nil, ErrRegistryNotEnabled
	}

	// Validate pagination
	page := q.Page
	if page <= 0 {
		page = 1
	}
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}

	// Simulated tag data (replace with actual OCI registry v2 API calls in production)
	simulatedTags := []models.Tag{
		{Name: "latest", Digest: "sha256:" + repoName + "-latest", Size: 102400000, CreatedAt: time.Now().UTC().Unix()},
		{Name: "v1.0.0", Digest: "sha256:" + repoName + "-v1", Size: 102400000, CreatedAt: time.Now().Add(-24 * time.Hour).UTC().Unix()},
		{Name: "v0.9.0", Digest: "sha256:" + repoName + "-v09", Size: 98000000, CreatedAt: time.Now().Add(-72 * time.Hour).UTC().Unix()},
	}

	// Apply pagination
	total := len(simulatedTags)
	start := (page - 1) * limit
	if start >= total {
		return &models.TagsResponse{Total: total, Tags: []models.Tag{}}, nil
	}
	end := start + limit
	if end > total {
		end = total
	}

	return &models.TagsResponse{
		Total: total,
		Tags:  simulatedTags[start:end],
	}, nil
}

// DeleteImage deletes an image by digest from a registry.
// NOTE: This is currently a simulated implementation. In production this should
// call the OCI registry's v2 manifest deletion API.
func (s *Service) DeleteImage(ctx context.Context, tenantID, registryID, name, digest string) error {
	// Verify registry exists and is enabled
	registry, err := s.repo.GetByID(ctx, tenantID, registryID)
	if err != nil {
		return err
	}
	if !registry.Enabled {
		return ErrRegistryNotEnabled
	}

	// Validate digest format
	if len(digest) == 0 {
		return errors.New("digest is required")
	}
	// Basic digest format validation (OCI digest must start with "sha256:" or "sha512:")
	if !strings.HasPrefix(digest, "sha256:") && !strings.HasPrefix(digest, "sha512:") {
		return errors.New("invalid digest format: expected sha256:<hash> or sha512:<hash>")
	}

	// Simulated deletion — in production call DELETE /v2/<name>/manifests/<digest>
	_ = registry // registry validated above

	return nil
}
