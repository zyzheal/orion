package service

import (
	"context"
	"errors"
	"fmt"

	"orion/artifact-svc-go/internal/artifact/models"
	"orion/artifact-svc-go/internal/artifact/repository"

	orionotel "orion/go-common/pkg/otel"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var (
	ErrArtifactNotFound    = errors.New("artifact not found")
	ErrAlreadyExists       = errors.New("artifact already exists")
	ErrInvalidInput        = errors.New("invalid input")
	ErrNotAvailable        = errors.New("artifact not available")
	ErrUnknownStage        = errors.New("unknown promotion stage")
	ErrFinalStage          = errors.New("artifact is already at the final promotion stage")
	ErrPromotionNotAllowed = errors.New("promotion to the requested stage is not allowed")
)

var tracer = orionotel.Tracer("orion-artifact-svc")

// Service implements all business logic for the artifact domain.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service instance.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ============================================================
// Artifact CRUD
// ============================================================

// Create validates input, checks for duplicates, and creates an artifact.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateArtifactRequest) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Create")
	defer span.End()

	span.SetAttributes(
		attribute.String("tenant_id", tenantID),
		attribute.String("artifact.name", req.Name),
		attribute.String("artifact.version", req.Version),
	)

	if tenantID == "" || req.Name == "" || req.Version == "" {
		span.SetStatus(codes.Error, "missing required fields")
		return nil, fmt.Errorf("%w: tenant_id, name, and version are required", ErrInvalidInput)
	}

	// Check for duplicate (namespace + name + version)
	ns := req.Namespace
	if ns == "" {
		ns = "default"
	}
	existing, _ := s.repo.GetByNamespaceNameVersion(ctx, tenantID, ns, req.Name, req.Version)
	if existing != nil {
		span.SetStatus(codes.Error, "duplicate artifact")
		return nil, fmt.Errorf("%w: %s/%s:%s", ErrAlreadyExists, ns, req.Name, req.Version)
	}

	artifact := &models.Artifact{
		TenantID:       tenantID,
		Namespace:      ns,
		Name:           req.Name,
		Version:        req.Version,
		Type:           req.Type,
		Description:    req.Description,
		SizeBytes:      req.SizeBytes,
		ChecksumSHA256: req.ChecksumSHA256,
		ChecksumSHA512: req.ChecksumSHA512,
		StoragePath:    req.StoragePath,
		RepoURL:        req.RepoURL,
		Metadata:       models.JSONB(req.Metadata),
		CreatedBy:      req.CreatedBy,
	}

	if err := s.repo.Create(ctx, artifact); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	span.SetAttributes(attribute.String("artifact.id", artifact.ID))
	return artifact, nil
}

// GetByID retrieves a single artifact, returns ErrArtifactNotFound if missing.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetByID")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", id))

	artifact, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, ErrArtifactNotFound
	}

	// Attach tags
	tags, _ := s.repo.GetTags(ctx, artifact.ID)
	if tags != nil {
		tagNames := make([]string, len(tags))
		for i, t := range tags {
			tagNames[i] = t.Tag
		}
		artifact.Tags = tagNames
	}

	return artifact, nil
}

// List retrieves a paginated, filtered list of artifacts.
func (s *Service) List(ctx context.Context, tenantID string, opts *models.ListQueryOptions) ([]models.Artifact, int, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.List")
	defer span.End()
	span.SetAttributes(attribute.String("tenant_id", tenantID))

	return s.repo.List(ctx, tenantID, opts)
}

// Search performs full-text search across artifact name and description.
func (s *Service) Search(ctx context.Context, tenantID, query string) ([]models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Search")
	defer span.End()
	span.SetAttributes(attribute.String("search.query", query))

	return s.repo.Search(ctx, tenantID, query)
}

// Update modifies mutable fields (status, description, metadata) of an artifact.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateArtifactRequest) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Update")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", id))

	artifact, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.SetStatus(codes.Error, "not found")
		return nil, ErrArtifactNotFound
	}

	if req.Status != nil {
		artifact.Status = *req.Status
	}
	if req.Description != nil {
		artifact.Description = *req.Description
	}
	if req.Metadata != nil {
		if artifact.Metadata == nil {
			artifact.Metadata = models.JSONB{}
		}
		for k, v := range req.Metadata {
			artifact.Metadata[k] = v
		}
	}

	if err := s.repo.Update(ctx, artifact); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	return artifact, nil
}

