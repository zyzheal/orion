package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/sprint-analytics/models"
	"orion/platform-svc-go/internal/sprint-analytics/repository"
	"orion/platform-svc-go/internal/eventpublisher"
	"orion/platform-svc-go/internal/auditlogger"
)

// SprintService provides review, retrospective, and velocity operations.
type SprintService struct {
	repo   *repository.Repository
	logger *zap.Logger
	events eventpublisher.EventPublisher
	auditor auditlogger.AuditLogger
}

func NewSprintService(repo *repository.Repository, logger *zap.Logger) *SprintService {
	return &SprintService{repo: repo, logger: logger}
}

// SetPublisher attaches an event publisher for domain events.
func (s *SprintService) SetPublisher(p eventpublisher.EventPublisher) {
	s.events = p
}

// SetAuditLogger attaches an audit logger for recording mutations.
func (s *SprintService) SetAuditLogger(l auditlogger.AuditLogger) {
	s.auditor = l
}

// ==================== Sprint Review ====================

func (s *SprintService) CreateReview(ctx context.Context, tenantID string, req *models.CreateReviewRequest) (*models.SprintReview, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	now := time.Now().UTC()
	review := &models.SprintReview{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		SprintID:   req.SprintID,
		Status:     "pending",
		Date:       req.Date,
		Attendees:  req.Attendees,
		Highlights: req.Highlights,
		DemoNotes:  req.DemoNotes,
		Feedback:   req.Feedback,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.repo.CreateReview(ctx, review); err != nil {
		return nil, fmt.Errorf("create review: %w", err)
	}
	s.logger.Info("sprint review created", zap.String("reviewId", review.ID), zap.String("sprintId", req.SprintID))
	if s.events != nil {
		_ = s.events.Publish(ctx, "sprint.review.created", tenantID, map[string]any{"id": review.ID, "sprintId": review.SprintID})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "create", TenantID: tenantID, ResourceType: "sprint.review", ResourceID: review.ID, Details: map[string]any{"sprintId": review.SprintID}})
		}}
	return review, nil
}

func (s *SprintService) GetReview(ctx context.Context, tenantID, id string) (*models.SprintReview, error) {
	return s.repo.GetReview(ctx, tenantID, id)
}

func (s *SprintService) GetReviewBySprint(ctx context.Context, tenantID, sprintID string) (*models.SprintReview, error) {
	return s.repo.GetReviewBySprint(ctx, tenantID, sprintID)
}

func (s *SprintService) UpdateReview(ctx context.Context, tenantID, id string, req *models.UpdateReviewRequest) (*models.SprintReview, error) {
	updates := make(map[string]interface{})
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Date != nil {
		updates["date"] = *req.Date
	}
	if req.Attendees != nil {
		updates["attendees"] = req.Attendees
	}
	if req.Highlights != nil {
		updates["highlights"] = *req.Highlights
	}
	if req.DemoNotes != nil {
		updates["demo_notes"] = *req.DemoNotes
	}
	if req.Feedback != nil {
		updates["feedback"] = *req.Feedback
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	var result *models.SprintReview
	if err := s.repo.WithTx(ctx, func(rtx *repository.Repository) error {
		if err := rtx.UpdateReview(ctx, tenantID, id, updates); err != nil {
			return err
		}
		item, err := rtx.GetReview(ctx, tenantID, id)
		if err != nil {
			return err
		}
		result = item
		return nil
	}); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SprintService) DeleteReview(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.DeleteReview(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok && s.events != nil {
		_ = s.events.Publish(ctx, "sprint.review.deleted", tenantID, map[string]any{"id": id})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "delete", TenantID: tenantID, ResourceType: "sprint.review", ResourceID: id})
		}}
	return ok, nil
}

// ==================== Sprint Retrospective ====================

func (s *SprintService) CreateRetro(ctx context.Context, tenantID string, req *models.CreateRetroRequest) (*models.SprintRetrospective, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	now := time.Now().UTC()
	retro := &models.SprintRetrospective{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		SprintID:      req.SprintID,
		Date:          req.Date,
		Attendees:     req.Attendees,
		WhatWentWell:  req.WhatWentWell,
		WhatToImprove: req.WhatToImprove,
		ActionItems:   req.ActionItems,
		Summary:       req.Summary,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.repo.CreateRetro(ctx, retro); err != nil {
		return nil, fmt.Errorf("create retrospective: %w", err)
	}
	s.logger.Info("retrospective created", zap.String("retroId", retro.ID), zap.String("sprintId", req.SprintID))
	if s.events != nil {
		_ = s.events.Publish(ctx, "sprint.retrospective.created", tenantID, map[string]any{"id": retro.ID, "sprintId": retro.SprintID})
	}
	return retro, nil
}

func (s *SprintService) GetRetro(ctx context.Context, tenantID, id string) (*models.SprintRetrospective, error) {
	return s.repo.GetRetro(ctx, tenantID, id)
}

func (s *SprintService) GetRetroBySprint(ctx context.Context, tenantID, sprintID string) (*models.SprintRetrospective, error) {
	return s.repo.GetRetroBySprint(ctx, tenantID, sprintID)
}

func (s *SprintService) UpdateRetro(ctx context.Context, tenantID, id string, req *models.UpdateRetroRequest) (*models.SprintRetrospective, error) {
	updates := make(map[string]interface{})
	if req.Date != nil {
		updates["date"] = *req.Date
	}
	if req.Attendees != nil {
		updates["attendees"] = req.Attendees
	}
	if req.WhatWentWell != nil {
		updates["what_went_well"] = req.WhatWentWell
	}
	if req.WhatToImprove != nil {
		updates["what_to_improve"] = req.WhatToImprove
	}
	if req.ActionItems != nil {
		updates["action_items"] = req.ActionItems
	}
	if req.Summary != nil {
		updates["summary"] = *req.Summary
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	var result *models.SprintRetrospective
	if err := s.repo.WithTx(ctx, func(rtx *repository.Repository) error {
		if err := rtx.UpdateRetro(ctx, tenantID, id, updates); err != nil {
			return err
		}
		item, err := rtx.GetRetro(ctx, tenantID, id)
		if err != nil {
			return err
		}
		result = item
		return nil
	}); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SprintService) DeleteRetro(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.DeleteRetro(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok && s.events != nil {
		_ = s.events.Publish(ctx, "sprint.retrospective.deleted", tenantID, map[string]any{"id": id})
	}
	return ok, nil
}

// ==================== Velocity & Gantt ====================

// GetVelocity returns velocity trend across recent sprints for a project.
// This is a computed read-model that aggregates sprint review data.
func (s *SprintService) GetVelocity(ctx context.Context, tenantID, projectID string, limit int) ([]models.VelocityEntry, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}
	return s.repo.GetVelocity(ctx, tenantID, projectID, limit)
}

// GetGantt returns Gantt chart data (sprints + key milestones) for a project.
func (s *SprintService) GetGantt(ctx context.Context, tenantID, projectID string) ([]models.GanttItem, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	return s.repo.GetGantt(ctx, tenantID, projectID)
}
