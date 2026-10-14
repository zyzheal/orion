package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/rdm/requirement/models"
	"orion/platform-svc-go/internal/rdm/requirement/repository"
	"orion/platform-svc-go/internal/eventpublisher"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
	events eventpublisher.EventPublisher
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

// SetPublisher attaches an event publisher for domain events.
func (s *Service) SetPublisher(p eventpublisher.EventPublisher) {
	s.events = p
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateRequirementRequest) (*models.Requirement, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}
	if req.Type == "" {
		req.Type = "feature"
	}
	if req.CreatedBy == "" {
		req.CreatedBy = "system"
	}
	if req.Labels == nil {
		req.Labels = map[string]any{}
	}

	now := time.Now().UTC()
	item := &models.Requirement{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Title:          req.Title,
		Description:    req.Description,
		Status:         req.Status,
		Priority:       req.Priority,
		Type:           req.Type,
		EffortPoints:   req.EffortPoints,
		SprintID:       req.SprintID,
		ProjectID:      req.ProjectID,
		ParentID:       req.ParentID,
		RepoRef:        req.RepoRef,
		Labels:         req.Labels,
		Severity:       req.Severity,
		EstimatedHours: req.EstimatedHours,
		AssigneeID:     req.AssigneeID,
		CreatedBy:      req.CreatedBy,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("create requirement: %w", err)
	}
	s.logger.Info("requirement created", zap.String("id", item.ID), zap.String("title", item.Title))
	if s.events != nil {
		_ = s.events.Publish(ctx, "rdm.requirement.created", tenantID, map[string]any{"id": item.ID, "title": item.Title, "status": item.Status})
	}
	return item, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Requirement, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q *models.ListRequirementsRequest) ([]models.Requirement, int, error) {
	if q == nil {
		q = &models.ListRequirementsRequest{}
	}
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateRequirementRequest) (*models.Requirement, error) {
	// If status is being changed, validate the transition
	if req.Status != nil {
		current, err := s.repo.GetByID(ctx, tenantID, id)
		if err != nil {
			return nil, err
		}
		if err := ValidateReqTransition(current.Status, *req.Status); err != nil {
			return nil, err
		}
	}

	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.EffortPoints != nil {
		updates["effort_points"] = *req.EffortPoints
	}
	if req.SprintID != nil {
		updates["sprint_id"] = *req.SprintID
	}
	if req.ProjectID != nil {
		updates["project_id"] = *req.ProjectID
	}
	if req.ParentID != nil {
		updates["parent_id"] = *req.ParentID
	}
	if req.RepoRef != nil {
		updates["repo_ref"] = *req.RepoRef
	}
	if req.Labels != nil {
		updates["labels"] = req.Labels
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.EstimatedHours != nil {
		updates["estimated_hours"] = *req.EstimatedHours
	}
	if req.ActualHours != nil {
		updates["actual_hours"] = *req.ActualHours
	}
	if req.AssigneeID != nil {
		updates["assignee_id"] = *req.AssigneeID
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	var result *models.Requirement
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
	return result, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok {
		s.logger.Info("requirement deleted", zap.String("id", id))
	}
	return ok, nil
}
