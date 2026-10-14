package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/inspection-schedule/models"
	"orion/platform-svc-go/internal/inspection-schedule/repository"
	"orion/platform-svc-go/internal/inspection-schedule/scheduler"
	"orion/platform-svc-go/internal/eventpublisher"
	"orion/platform-svc-go/internal/auditlogger"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
	events eventpublisher.EventPublisher
	auditor auditlogger.AuditLogger
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

// SetPublisher attaches an event publisher for domain events.
func (s *Service) SetPublisher(p eventpublisher.EventPublisher) {
	s.events = p
}

// SetAuditLogger attaches an audit logger for recording mutations.
func (s *Service) SetAuditLogger(l auditlogger.AuditLogger) {
	s.auditor = l
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
	if s.events != nil {
		_ = s.events.Publish(ctx, "inspection.schedule.created", tenantID, map[string]any{"id": schedule.ID, "name": schedule.Name, "templateId": schedule.TemplateID})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "create", TenantID: tenantID, ResourceType: "inspection.schedule", ResourceID: schedule.ID, Details: map[string]any{"name": schedule.Name, "templateId": schedule.TemplateID}})
		}}
	return schedule, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.InspectionSchedule, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, page, pageSize int) ([]models.InspectionSchedule, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.List(ctx, tenantID, page, pageSize)
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
	var result *models.InspectionSchedule
	if err := s.repo.WithTx(ctx, func(rtx *repository.Repository) error {
		if err := rtx.Update(ctx, tenantID, id, updates); err != nil {
			return err
		}
		item, err := rtx.GetByID(ctx, tenantID, id)
		if err != nil {
			return err
		}
		result = item
		return nil
	}); err != nil {
		return nil, err
	}
	if s.auditor != nil {
		_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "update", TenantID: tenantID, ResourceType: "inspection.schedule", ResourceID: id, Details: map[string]any{"fields": updates}})
	}
	return result, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok && s.events != nil {
		_ = s.events.Publish(ctx, "inspection.schedule.deleted", tenantID, map[string]any{"id": id})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "delete", TenantID: tenantID, ResourceType: "inspection.schedule", ResourceID: id})
		}}
	return ok, nil
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

// NextRun computes the next scheduled run time for a schedule.
func (s *Service) NextRun(ctx context.Context, tenantID, id string) (time.Time, string, error) {
	sched, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return time.Time{}, "", sql.ErrNoRows
		}
		return time.Time{}, "", fmt.Errorf("get schedule: %w", err)
	}
	next, err := scheduler.ComputeNextRunStatic(sched.CronExpr, time.Now().UTC())
	if err != nil {
		return time.Time{}, sched.CronExpr, err
	}
	return next, sched.CronExpr, nil
}

// Trigger manually triggers a scheduled inspection immediately. It updates
// the schedule's last_run_at and computes the next_run_at.
func (s *Service) Trigger(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	sched, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sql.ErrNoRows
		}
		return nil, fmt.Errorf("get schedule: %w", err)
	}

	now := time.Now().UTC()
	next, err := scheduler.ComputeNextRunStatic(sched.CronExpr, now)
	if err != nil {
		return nil, fmt.Errorf("compute next run: %w", err)
	}

	updates := map[string]interface{}{
		"last_run_at": now,
		"last_result": "triggered",
		"next_run_at": next,
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, fmt.Errorf("update schedule: %w", err)
	}

	s.logger.Info("inspection schedule triggered",
		zap.String("id", id),
		zap.String("template", sched.TemplateID))
	return map[string]interface{}{
		"triggeredAt": now,
		"nextRunAt":   next,
		"schedule":    sched,
	}, nil
}