// Delete soft-deletes an artifact.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := tracer.Start(ctx, "ArtifactService.Delete")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", id))

	// Verify existence first
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.SetStatus(codes.Error, "not found")
		return ErrArtifactNotFound
	}

	return s.repo.SoftDelete(ctx, tenantID, id)
}

// Count returns the total number of non-deleted artifacts for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Count")
	defer span.End()

	return s.repo.Count(ctx, tenantID)
}

// ============================================================
// Tags
// ============================================================

// AddTags adds one or more tags to an artifact.
func (s *Service) AddTags(ctx context.Context, tenantID, artifactID string, tags []string) error {
	ctx, span := tracer.Start(ctx, "ArtifactService.AddTags")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", artifactID))

	// Verify artifact exists
	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return ErrArtifactNotFound
	}

	for _, tag := range tags {
		if err := s.repo.AddTag(ctx, artifactID, tag); err != nil {
			span.RecordError(err)
			return err
		}
	}
	return nil
}

// RemoveTags removes one or more tags from an artifact.
func (s *Service) RemoveTags(ctx context.Context, tenantID, artifactID string, tags []string) error {
	ctx, span := tracer.Start(ctx, "ArtifactService.RemoveTags")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", artifactID))

	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return ErrArtifactNotFound
	}

	for _, tag := range tags {
		if err := s.repo.RemoveTag(ctx, artifactID, tag); err != nil {
			span.RecordError(err)
			return err
		}
	}
	return nil
}

// GetTags retrieves all tags for an artifact.
func (s *Service) GetTags(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactTag, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetTags")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return nil, ErrArtifactNotFound
	}

	return s.repo.GetTags(ctx, artifactID)
}

// ============================================================
// Download
// ============================================================

// Download validates artifact availability and records a download event.
func (s *Service) Download(ctx context.Context, tenantID, artifactID string, req *models.DownloadRequest) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Download")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", artifactID))

	artifact, err := s.repo.GetByID(ctx, tenantID, artifactID)
	if err != nil {
		span.SetStatus(codes.Error, "not found")
		return nil, ErrArtifactNotFound
	}

	if artifact.Status != string(models.ArtifactStatusAvailable) {
		span.SetStatus(codes.Error, "not available")
		return nil, fmt.Errorf("%w: status is %s", ErrNotAvailable, artifact.Status)
	}

	// Record the download event
	if err := s.repo.RecordDownload(ctx, &models.DownloadRecord{
		ArtifactID:   artifactID,
		DownloadedBy: req.DownloadedBy,
		IPAddress:    req.IPAddress,
		UserAgent:    req.UserAgent,
	}); err != nil {
		span.RecordError(err)
		// Non-fatal: log but still return the artifact
	}

	return artifact, nil
}

// GetDownloadHistory retrieves the download history for an artifact.
func (s *Service) GetDownloadHistory(ctx context.Context, tenantID, artifactID string) ([]models.DownloadRecord, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetDownloadHistory")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return nil, ErrArtifactNotFound
	}

	return s.repo.GetDownloadHistory(ctx, artifactID)
}

// ============================================================
// Promotion (5-stage state machine)
// ============================================================

// Promote advances an artifact to the next promotion stage.
func (s *Service) Promote(ctx context.Context, tenantID, artifactID, promotedBy, reason string) (*models.PromotionRecord, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Promote")
	defer span.End()
	span.SetAttributes(attribute.String("artifact.id", artifactID))

	// Verify artifact exists
	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return nil, ErrArtifactNotFound
	}

	currentStage := s.getCurrentStage(ctx, artifactID)
	currentIndex := stageIndex(currentStage)
	if currentIndex == -1 {
		return nil, ErrUnknownStage
	}
	if currentIndex >= len(models.PromotionOrder)-1 {
		return nil, ErrFinalStage
	}

	nextStage := models.PromotionOrder[currentIndex+1]

	rec := &models.PromotionRecord{
		ArtifactID: artifactID,
		FromStage:  string(currentStage),
		ToStage:    string(nextStage),
		PromotedBy: promotedBy,
	}
	if reason != "" {
		rec.Reason = &reason
	}

	if err := s.repo.CreatePromotion(ctx, rec); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	span.SetAttributes(
		attribute.String("promotion.from", string(currentStage)),
		attribute.String("promotion.to", string(nextStage)),
	)
	return rec, nil
}

