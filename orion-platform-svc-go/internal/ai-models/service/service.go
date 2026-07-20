package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/ai-models/models"

	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountVersions(ctx context.Context, tenantID, modelID string) (int, error)
	CreateCanary(ctx context.Context, c *models.CanaryConfig) error
	CreateModel(ctx context.Context, m *models.AIModel) error
	CreateVersion(ctx context.Context, v *models.ModelVersion) error
	DeleteModel(ctx context.Context, tenantID, modelID string) error
	GetCanary(ctx context.Context, tenantID, modelID string) (*models.CanaryConfig, error)
	GetModel(ctx context.Context, tenantID, modelID string) (*models.AIModel, error)
	GetVersion(ctx context.Context, tenantID, modelID, versionID string) (*models.ModelVersion, error)
	GetVersionsByModel(ctx context.Context, tenantID, modelID string) ([]models.ModelVersion, error)
	ListModels(ctx context.Context, tenantID string, q models.ListModelsQuery) ([]models.AIModel, int, error)
	ListVersions(ctx context.Context, tenantID, modelID string, q models.ListVersionsQuery) ([]models.ModelVersion, int, error)
	ModelExists(ctx context.Context, tenantID, name string) (bool, error)
	UpdateCanary(ctx context.Context, tenantID, modelID string, enabled bool, status models.CanaryStatus) error
	UpdateModel(ctx context.Context, tenantID, modelID string, displayName *string, description *string, tagsJSON, metadataJSON string) (*models.AIModel, error)
	UpdateModelCurrentVersion(ctx context.Context, tenantID, modelID, version string, status models.ModelStatus) error
	UpdateVersion(ctx context.Context, tenantID, versionID string, environment models.Environment, status models.ModelStatus, promotedAt *int64, promotedBy *string) error
	UpdateVersionDeprecated(ctx context.Context, tenantID, versionID string, deprecatedAt *int64) error
}

var (
	ErrModelNotFound       = errors.New("model not found")
	ErrVersionNotFound     = errors.New("version not found")
	ErrNoVersionToRollback = errors.New("no previous version available for rollback")
	ErrNoProductionVersion = errors.New("no previous production version found")
	ErrModelAlreadyExists  = errors.New("model name already exists")
	ErrCanaryNotFound      = errors.New("canary configuration not found")
)

// Service handles business logic for AI model management.
type Service struct {
	repo RepositoryInterface
	log  *zap.Logger
}

