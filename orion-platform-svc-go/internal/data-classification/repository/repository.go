package repository

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/data-classification/models"
)

type Repository struct {
	mu       sync.RWMutex
	rules    map[string]*models.ClassificationRule
	resources map[string]*models.ClassifiedResource
}

func NewRepository() *Repository {
	return &Repository{
		rules:     make(map[string]*models.ClassificationRule),
		resources: make(map[string]*models.ClassifiedResource),
	}
}

func (r *Repository) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.ClassificationRule, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	rule := &models.ClassificationRule{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		Level:        req.Level,
		Pattern:      req.Pattern,
		ResourceType: req.ResourceType,
		Enabled:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	r.rules[rule.ID] = rule
	return rule, nil
}

func (r *Repository) ListRules(ctx context.Context, tenantID string) ([]models.ClassificationRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var items []models.ClassificationRule
	for _, rule := range r.rules {
		if rule.TenantID == tenantID {
			items = append(items, *rule)
		}
	}
	return items, nil
}

func (r *Repository) GetRule(ctx context.Context, tenantID, id string) (*models.ClassificationRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rule, ok := r.rules[id]
	if !ok || rule.TenantID != tenantID {
		return nil, fmt.Errorf("rule not found: %s", id)
	}
	return rule, nil
}

func (r *Repository) DeleteRule(ctx context.Context, tenantID, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[id]
	if !ok || rule.TenantID != tenantID {
		return fmt.Errorf("rule not found: %s", id)
	}
	delete(r.rules, id)
	return nil
}

func (r *Repository) Classify(ctx context.Context, tenantID string, resource *models.ClassifiedResource) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resources[resource.ID] = resource
	return nil
}

func (r *Repository) GetClassification(ctx context.Context, tenantID, resourceID string) (*models.ClassifiedResource, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cr, ok := r.resources[resourceID]
	if !ok || cr.TenantID != tenantID {
		return nil, fmt.Errorf("classification not found: %s", resourceID)
	}
	return cr, nil
}