// PromoteWithApproval promotes and immediately records an approval.
func (s *Service) PromoteWithApproval(ctx context.Context, tenantID, artifactID, promotedBy, approvedBy, reason string) (*models.PromotionRecord, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.PromoteWithApproval")
	defer span.End()

	rec, err := s.Promote(ctx, tenantID, artifactID, promotedBy, reason)
	if err != nil {
		return nil, err
	}

	if err := s.repo.ApprovePromotion(ctx, rec.ID, approvedBy); err != nil {
		span.RecordError(err)
		// Non-fatal: promotion succeeded, approval update failed
	}

	rec.ApprovedBy = &approvedBy
	return rec, nil
}

// GetCurrentStage returns the current promotion stage for an artifact.
func (s *Service) GetCurrentStage(ctx context.Context, tenantID, artifactID string) (models.PromotionStage, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetCurrentStage")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return "", ErrArtifactNotFound
	}

	return s.getCurrentStage(ctx, artifactID), nil
}

// GetPromotionHistory returns the full promotion history for an artifact.
func (s *Service) GetPromotionHistory(ctx context.Context, tenantID, artifactID string) ([]models.PromotionRecord, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetPromotionHistory")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return nil, ErrArtifactNotFound
	}

	return s.repo.GetPromotionHistory(ctx, artifactID)
}

// CanPromote checks whether promoting to a target stage is allowed (step-by-step only).
func (s *Service) CanPromote(ctx context.Context, tenantID, artifactID string, toStage models.PromotionStage) (bool, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.CanPromote")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, tenantID, artifactID); err != nil {
		return false, ErrArtifactNotFound
	}

	currentStage := s.getCurrentStage(ctx, artifactID)
	currentIdx := stageIndex(currentStage)
	toIdx := stageIndex(toStage)

	return toIdx == currentIdx+1, nil
}

// ============================================================
// Lifecycle (deprecate, quarantine)
// ============================================================

// Deprecate marks an artifact as deprecated.
func (s *Service) Deprecate(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Deprecate")
	defer span.End()

	status := string(models.ArtifactStatusDeprecated)
	return s.Update(ctx, tenantID, id, &models.UpdateArtifactRequest{Status: &status})
}

// Quarantine marks an artifact as quarantined with a reason stored in metadata.
func (s *Service) Quarantine(ctx context.Context, tenantID, id, reason string) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.Quarantine")
	defer span.End()

	status := string(models.ArtifactStatusQuarantined)
	return s.Update(ctx, tenantID, id, &models.UpdateArtifactRequest{
		Status:   &status,
		Metadata: map[string]interface{}{"quarantine_reason": reason},
	})
}

// ============================================================
// Statistics
// ============================================================

// GetStats returns aggregate stats for a tenant's artifacts.
func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetStats")
	defer span.End()

	return s.repo.GetStats(ctx, tenantID)
}

// GetTypeStats returns artifact counts grouped by type.
func (s *Service) GetTypeStats(ctx context.Context, tenantID string) ([]models.TypeStat, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetTypeStats")
	defer span.End()

	return s.repo.GetTypeStats(ctx, tenantID)
}

// GetNamespaces returns distinct namespaces with artifact counts.
func (s *Service) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	ctx, span := tracer.Start(ctx, "ArtifactService.GetNamespaces")
	defer span.End()

	return s.repo.GetNamespaces(ctx, tenantID)
}

// ============================================================
// Internal helpers
// ============================================================

// getCurrentStage returns the current promotion stage, defaulting to DEVELOPMENT.
func (s *Service) getCurrentStage(ctx context.Context, artifactID string) models.PromotionStage {
	latest, err := s.repo.GetLatestPromotion(ctx, artifactID)
	if err != nil || latest == nil {
		return models.PromotionStageDevelopment
	}
	return models.PromotionStage(latest.ToStage)
}

// stageIndex returns the index of a stage in PromotionOrder, or -1 if not found.
func stageIndex(stage models.PromotionStage) int {
	for i, s := range models.PromotionOrder {
		if s == stage {
			return i
		}
	}
	return -1
}
