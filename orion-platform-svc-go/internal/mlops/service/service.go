package service

import (
	"context"

	"orion/platform-svc-go/internal/mlops/models"
)

// RepositoryInterface is the domain repository contract for MLOps.
type RepositoryInterface interface {
	ListModels(ctx context.Context, tenantID string) ([]models.Model, error)
	GetModel(ctx context.Context, tenantID, id string) (*models.Model, error)
	CreateModel(ctx context.Context, tenantID string, req models.CreateModelRequest) (*models.Model, error)
	UpdateModel(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Model, error)
	DeleteModel(ctx context.Context, tenantID, id string) error
	DeregisterModel(ctx context.Context, tenantID, id string) error

	CreateTrainingJob(ctx context.Context, tenantID, modelID string, req models.TrainingJobRequest) (*models.TrainingJob, error)
	UpdateTrainingJobStatus(ctx context.Context, id string, status string) error
	ListTrainingJobsByModel(ctx context.Context, modelID string) ([]models.TrainingJob, error)

	CreateExperiment(ctx context.Context, tenantID, modelID string, req models.CreateExperimentRequest) (*models.Experiment, error)
	ListExperimentsByModel(ctx context.Context, modelID string) ([]models.Experiment, error)

	CreateArtifact(ctx context.Context, tenantID, modelID string, req models.CreateArtifactRequest) (*models.Artifact, error)
	ListArtifactsByModel(ctx context.Context, modelID string) ([]models.Artifact, error)

	CreateDeployment(ctx context.Context, tenantID, modelID string, req models.CreateDeploymentRequest) (*models.Deployment, error)
	UpdateDeploymentStatus(ctx context.Context, id string, status string, endpointURL string) error
	RollbackDeployment(ctx context.Context, tenantID, modelID string, req models.RollbackRequest) (*models.Deployment, error)
	GetLatestDeployment(ctx context.Context, tenantID, modelID string) (*models.Deployment, error)

	ListPipelines(ctx context.Context, tenantID string) ([]models.Pipeline, error)

	RecordMetric(ctx context.Context, tenantID, modelID string, req models.RecordMetricRequest) error
	GetModelMetrics(ctx context.Context, modelID string, limit int) ([]models.Metric, error)

	GetStats(ctx context.Context, tenantID string) (*models.MLOpsStats, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) hasRepo() bool {
	return s.repo != nil
}

// ==================== Model Registry ====================

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]models.Model, error) {
	if !s.hasRepo() { return []models.Model{}, nil }
	return s.repo.ListModels(ctx, tenantID)
}

func (s *Service) GetModel(ctx context.Context, tenantID, id string) (*models.Model, error) {
	if !s.hasRepo() { return nil, nil }
	return s.repo.GetModel(ctx, tenantID, id)
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string, req models.CreateModelRequest) (*models.Model, error) {
	if !s.hasRepo() {
		return &models.Model{ID: "no-db", TenantID: tenantID, Name: req.Name, Status: "draft"}, nil
	}
	return s.repo.CreateModel(ctx, tenantID, req)
}

func (s *Service) UpdateModel(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Model, error) {
	if !s.hasRepo() { return nil, nil }
	return s.repo.UpdateModel(ctx, tenantID, id, updates)
}

func (s *Service) DeleteModel(ctx context.Context, tenantID, id string) error {
	if !s.hasRepo() { return nil }
	return s.repo.DeleteModel(ctx, tenantID, id)
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) error {
	if !s.hasRepo() { return nil }
	return s.repo.DeregisterModel(ctx, tenantID, id)
}

// ==================== Training / Evaluation / Deployment ====================

func (s *Service) Train(ctx context.Context, tenantID, modelID string, req models.TrainingJobRequest) (map[string]interface{}, error) {
	if !s.hasRepo() {
		return map[string]interface{}{"id": modelID, "status": "pending"}, nil
	}
	job, err := s.repo.CreateTrainingJob(ctx, tenantID, modelID, req)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": job.ID, "status": job.Status}, nil
}

