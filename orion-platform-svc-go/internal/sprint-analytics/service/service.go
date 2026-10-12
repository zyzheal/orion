package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/sprint-analytics/models"
	"orion/platform-svc-go/internal/sprint-analytics/repository"
)

// SprintService provides review, retrospective, and velocity operations.
type SprintService struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewSprintService(repo *repository.Repository, logger *zap.Logger) *SprintService {
	return &SprintService{repo: repo, logger: logger}
}

// ==================== Sprint Review ====================

func (s *SprintService) CreateReview(ctx context.Context, tenantID string, req *models.CreateReviewRequest) (*models.SprintReview, error) {
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
	if err := s.repo.UpdateReview(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.GetReview(ctx, tenantID, id)
}

// ==================== Sprint Retrospective ====================

func (s *SprintService) CreateRetro(ctx context.Context, tenantID string, req *models.CreateRetroRequest) (*models.SprintRetrospective, error) {
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
	if err := s.repo.UpdateRetro(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.GetRetro(ctx, tenantID, id)
}
