package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/build-env/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error)
	AssessCacheHealth(ctx context.Context, tenantID string, cacheID string) (*models.CacheHealth, error)
	CreateBuild(ctx context.Context, m *models.Build) error
	CreateBuildImage(ctx context.Context, m *models.BuildImage) error
	CreateCacheConfig(ctx context.Context, tenantID string, name string, level string, status string, cacheDir string, ttlHours int) (*models.BuildCacheConfig, error)
	DeleteBuild(ctx context.Context, tenantID, id string) error
	DeleteBuildImage(ctx context.Context, tenantID, id string) error
	DeleteCacheConfig(ctx context.Context, tenantID string, id int) error
	GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error)
	GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error)
	GetBuildLog(ctx context.Context, tenantID string, id int) (*models.BuildLog, error)
	GetCacheConfig(ctx context.Context, tenantID string, id int) (*models.BuildCacheConfig, error)
	GetCacheDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error)
	GetCacheMetrics(ctx context.Context, tenantID string, cacheID string) (*models.CacheMetrics, error)
	ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error)
	ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error)
	ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error)
	ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error)
	RecordCacheEvent(ctx context.Context, tenantID, cacheID, eventType string, latencySavedMs *float64) error
	UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateBuildImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateCacheConfig(ctx context.Context, tenantID string, id int, updates map[string]interface{}) (*models.BuildCacheConfig, error)
}

type Service struct {
	repo RepositoryInterface
	db   *sql.DB
}

func NewService(repo RepositoryInterface, db *sql.DB) *Service {
	return &Service{repo: repo, db: db}
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

func (s *Service) UpdateBuild(ctx context.Context, tenantID, id string, req models.UpdateBuildRequest) (*models.Build, error) {
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

func (s *Service) UpdateBuildImage(ctx context.Context, tenantID, id string, req models.UpdateBuildImageRequest) (*models.BuildImage, error) {
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
	if err := s.repo.UpdateBuildImage(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetBuildImage(ctx, tenantID, id)
}

func (s *Service) DeleteBuildImage(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBuildImage(ctx, tenantID, id)
}

// --- Build Cache Config CRUD ---

func (s *Service) CreateCacheConfig(ctx context.Context, tenantID string, req models.CreateBuildCacheConfigRequest) (*models.BuildCacheConfig, error) {
	status := req.Status
	if status == "" {
		status = "active"
	}
	return s.repo.CreateCacheConfig(ctx, tenantID, req.Name, req.Level, status, req.CacheDir, req.TTLHours)
}

func (s *Service) GetCacheConfig(ctx context.Context, tenantID string, id string) (*models.BuildCacheConfig, error) {
	parsed, err := strconv.Atoi(id)
	if err != nil {
		return nil, ErrInvalidConfigID
	}
	return s.repo.GetCacheConfig(ctx, tenantID, parsed)
}

func (s *Service) ListCacheConfigs(ctx context.Context, tenantID string, level, status string, limit, offset int) ([]models.BuildCacheConfig, error) {
	return s.repo.ListCacheConfigs(ctx, tenantID, level, status, limit, offset)
}

func (s *Service) UpdateCacheConfig(ctx context.Context, tenantID string, id string, req models.UpdateBuildCacheConfigRequest) (*models.BuildCacheConfig, error) {
	parsed, err := strconv.Atoi(id)
	if err != nil {
		return nil, ErrInvalidConfigID
	}
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
	return s.repo.UpdateCacheConfig(ctx, tenantID, parsed, updates)
}

func (s *Service) DeleteCacheConfig(ctx context.Context, tenantID string, id string) error {
	parsed, err := strconv.Atoi(id)
	if err != nil {
		return ErrInvalidConfigID
	}
	return s.repo.DeleteCacheConfig(ctx, tenantID, parsed)
}

// --- Build Log ---

func (s *Service) ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	return s.repo.ListBuildLogs(ctx, tenantID, limit, offset)
}

func (s *Service) GetBuildLog(ctx context.Context, tenantID string, id string) (*models.BuildLog, error) {
	parsed, err := strconv.Atoi(id)
	if err != nil {
		return nil, ErrInvalidLogID
	}
	return s.repo.GetBuildLog(ctx, tenantID, parsed)
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

func (s *Service) RecordCacheEvent(ctx context.Context, tenantID string, req models.RecordCacheEventRequest) error {
	return s.repo.RecordCacheEvent(ctx, tenantID, req.CacheID, req.EventType, req.LatencySavedMs)
}

func (s *Service) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error) {
	return s.repo.AnalyzePerformanceImpact(ctx, tenantID, pipelineID)
}

// --- Errors ---

var (

	ErrInvalidConfigID    = errors.New("invalid config id")
	ErrInvalidLogID       = errors.New("invalid log id")
	ErrConflict           = errors.New("conflict")
	ErrServiceUnavailable = errors.New("service unavailable")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func IsInvalidID(err error) bool {
	return errors.Is(err, ErrInvalidConfigID) || errors.Is(err, ErrInvalidLogID)
}

func parseID(id string) (int, error) {
	val, err := strconv.Atoi(id)
	if err != nil {
		return 0, ErrInvalidConfigID
	}
	return val, nil
}

// Ensure time and strings are used to avoid unused import warnings.
var _ = time.Now()
var _ = strings.Join([]string{}, "")

// Sentinel for DB errors.
func WrapDBError(err error) error {
	if err != nil && strings.Contains(err.Error(), "no such table") {
		return fmt.Errorf("table not yet created: %w", err)
	}
	return err
}