func (s *Service) Evaluate(ctx context.Context, tenantID, modelID string, req models.CreateExperimentRequest) (map[string]interface{}, error) {
	if !s.hasRepo() {
		return map[string]interface{}{"id": modelID, "status": "running"}, nil
	}
	exp, err := s.repo.CreateExperiment(ctx, tenantID, modelID, req)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": exp.ID, "status": exp.Status}, nil
}

func (s *Service) Deploy(ctx context.Context, tenantID, modelID string, req models.CreateDeploymentRequest) (map[string]interface{}, error) {
	if !s.hasRepo() {
		return map[string]interface{}{"id": modelID, "status": "deployed", "environment": req.Environment}, nil
	}
	dep, err := s.repo.CreateDeployment(ctx, tenantID, modelID, req)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": dep.ID, "status": dep.Status, "environment": dep.Environment, "endpointUrl": dep.EndpointURL}, nil
}

func (s *Service) Rollback(ctx context.Context, tenantID, modelID string, req models.RollbackRequest) (map[string]interface{}, error) {
	if !s.hasRepo() {
		return map[string]interface{}{"id": modelID, "status": "rolling_back"}, nil
	}
	dep, err := s.repo.RollbackDeployment(ctx, tenantID, modelID, req)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": dep.ID, "status": dep.Status, "environment": dep.Environment}, nil
}

func (s *Service) GetMetrics(ctx context.Context, tenantID, modelID string) (map[string]interface{}, error) {
	if !s.hasRepo() {
		return map[string]interface{}{"metrics": []models.Metric{}, "stats": &models.MLOpsStats{}}, nil
	}
	metrics, err := s.repo.GetModelMetrics(ctx, modelID, 100)
	if err != nil {
		return nil, err
	}
	stats, err := s.repo.GetStats(ctx, tenantID)
	if err != nil {
		stats = &models.MLOpsStats{}
	}
	return map[string]interface{}{"metrics": metrics, "stats": stats}, nil
}

// ==================== Experiments / Artifacts ====================

func (s *Service) ListExperiments(ctx context.Context, tenantID, modelID string) ([]models.Experiment, error) {
	if !s.hasRepo() { return []models.Experiment{}, nil }
	return s.repo.ListExperimentsByModel(ctx, modelID)
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID, modelID string) ([]models.Artifact, error) {
	if !s.hasRepo() { return []models.Artifact{}, nil }
	return s.repo.ListArtifactsByModel(ctx, modelID)
}

// ==================== Pipelines ====================

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]models.Pipeline, error) {
	if !s.hasRepo() { return []models.Pipeline{}, nil }
	return s.repo.ListPipelines(ctx, tenantID)
}

// ==================== Metrics recording ====================

func (s *Service) RecordMetric(ctx context.Context, tenantID, modelID string, req models.RecordMetricRequest) error {
	if !s.hasRepo() { return nil }
	return s.repo.RecordMetric(ctx, tenantID, modelID, req)
}

// ==================== Legacy CRUD compatibility ====================

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return nil, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	m, err := s.GetModel(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return &models.Record{ID: m.ID, TenantID: m.TenantID, Name: m.Name, Status: m.Status, CreatedAt: m.CreatedAt}, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	m, err := s.RegisterModel(ctx, tenantID, models.CreateModelRequest{Name: req.Name, Metadata: req.Config})
	if err != nil {
		return nil, err
	}
	return &models.Record{ID: m.ID, TenantID: m.TenantID, Name: m.Name, Status: m.Status, CreatedAt: m.CreatedAt}, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	m, err := s.UpdateModel(ctx, tenantID, id, map[string]interface{}{"name": req.Name})
	if err != nil {
		return nil, err
	}
	return &models.Record{ID: m.ID, TenantID: m.TenantID, Name: m.Name, Status: m.Status, CreatedAt: m.CreatedAt}, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.DeleteModel(ctx, tenantID, id)
}