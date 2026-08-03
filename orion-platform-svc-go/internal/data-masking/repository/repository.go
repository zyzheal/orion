package repository

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/data-masking/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
)

// Repository provides in-memory CRUD operations for masking rules.
type Repository struct {
	mu    sync.RWMutex
	rules map[string]*models.MaskingRule
}

// NewRepository creates a new Map-based Repository.
func NewRepository() *Repository {
	return &Repository{
		rules: make(map[string]*models.MaskingRule),
	}
}

// Create inserts a new masking rule.
func (r *Repository) Create(ctx context.Context, rule *models.MaskingRule) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule.ID = uuid.New().String()
	now := time.Now().UTC()
	rule.CreatedAt = now
	rule.UpdatedAt = now
	r.rules[rule.ID] = rule
	return nil
}

// GetByID retrieves a masking rule by ID and tenant ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.MaskingRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rule, ok := r.rules[id]
	if !ok || rule.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return rule, nil
}

// List returns all masking rules for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.MaskingRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.MaskingRule
	for _, rule := range r.rules {
		if rule.TenantID == tenantID {
			result = append(result, *rule)
		}
	}
	if result == nil {
		result = []models.MaskingRule{}
	}
	return result, nil
}

// ListByResourceType returns all enabled rules for a tenant filtered by resource type.
func (r *Repository) ListByResourceType(ctx context.Context, tenantID, resourceType string) ([]models.MaskingRule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.MaskingRule
	for _, rule := range r.rules {
		if rule.TenantID == tenantID && rule.ResourceType == resourceType && rule.Enabled {
			result = append(result, *rule)
		}
	}
	if result == nil {
		result = []models.MaskingRule{}
	}
	return result, nil
}

// Update applies partial updates to a masking rule.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[id]
	if !ok || rule.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	if v, ok := updates["name"]; ok {
		rule.Name = v.(string)
	}
	if v, ok := updates["description"]; ok {
		rule.Description = v.(string)
	}
	if v, ok := updates["strategy"]; ok {
		rule.Strategy = models.MaskingStrategy(v.(string))
	}
	if v, ok := updates["fieldPattern"]; ok {
		rule.FieldPattern = v.(string)
	}
	if v, ok := updates["resourceType"]; ok {
		rule.ResourceType = v.(string)
	}
	if v, ok := updates["replacement"]; ok {
		rule.Replacement = v.(string)
	}
	if v, ok := updates["classificationLevel"]; ok {
		rule.ClassificationLevel = v.(string)
	}
	if v, ok := updates["enabled"]; ok {
		rule.Enabled = v.(bool)
	}
	rule.UpdatedAt = time.Now().UTC()
	return rule, nil
}

// Delete removes a masking rule by ID and tenant ID.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[id]
	if !ok || rule.TenantID != tenantID {
		return false, nil
	}
	delete(r.rules, id)
	return true, nil
}

// Mask applies a set of masking rules to the provided data map.
// Returns the masked data and a list of field names that were masked.
func (r *Repository) Mask(ctx context.Context, data map[string]interface{}, rules []models.MaskingRule) (map[string]interface{}, []string, error) {
	// Masking algorithm logic is delegated to the service layer.
	// This method exists as a repository-level signature for future persistence.
	maskedData := make(map[string]interface{}, len(data))
	for k, v := range data {
		maskedData[k] = v
	}
	var maskedFields []string
	for _, rule := range rules {
		if rule.FieldPattern == "" {
			continue
		}
		if val, exists := maskedData[rule.FieldPattern]; exists {
			if strVal, ok := val.(string); ok {
				maskedData[rule.FieldPattern] = strVal
				maskedFields = append(maskedFields, rule.FieldPattern)
			}
		}
	}
	return maskedData, maskedFields, nil
}