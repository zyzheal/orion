package service

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/data-classification/models"
	"orion/platform-svc-go/internal/data-classification/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.ClassificationRule, error) {
	if req.Name == "" { return nil, fmt.Errorf("name is required") }
	if req.Pattern == "" { return nil, fmt.Errorf("pattern is required") }
	return s.repo.CreateRule(ctx, tenantID, req)
}

func (s *Service) ListRules(ctx context.Context, tenantID string) ([]models.ClassificationRule, error) {
	return s.repo.ListRules(ctx, tenantID)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.ClassificationRule, error) {
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRule(ctx, tenantID, id)
}

func (s *Service) Classify(ctx context.Context, tenantID string, req *models.ClassifyRequest) (*models.ClassifiedResource, error) {
	rules, err := s.repo.ListRules(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	matchedLevel := models.LevelPublic
	var matchedRuleID string

	for _, rule := range rules {
		if !rule.Enabled || rule.ResourceType != req.ResourceType {
			continue
		}
		matched, _ := regexp.MatchString(rule.Pattern, req.Content)
		if matched && levelScore(rule.Level) > levelScore(matchedLevel) {
			matchedLevel = rule.Level
			matchedRuleID = rule.ID
		}
	}

	resource := &models.ClassifiedResource{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		ResourceID:   req.ResourceID,
		ResourceType: req.ResourceType,
		Level:        matchedLevel,
		RuleID:       matchedRuleID,
		ClassifiedBy: "system",
		CreatedAt:    time.Now(),
	}
	if err := s.repo.Classify(ctx, tenantID, resource); err != nil {
		return nil, err
	}
	return resource, nil
}

func levelScore(level models.ClassificationLevel) int {
	switch level {
	case models.LevelPublic: return 0
	case models.LevelInternal: return 1
	case models.LevelConfidential: return 2
	case models.LevelRestricted: return 3
	case models.LevelCritical: return 4
	default: return 0
	}
}

func (s *Service) GetClassification(ctx context.Context, tenantID, resourceID string) (*models.ClassifiedResource, error) {
	return s.repo.GetClassification(ctx, tenantID, resourceID)
}