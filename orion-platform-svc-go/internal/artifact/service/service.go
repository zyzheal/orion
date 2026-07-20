package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/artifact/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddTags(ctx context.Context, artifactID string, tags []string) error
	Count(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (int, error)
	Create(ctx context.Context, m *models.Artifact) error
	CreatePromotion(ctx context.Context, p *models.ArtifactPromotion) error
	ExistsByNamespaceNameVersion(ctx context.Context, tenantID, namespace, name, version string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error)
	GetCurrentStage(ctx context.Context, tenantID, id string) (string, error)
	GetDownloadHistory(ctx context.Context, artifactID string) ([]models.ArtifactDownload, error)
	GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error)
	GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error)
	GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error)
	GetTags(ctx context.Context, artifactID string) ([]string, error)
	GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error)
	List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) ([]models.Artifact, error)
	RecordDownload(ctx context.Context, artifactID string, req models.DownloadArtifactRequest) error
	RemoveTags(ctx context.Context, artifactID string, tags []string) error
	Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error)
	SoftDelete(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

var (

	ErrAlreadyExists = errors.New("artifact already exists")
	ErrInvalidStatus = errors.New("invalid status")
	ErrNotAvailable  = errors.New("artifact not available")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateArtifactRequest) (*models.Artifact, error) {
	// Check for existing artifact with same namespace/name/version.
	exists, err := s.repo.ExistsByNamespaceNameVersion(ctx, tenantID, req.Namespace, req.Name, req.Version)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("artifact already exists: %s/%s:%s: %w", req.Namespace, req.Name, req.Version, ErrAlreadyExists)
	}

	artifact := &models.Artifact{
		TenantID:       tenantID,
		Name:           req.Name,
		Namespace:      req.Namespace,
		Version:        req.Version,
		Type:           req.Type,
		Status:         models.StatusAvailable,
		SizeBytes:      req.SizeBytes,
		ChecksumSha256: req.ChecksumSha256,
		ChecksumSha512: req.ChecksumSha512,
		Metadata:       req.Metadata,
		StoragePath:    req.StoragePath,
		CreatedBy:      req.CreatedBy,
	}
	if err := s.repo.Create(ctx, artifact); err != nil {
		return nil, err
	}
	return artifact, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (*models.ArtifactListResponse, error) {
	artifacts, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.Count(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.ArtifactListResponse{Artifacts: artifacts, Total: total}, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateArtifactRequest) (*models.Artifact, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	updates := make(map[string]interface{})
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Metadata != nil {
		updates["metadata"] = *req.Metadata
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.SoftDelete(ctx, tenantID, id)
}

// --- Tag operations ---

func (s *Service) AddTags(ctx context.Context, tenantID, id string, tags []string) error {
	return s.repo.AddTags(ctx, id, tags)
}

func (s *Service) RemoveTags(ctx context.Context, tenantID, id string, tags []string) error {
	return s.repo.RemoveTags(ctx, id, tags)
}

func (s *Service) GetTags(ctx context.Context, tenantID, id string) ([]string, error) {
	return s.repo.GetTags(ctx, id)
}

// --- Download ---

func (s *Service) Download(ctx context.Context, tenantID, id string, req models.DownloadArtifactRequest) (*models.Artifact, error) {
	artifact, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if artifact.Status != models.StatusAvailable {
		return nil, fmt.Errorf("artifact not available: %s: %w", artifact.Status, ErrNotAvailable)
	}
	// Record the download.
	if err := s.repo.RecordDownload(ctx, id, req); err != nil {
		return nil, err
	}
	return artifact, nil
}

func (s *Service) GetDownloadHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactDownload, error) {
	return s.repo.GetDownloadHistory(ctx, id)
}

// --- Search ---

func (s *Service) Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error) {
	return s.repo.Search(ctx, tenantID, query, limit, offset)
}

// --- Promote ---

func (s *Service) Promote(ctx context.Context, tenantID, id string, req models.PromoteArtifactRequest) (*models.ArtifactPromotion, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	var promotedBy string
	if req.PromotedBy != "" {
		promotedBy = req.PromotedBy
	}
	promotion := &models.ArtifactPromotion{
		ArtifactID: id,
		FromStage:  "current",
		ToStage:    req.Stage,
		PromotedBy: promotedBy,
		ApprovedBy: req.ApprovedBy,
		Reason:     req.Reason,
	}
	if err := s.repo.CreatePromotion(ctx, promotion); err != nil {
		return nil, err
	}
	return promotion, nil
}

func (s *Service) GetCurrentStage(ctx context.Context, tenantID, id string) (*string, error) {
	stage, err := s.repo.GetCurrentStage(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if stage == "" {
		return nil, sentinel.NotFound
	}
	return &stage, nil
}

func (s *Service) GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error) {
	return s.repo.GetPromotionHistory(ctx, tenantID, id)
}

// --- Deprecate ---

func (s *Service) Deprecate(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	return s.Update(ctx, tenantID, id, models.UpdateArtifactRequest{
		Status: func() *models.ArtifactStatus {
			s := models.StatusDeprecated
			return &s
		}(),
	})
}

// --- Quarantine ---

func (s *Service) Quarantine(ctx context.Context, tenantID, id string, req models.QuarantineArtifactRequest) (*models.Artifact, error) {
	artifact, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	metadata := artifact.Metadata
	if metadata == "" {
		metadata = "{}"
	}
	var md map[string]interface{}
	if err := json.Unmarshal([]byte(metadata), &md); err != nil {
		md = make(map[string]interface{})
	}
	md["quarantineReason"] = req.Reason
	newMetadata, _ := json.Marshal(md)
	return s.Update(ctx, tenantID, id, models.UpdateArtifactRequest{
		Status:   func() *models.ArtifactStatus { s := models.StatusQuarantined; return &s }(),
		Metadata: func() *string { s := string(newMetadata); return &s }(),
	})
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

func (s *Service) GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error) {
	return s.repo.GetTypeStats(ctx, tenantID)
}

func (s *Service) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	return s.repo.GetNamespaces(ctx, tenantID)
}

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

// ErrNotFoundArtifact returns a not-found error for a given artifact ID.
func ErrNotFoundArtifact(id string) error {
	return fmt.Errorf("artifact %q not found: %w", id, sentinel.NotFound)
}