// NewService creates a new Service.
func NewService(repo RepositoryInterface, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// RegisterModel registers a new AI model.
func (s *Service) RegisterModel(ctx context.Context, tenantID, userID string, req models.RegisterModelRequest) (*models.AIModel, error) {
	// Check for duplicate name
	exists, err := s.repo.ModelExists(ctx, tenantID, req.Name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrModelAlreadyExists
	}

	// Marshal tags to JSON
	tagsJSON, err := toJSON(req.Tags)
	if err != nil {
		return nil, err
	}
	metadataJSON, err := toJSON(req.Metadata)
	if err != nil {
		return nil, err
	}

	m := &models.AIModel{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Type:        req.Type,
		Status:      models.ModelStatusDraft,
		Framework:   req.Framework,
		Tags:        tagsJSON,
		Metadata:    metadataJSON,
		CreatedBy:   userID,
		TenantID:    tenantID,
	}

	if err := s.repo.CreateModel(ctx, m); err != nil {
		return nil, err
	}
	s.log.Info("model registered", zap.String("model_id", m.ID), zap.String("name", m.Name))
	return m, nil
}

// ListModels lists models with filters and pagination.
func (s *Service) ListModels(ctx context.Context, tenantID string, q models.ListModelsQuery) (*models.ModelListResponse, error) {
	modelsList, total, err := s.repo.ListModels(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.ModelListResponse{Data: modelsList, Total: total}, nil
}

// GetModel retrieves a model by ID.
func (s *Service) GetModel(ctx context.Context, tenantID, modelID string) (*models.AIModel, error) {
	m, err := s.repo.GetModel(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrModelNotFound
	}
	return m, nil
}

// UpdateModel updates model metadata.
func (s *Service) UpdateModel(ctx context.Context, tenantID, modelID string, req models.UpdateModelRequest) (*models.AIModel, error) {
	// Verify model exists
	_, err := s.repo.GetModel(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrModelNotFound
	}

	tagsJSON := "[]"
	if req.Tags != nil {
		tagsJSON, err = toJSON(req.Tags)
		if err != nil {
			return nil, err
		}
	}
	metadataJSON := "{}"
	if req.Metadata != nil {
		metadataJSON, err = toJSON(req.Metadata)
		if err != nil {
			return nil, err
		}
	}

	m, err := s.repo.UpdateModel(ctx, tenantID, modelID, req.DisplayName, req.Description, tagsJSON, metadataJSON)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// DeleteModel deletes a model and all associated versions and canary configs.
func (s *Service) DeleteModel(ctx context.Context, tenantID, modelID string) error {
	// Verify model exists
	_, err := s.repo.GetModel(ctx, tenantID, modelID)
	if err != nil {
		return ErrModelNotFound
	}
	if err := s.repo.DeleteModel(ctx, tenantID, modelID); err != nil {
		return err
	}
	s.log.Info("model deleted", zap.String("model_id", modelID))
	return nil
}

// ListVersions lists versions for a model.
func (s *Service) ListVersions(ctx context.Context, tenantID, modelID string, q models.ListVersionsQuery) (*models.VersionListResponse, error) {
	versions, total, err := s.repo.ListVersions(ctx, tenantID, modelID, q)
	if err != nil {
		return nil, ErrModelNotFound
	}
	return &models.VersionListResponse{Data: versions, Total: total}, nil
}

// PublishVersion publishes a new version of a model.
func (s *Service) PublishVersion(ctx context.Context, tenantID, modelID, userID string, req models.PublishVersionRequest) (*models.ModelVersion, error) {
	// Verify model exists
	_, err := s.repo.GetModel(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrModelNotFound
	}

	// Generate version number
	count, err := s.repo.CountVersions(ctx, tenantID, modelID)
	if err != nil {
		return nil, err
	}
	versionNum := "v" + strconv.Itoa(count/10+1) + "." + strconv.Itoa(count%10+1) + ".0"

	env := models.EnvDevelopment
	if req.Environment != nil {
		env = *req.Environment
	}

	metricsJSON := "{}"
	if req.Metrics != nil {
		metricsJSON, err = toJSON(req.Metrics)
		if err != nil {
			return nil, err
		}
	}
	configJSON := "{}"
	if req.Config != nil {
		configJSON, err = toJSON(req.Config)
		if err != nil {
			return nil, err
		}
	}

	v := &models.ModelVersion{
		ModelID:     modelID,
		Version:     versionNum,
		ArtifactUri: req.ArtifactUri,
		Environment: env,
		Status:      models.ModelStatusStaging,
		Metrics:     metricsJSON,
		Config:      configJSON,
		CreatedBy:   userID,
		TenantID:    tenantID,
	}

	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, err
	}

	// Update model current version and status
	if err := s.repo.UpdateModelCurrentVersion(ctx, tenantID, modelID, versionNum, models.ModelStatusStaging); err != nil {
		return nil, err
	}

	s.log.Info("version published", zap.String("model_id", modelID), zap.String("version", versionNum))
	return v, nil
}

// GetVersion retrieves a version by ID.
func (s *Service) GetVersion(ctx context.Context, tenantID, modelID, versionID string) (*models.ModelVersion, error) {
	v, err := s.repo.GetVersion(ctx, tenantID, modelID, versionID)
	if err != nil {
		return nil, ErrVersionNotFound
	}
	return v, nil
}

// PromoteVersion promotes a version to the target environment.
func (s *Service) PromoteVersion(ctx context.Context, tenantID, modelID, versionID, userID string, req models.PromoteVersionRequest) (*models.ModelVersion, error) {
	// Verify version exists
	_, err := s.repo.GetVersion(ctx, tenantID, modelID, versionID)
	if err != nil {
		return nil, ErrVersionNotFound
	}

	status := models.ModelStatusStaging
	if req.TargetEnvironment == models.EnvProduction {
		status = models.ModelStatusProduction
	}

	promotedAt := unixNow()
	promotedBy := userID
	err = s.repo.UpdateVersion(ctx, tenantID, versionID, req.TargetEnvironment, status, &promotedAt, &promotedBy)
	if err != nil {
		return nil, err
	}

	updated, err := s.repo.GetVersion(ctx, tenantID, modelID, versionID)
	if err != nil {
		return nil, err
	}
	s.log.Info("version promoted", zap.String("version_id", versionID), zap.String("target", string(req.TargetEnvironment)))
	return updated, nil
}

// RollbackVersion rolls back to the previous production version.
func (s *Service) RollbackVersion(ctx context.Context, tenantID, modelID string) (*models.ModelVersion, error) {
	versions, err := s.repo.GetVersionsByModel(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrModelNotFound
	}
	if len(versions) < 2 {
		return nil, ErrNoVersionToRollback
	}

	// Find the previous production version (second production version in the list)
	var prevVersion *models.ModelVersion
	var currentProd *models.ModelVersion
	for i, v := range versions {
		if v.Environment == models.EnvProduction && v.Status == models.ModelStatusProduction {
			if prevVersion == nil {
				currentProd = &versions[i]
			} else {
				prevVersion = &versions[i]
				break
			}
		}
	}

	if prevVersion == nil {
		return nil, ErrNoProductionVersion
	}

	// Mark current production version as deprecated
	if currentProd != nil && currentProd.ID != prevVersion.ID {
		now := unixNow()
		if err := s.repo.UpdateVersionDeprecated(ctx, tenantID, currentProd.ID, &now); err != nil {
			return nil, err
		}
	}

	s.log.Info("version rolled back", zap.String("model_id", modelID), zap.String("version", prevVersion.Version))
	return prevVersion, nil
}

// GetModelMetrics returns current metrics and history for a model.
func (s *Service) GetModelMetrics(ctx context.Context, tenantID, modelID string) (*models.ModelMetricsResponse, error) {
	versions, err := s.repo.GetVersionsByModel(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrModelNotFound
	}

	resp := &models.ModelMetricsResponse{
		Current: models.ModelMetrics{},
		History: []models.ModelMetrics{},
	}

	if len(versions) > 0 {
		resp.Current = *versions[0].MetricsMap()
		for i := 0; i < len(versions) && i < 10; i++ {
			resp.History = append(resp.History, *versions[i].MetricsMap())
		}
	}
	return resp, nil
}

// ConfigureCanary sets up a canary release for a model.
func (s *Service) ConfigureCanary(ctx context.Context, tenantID, modelID string, req models.CanaryConfigRequest) (*models.CanaryConfig, error) {
	// Verify model exists
	_, err := s.repo.GetModel(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrModelNotFound
	}

	successThreshold := 0.99
	if req.SuccessThreshold != nil {
		successThreshold = *req.SuccessThreshold
	}
	latencyThreshold := 500.0
	if req.LatencyThreshold != nil {
		latencyThreshold = *req.LatencyThreshold
	}
	errorRateThreshold := 0.01
	if req.ErrorRateThreshold != nil {
		errorRateThreshold = *req.ErrorRateThreshold
	}

	c := &models.CanaryConfig{
		ModelID:            modelID,
		Enabled:            true,
		TargetVersion:      req.TargetVersion,
		TrafficPercent:     req.TrafficPercent,
		SuccessThreshold:   successThreshold,
		LatencyThreshold:   latencyThreshold,
		ErrorRateThreshold: errorRateThreshold,
		StartTime:          unixNow(),
		Duration:           req.Duration,
		Status:             models.CanaryStatusPending,
		TenantID:           tenantID,
	}

	if err := s.repo.CreateCanary(ctx, c); err != nil {
		return nil, err
	}
	s.log.Info("canary configured", zap.String("model_id", modelID), zap.String("target_version", c.TargetVersion))
	return c, nil
}

// GetCanaryConfig retrieves the canary config for a model.
func (s *Service) GetCanaryConfig(ctx context.Context, tenantID, modelID string) (*models.CanaryConfig, error) {
	c, err := s.repo.GetCanary(ctx, tenantID, modelID)
	if err != nil {
		return nil, ErrCanaryNotFound
	}
	return c, nil
}

// StopCanary stops the canary release for a model.
func (s *Service) StopCanary(ctx context.Context, tenantID, modelID string) error {
	// Verify canary exists
	_, err := s.repo.GetCanary(ctx, tenantID, modelID)
	if err != nil {
		return ErrCanaryNotFound
	}
	if err := s.repo.UpdateCanary(ctx, tenantID, modelID, false, models.CanaryStatusAborted); err != nil {
		return err
	}
	s.log.Info("canary stopped", zap.String("model_id", modelID))
	return nil
}

// --- helpers ---

func unixNow() int64 {
	return time.Now().UTC().Unix()
}

func toJSON(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
