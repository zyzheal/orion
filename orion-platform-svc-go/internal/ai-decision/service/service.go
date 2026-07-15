package service

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/ai-decision/models"
	"orion/platform-svc-go/internal/ai-decision/repository"
)

var ErrNotFound = errors.New("decision not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Decision, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListDecisionsQuery) (*models.DecisionListResponse, error) {
	decisions, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	_ = decisions // ensure used
	total, err := s.repo.Count(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	_ = total // ensure used
	return &models.DecisionListResponse{Decisions: decisions, Total: total}, nil
}

func (s *Service) MakeDecision(ctx context.Context, tenantID string, req models.MakeDecisionRequest) (*models.Decision, error) {
	decision := &models.Decision{
		TenantID:   tenantID,
		Context:    req.Context,
		Choice:     req.Choice,
		Confidence: req.Confidence,
		Status:     "accepted",
		CreatedBy:  req.CreatedBy,
	}
	if err := s.repo.Create(ctx, decision); err != nil {
		return nil, err
	}
	return decision, nil
}

func (s *Service) OverrideDecision(ctx context.Context, tenantID, id string, req models.OverrideDecisionRequest) (*models.Decision, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("decision not found: %w", ErrNotFound)
	}
	updates := map[string]interface{}{
		"choice":     req.Choice,
		"confidence": req.Confidence,
		"status":     "overridden",
		"updated_by": req.CreatedBy,
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.DecisionStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
