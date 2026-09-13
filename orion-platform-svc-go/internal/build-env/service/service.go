package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/build-env/models"
)

// RepositoryInterface defines the repository methods used by the service.
// Every method takes tenantID; the service never derives it, so a test with a
// recording fake can assert the caller's tenant reaches each statement.
type RepositoryInterface interface {
	AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error)
	AssessCacheHealth(ctx context.Context, tenantID string, cacheID string) (*models.CacheHealth, error)
	CreateBuild(ctx context.Context, m *models.Build) error
	CreateBuildImage(ctx context.Context, m *models.BuildImage) error
	CreateCacheConfig(ctx context.Context, tenantID string, name string, level string, status string, cacheDir string, ttlHours int) (*models.BuildCacheConfig, error)
	DeleteBuild(ctx context.Context, tenantID, id string) error
	DeleteBuildImage(ctx context.Context, tenantID, id string) error
	DeleteCacheConfig(ctx context.Context, tenantID string, id string) error
	GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error)
	GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error)
	GetBuildLog(ctx context.Context, tenantID string, id string) (*models.BuildLog, error)
	GetCacheConfig(ctx context.Context, tenantID string, id string) (*models.BuildCacheConfig, error)
	GetCacheDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error)
	GetCacheMetrics(ctx context.Context, tenantID string, cacheID string) (*models.CacheMetrics, error)
	ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error)
	ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error)
	ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error)
	ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error)
	RecordCacheEvent(ctx context.Context, tenantID, cacheID, eventType string, pipelineID, buildID *string, latencySavedMs *float64) error
	UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateBuildImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateCacheConfig(ctx context.Context, tenantID string, id string, updates map[string]interface{}) (*models.BuildCacheConfig, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Build CRUD ---

func (s *Service) CreateBuild(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error) {
	m := &models.Build{
		TenantID:      tenantID,
		Name:          req.Name,
		Status:        req.Status,
		PipelineID:    req.PipelineID,
		ProductLineID: req.ProductLineID,
	}
	if m.Status == "" {
		m.Status = "queued"
	}
	if err := s.repo.CreateBuild(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return s.repo.GetBuild(ctx, tenantID, id)
}

func (s *Service) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	return s.repo.ListBuilds(ctx, tenantID, limit, offset)
}

// updateBuildFields collects the fields a caller actually set. An empty result
// is sentinel.BadRequest rather than an update that changes nothing: the old
// repository ran SET updated_at = NOW() on an unmodified row and reported
// success, so PUT /build-env/builds/:id with an empty body looked like a write.
func updateBuildFields(req models.UpdateBuildRequest) map[string]interface{} {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.PipelineID != nil {
		updates["pipeline_id"] = *req.PipelineID
	}
	if req.ProductLineID != nil {
		updates["product_line_id"] = *req.ProductLineID
	}
	return updates
}

func (s *Service) UpdateBuild(ctx context.Context, tenantID, id string, req models.UpdateBuildRequest) (*models.Build, error) {
	updates := updateBuildFields(req)
	if len(updates) == 0 {
		return nil, fmt.Errorf("update build: %w", sentinel.BadRequest)
	}
	if err := s.repo.UpdateBuild(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetBuild(ctx, tenantID, id)
}

func (s *Service) DeleteBuild(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBuild(ctx, tenantID, id)
}

// --- Build Image CRUD ---

func (s *Service) CreateBuildImage(ctx context.Context, tenantID string, req models.CreateBuildImageRequest) (*models.BuildImage, error) {
	m := &models.BuildImage{
		TenantID:   tenantID,
		Name:       req.Name,
		ImageTag:   req.ImageTag,
		BaseImage:  req.BaseImage,
		Dockerfile: req.Dockerfile,
	}
	if err := s.repo.CreateBuildImage(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error) {
	return s.repo.GetBuildImage(ctx, tenantID, id)
}

func (s *Service) ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error) {
	return s.repo.ListBuildImages(ctx, tenantID, limit, offset)
}

func updateImageFields(req models.UpdateBuildImageRequest) map[string]interface{} {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.ImageTag != nil {
		updates["image_tag"] = *req.ImageTag
	}
	if req.BaseImage != nil {
		updates["base_image"] = *req.BaseImage
	}
	if req.Dockerfile != nil {
		updates["dockerfile"] = *req.Dockerfile
	}
	return updates
}

func (s *Service) UpdateBuildImage(ctx context.Context, tenantID, id string, req models.UpdateBuildImageRequest) (*models.BuildImage, error) {
	updates := updateImageFields(req)
	if len(updates) == 0 {
		return nil, fmt.Errorf("update build image: %w", sentinel.BadRequest)
	}
	if err := s.repo.UpdateBuildImage(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetBuildImage(ctx, tenantID, id)
}

func (s *Service) DeleteBuildImage(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBuildImage(ctx, tenantID, id)
}

// --- Build Cache Config CRUD ---
//
// The config and log ids in the path are UUIDs, so they pass through as strings.
// They used to be strconv.Atoi'd first, which rejected every real UUID-shaped
// id with "invalid config id" and turned GET / PUT / DELETE
// /build-env/build-cache/:id and GET /build-logs/:id into endpoints that could
// only ever answer 400.

func (s *Service) CreateCacheConfig(ctx context.Context, tenantID string, req models.CreateBuildCacheConfigRequest) (*models.BuildCacheConfig, error) {
	status := req.Status
	if status == "" {
		status = "active"
	}
	return s.repo.CreateCacheConfig(ctx, tenantID, req.Name, req.Level, status, req.CacheDir, req.TTLHours)
}

func (s *Service) GetCacheConfig(ctx context.Context, tenantID string, id string) (*models.BuildCacheConfig, error) {
	return s.repo.GetCacheConfig(ctx, tenantID, id)
}

func (s *Service) ListCacheConfigs(ctx context.Context, tenantID string, level, status string, limit, offset int) ([]models.BuildCacheConfig, error) {
	return s.repo.ListCacheConfigs(ctx, tenantID, level, status, limit, offset)
}

func updateConfigFields(req models.UpdateBuildCacheConfigRequest) map[string]interface{} {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Level != nil {
		updates["level"] = *req.Level
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.CacheDir != nil {
		updates["cache_dir"] = *req.CacheDir
	}
	if req.TTLHours != nil {
		updates["ttl_hours"] = *req.TTLHours
	}
	return updates
}

func (s *Service) UpdateCacheConfig(ctx context.Context, tenantID string, id string, req models.UpdateBuildCacheConfigRequest) (*models.BuildCacheConfig, error) {
	updates := updateConfigFields(req)
	if len(updates) == 0 {
		return nil, fmt.Errorf("update cache config: %w", sentinel.BadRequest)
	}
	return s.repo.UpdateCacheConfig(ctx, tenantID, id, updates)
}

func (s *Service) DeleteCacheConfig(ctx context.Context, tenantID string, id string) error {
	return s.repo.DeleteCacheConfig(ctx, tenantID, id)
}

// --- Build Log ---

func (s *Service) ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	return s.repo.ListBuildLogs(ctx, tenantID, limit, offset)
}

func (s *Service) GetBuildLog(ctx context.Context, tenantID string, id string) (*models.BuildLog, error) {
	return s.repo.GetBuildLog(ctx, tenantID, id)
}

// --- Cache Monitor ---

func (s *Service) GetDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error) {
	return s.repo.GetCacheDashboard(ctx, tenantID)
}

func (s *Service) GetCacheMetrics(ctx context.Context, tenantID string, cacheID string) (*models.CacheMetrics, error) {
	return s.repo.GetCacheMetrics(ctx, tenantID, cacheID)
}

func (s *Service) AssessCacheHealth(ctx context.Context, tenantID string, cacheID string) (*models.CacheHealth, error) {
	return s.repo.AssessCacheHealth(ctx, tenantID, cacheID)
}

// RecordCacheEvent records one cache probe. The event type is validated here as
// well as by the table's CHECK constraint: cache_events only understands hit,
// miss and evict, and every aggregate counts just those three, so an unknown
// type would insert and then be invisible to the metrics — a silent no-op write.
func (s *Service) RecordCacheEvent(ctx context.Context, tenantID string, req models.RecordCacheEventRequest) error {
	if !models.ValidEventType(req.EventType) {
		return fmt.Errorf("invalid event type %q: %w", req.EventType, sentinel.BadRequest)
	}
	return s.repo.RecordCacheEvent(ctx, tenantID, req.CacheID, req.EventType, req.PipelineID, req.BuildID, req.LatencySavedMs)
}

func (s *Service) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error) {
	return s.repo.AnalyzePerformanceImpact(ctx, tenantID, pipelineID)
}

// --- Errors ---

// IsNotFound reports whether err is a not-found from the repository. The
// repository wraps sql.ErrNoRows in sentinel.NotFound, so the handlers' 404
// branches are live rather than dead.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
