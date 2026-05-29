package service

import (
	"context"
	"errors"
	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/repository"
)

var (
	ErrPipelineNotFound = errors.New("pipeline not found")
	ErrRunNotFound      = errors.New("pipeline run not found")
	ErrInvalidStatus    = errors.New("invalid status transition")
)

type PipelineService struct {
	pipelineRepo *repository.PipelineRepository
	runRepo      *repository.RunRepository
	stageRepo    *repository.StageRepository
}

func NewPipelineService(pipelineRepo *repository.PipelineRepository, runRepo *repository.RunRepository, stageRepo *repository.StageRepository) *PipelineService {
	return &PipelineService{
		pipelineRepo: pipelineRepo,
		runRepo:      runRepo,
		stageRepo:    stageRepo,
	}
}

func (s *PipelineService) Create(ctx context.Context, p *models.Pipeline) error {
	p.Status = "active"
	return s.pipelineRepo.Create(ctx, p)
}

func (s *PipelineService) GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	return s.pipelineRepo.GetByID(ctx, tenantID, id)
}

func (s *PipelineService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Pipeline, error) {
	return s.pipelineRepo.List(ctx, tenantID, offset, limit)
}

func (s *PipelineService) Update(ctx context.Context, p *models.Pipeline) error {
	return s.pipelineRepo.Update(ctx, p)
}

func (s *PipelineService) Delete(ctx context.Context, tenantID, id string) error {
	return s.pipelineRepo.Delete(ctx, tenantID, id)
}

func (s *PipelineService) TriggerRun(ctx context.Context, tenantID, pipelineID, triggerType, triggerBy string) (*models.PipelineRun, error) {
	pipeline, err := s.pipelineRepo.GetByID(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, err
	}

	run := &models.PipelineRun{
		PipelineID:  pipeline.ID,
		TriggerType: models.TriggerType(triggerType),
		TriggerBy:   triggerBy,
		Status:      models.StatusPending,
	}
	if err := s.runRepo.Create(ctx, run); err != nil {
		return nil, err
	}

	run.Context = "{}"

	if err := s.runRepo.MarkStarted(ctx, run.ID); err != nil {
		return nil, err
	}

	stages := parseStagesFromYAML(pipeline.YAMLConfig)
	for _, name := range stages {
		stage := &models.Stage{
			RunID:  run.ID,
			Name:   name,
			Status: models.StagePending,
		}
		_ = s.stageRepo.Create(ctx, stage)
	}

	return run, nil
}

func (s *PipelineService) GetRunByID(ctx context.Context, id string) (*models.PipelineRun, error) {
	return s.runRepo.GetByID(ctx, id)
}

func (s *PipelineService) ListRuns(ctx context.Context, pipelineID string, offset, limit int) ([]models.PipelineRun, error) {
	return s.runRepo.ListByPipeline(ctx, pipelineID, offset, limit)
}

func (s *PipelineService) GetStages(ctx context.Context, runID string) ([]models.Stage, error) {
	return s.stageRepo.GetByRunID(ctx, runID)
}

func parseStagesFromYAML(yamlConfig string) []string {
	if yamlConfig == "" {
		return []string{"build", "test", "deploy"}
	}
	return []string{"build", "test", "deploy"}
}

func (s *PipelineService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.pipelineRepo.Count(ctx, tenantID)
}
