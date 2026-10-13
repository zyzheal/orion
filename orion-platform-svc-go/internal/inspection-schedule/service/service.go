package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/inspection-schedule/models"
	"orion/platform-svc-go/internal/inspection-schedule/repository"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateScheduleRequest) (*models.InspectionSchedule, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.TargetConfig == nil {
		req.TargetConfig = map[string]any{}
	}
	if req.Enabled == false {
		req.Enabled = true
	}

	now := time.Now().UTC()
	schedule := &models.InspectionSchedule{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		CronExpr:     req.CronExpr,
		TemplateID:   req.TemplateID,
		TargetConfig: req.TargetConfig,
		Enabled:      req.Enabled,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.Create(ctx, schedule); err != nil {
		return nil, fmt.Errorf("create schedule: %w", err)
	}
	s.logger.Info("inspection schedule created", zap.String("id", schedule.ID), zap.String("name", schedule.Name))
	return schedule, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.InspectionSchedule, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.InspectionSchedule, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateScheduleRequest) (*models.InspectionSchedule, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.CronExpr != nil {
		updates["cron_expr"] = *req.CronExpr
	}
	if req.TemplateID != nil {
		updates["template_id"] = *req.TemplateID
	}
	if req.TargetConfig != nil {
		updates["target_config"] = req.TargetConfig
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.Get(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

// RecordRun updates the schedule after a run completes.
func (s *Service) RecordRun(ctx context.Context, tenantID, id string, result string) error {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"last_run_at": now,
		"last_result": result,
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}
