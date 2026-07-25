package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cmdb-validator/models"
	"orion/platform-svc-go/internal/cmdb-validator/validators"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateRule(ctx context.Context, rule *models.CMDBValidationRule) error
	GetRuleByID(ctx context.Context, tenantID, id string) (*models.CMDBValidationRule, error)
	ListRules(ctx context.Context, tenantID, category string, offset, limit int) ([]models.CMDBValidationRule, error)
	CountRules(ctx context.Context, tenantID, category string) (int, error)
	UpdateRule(ctx context.Context, rule *models.CMDBValidationRule) error
	DeleteRule(ctx context.Context, tenantID, id string) error
	SaveResult(ctx context.Context, result *models.CMDBValidationResult) error
	GetValidationHistory(ctx context.Context, tenantID, targetID string, limit int) ([]models.CMDBValidationResult, error)
	CheckUniqueField(ctx context.Context, tenantID, field, value string) (bool, error)
}

// ValidatorRegistry is the service-level CMDB validator orchestrator.
type ValidatorRegistry struct {
	validators map[string]validators.IValidator
	repo       RepositoryInterface
	logger     *zap.Logger
	mu         sync.RWMutex
}

// NewValidatorRegistry creates a new ValidatorRegistry with built-in validators.
func NewValidatorRegistry(repo RepositoryInterface, logger *zap.Logger) *ValidatorRegistry {
	registry := &ValidatorRegistry{
		validators: make(map[string]validators.IValidator),
		repo:       repo,
		logger:     logger,
	}
	registry.registerDefaults()
	return registry
}

// registerDefaults registers the built-in validator types.
func (r *ValidatorRegistry) registerDefaults() {
	// Each validator is registered per-category; concrete instances are built
	// per-rule because each rule carries its own condition/errMsg.
	r.mu.Lock()
	defer r.mu.Unlock()

	// Format validators
	r.validators["format"] = &validators.FormatValidator{}
	// Range validators
	r.validators["range"] = &validators.RangeValidator{}
	// Reference validators
	r.validators["reference"] = &validators.ReferenceValidator{}
	// Enum validators
	r.validators["enum"] = &validators.EnumValidator{}
	// Custom validators
	r.validators["custom"] = &validators.CustomValidator{}
	// Relationship validators
	r.validators["relationship"] = &validators.RelationshipValidator{}
	// Uniqueness validators
	r.validators["uniqueness"] = &validators.UniquenessValidator{}
}

// ===========================================================================
// Rule CRUD operations
// ===========================================================================

// CreateRule creates a new validation rule.
func (r *ValidatorRegistry) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.CMDBValidationRule, error) {
	now := time.Now()
	rule := &models.CMDBValidationRule{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Category:     req.Category,
		TargetType:   req.TargetType,
		Condition:    req.Condition,
		ErrorMessage: req.ErrorMessage,
		Severity:     req.Severity,
		Enabled:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Validate severity
	if rule.Severity == "" {
		rule.Severity = "error"
	} else if rule.Severity != "error" && rule.Severity != "warning" && rule.Severity != "info" {
		return nil, fmt.Errorf("invalid severity: %s", rule.Severity)
	}

	// Validate category
	knownCategories := []string{"format", "range", "reference", "enum", "custom", "relationship", "uniqueness"}
	if !contains(knownCategories, rule.Category) {
		return nil, fmt.Errorf("invalid category: %s", rule.Category)
	}

	// Validate target type
	knownTargets := []string{"CI", "relation", "attribute"}
	if !contains(knownTargets, rule.TargetType) {
		return nil, fmt.Errorf("invalid target_type: %s", rule.TargetType)
	}

	if err := r.repo.CreateRule(ctx, rule); err != nil {
		return nil, fmt.Errorf("failed to create validation rule: %w", err)
	}
	r.logger.Info("validation rule created",
		zap.String("rule_id", rule.ID),
		zap.String("name", rule.Name),
		zap.String("category", rule.Category),
	)
	return rule, nil
}

// GetRule retrieves a rule by ID.
func (r *ValidatorRegistry) GetRule(ctx context.Context, tenantID, id string) (*models.CMDBValidationRule, error) {
	rule, err := r.repo.GetRuleByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get validation rule: %w", err)
	}
	return rule, nil
}

// ListRules retrieves rules for a tenant with optional category filter.
func (r *ValidatorRegistry) ListRules(ctx context.Context, tenantID, category string, offset, limit int) ([]models.CMDBValidationRule, error) {
	if limit == 0 {
		limit = 100
	}
	rules, err := r.repo.ListRules(ctx, tenantID, category, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list validation rules: %w", err)
	}
	return rules, nil
}

// UpdateRule updates an existing rule.
func (r *ValidatorRegistry) UpdateRule(ctx context.Context, tenantID, id string, req *models.UpdateRuleRequest) (*models.CMDBValidationRule, error) {
	rule, err := r.repo.GetRuleByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get rule: %w", err)
	}

	if req.Name != "" {
		rule.Name = req.Name
	}
	if req.Category != "" {
		knownCategories := []string{"format", "range", "reference", "enum", "custom", "relationship", "uniqueness"}
		if !contains(knownCategories, req.Category) {
			return nil, fmt.Errorf("invalid category: %s", req.Category)
		}
		rule.Category = req.Category
	}
	if req.TargetType != "" {
		knownTargets := []string{"CI", "relation", "attribute"}
		if !contains(knownTargets, req.TargetType) {
			return nil, fmt.Errorf("invalid target_type: %s", req.TargetType)
		}
		rule.TargetType = req.TargetType
	}
	if req.Condition != "" {
		rule.Condition = req.Condition
	}
	if req.ErrorMessage != "" {
		rule.ErrorMessage = req.ErrorMessage
	}
	if req.Severity != "" {
		if req.Severity != "error" && req.Severity != "warning" && req.Severity != "info" {
			return nil, fmt.Errorf("invalid severity: %s", req.Severity)
		}
		rule.Severity = req.Severity
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}

	if err := r.repo.UpdateRule(ctx, rule); err != nil {
		return nil, fmt.Errorf("failed to update validation rule: %w", err)
	}
	r.logger.Info("validation rule updated",
		zap.String("rule_id", rule.ID),
		zap.String("name", rule.Name),
	)
	return rule, nil
}

// DeleteRule removes a rule by ID.
func (r *ValidatorRegistry) DeleteRule(ctx context.Context, tenantID, id string) error {
	if err := r.repo.DeleteRule(ctx, tenantID, id); err != nil {
		return fmt.Errorf("failed to delete validation rule: %w", err)
	}
	r.logger.Info("validation rule deleted", zap.String("rule_id", id))
	return nil
}

// ===========================================================================
// Validation operations
// ===========================================================================

// Validate runs all applicable rules against the given data.
func (r *ValidatorRegistry) Validate(ctx context.Context, tenantID, targetType, targetID string, data map[string]interface{}) ([]models.CMDBValidationResult, error) {
	// Get all enabled rules for this tenant
	rules, err := r.repo.ListRules(ctx, tenantID, "", 0, 1000)
	if err != nil {
		return nil, fmt.Errorf("failed to load rules: %w", err)
	}

	results := make([]models.CMDBValidationResult, 0, len(rules))
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		// Match by target type
		if rule.TargetType != targetType {
			continue
		}
		result := r.applyRule(ctx, tenantID, &rule, targetID, data)
		results = append(results, result)
	}
	return results, nil
}

// ValidateCI validates a Configuration Item.
func (r *ValidatorRegistry) ValidateCI(ctx context.Context, tenantID string, ci map[string]interface{}) ([]models.CMDBValidationResult, error) {
	targetID := asString(ci["id"])
	if targetID == "" {
		targetID = uuid.New().String()
	}
	return r.Validate(ctx, tenantID, "CI", targetID, ci)
}

// ValidateRelationship validates a CMDB relationship.
func (r *ValidatorRegistry) ValidateRelationship(ctx context.Context, tenantID string, relation map[string]interface{}) ([]models.CMDBValidationResult, error) {
	targetID := asString(relation["relation_id"])
	if targetID == "" {
		targetID = uuid.New().String()
	}
	return r.Validate(ctx, tenantID, "relation", targetID, relation)
}

// GetValidationHistory retrieves recent validation results for a target.
func (r *ValidatorRegistry) GetValidationHistory(ctx context.Context, tenantID, targetID string, limit int) ([]models.CMDBValidationResult, error) {
	if limit == 0 {
		limit = 50
	}
	history, err := r.repo.GetValidationHistory(ctx, tenantID, targetID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get validation history: %w", err)
	}
	return history, nil
}

// ===========================================================================
// Internal helpers
// ===========================================================================

// applyRule runs a single validation rule against data and persists the result.
func (r *ValidatorRegistry) applyRule(ctx context.Context, tenantID string, rule *models.CMDBValidationRule, targetID string, data map[string]interface{}) models.CMDBValidationResult {
	resultID := uuid.New().String()
	passed, errMsg := r.runValidator(ctx, rule, data)

	status := "pass"
	if !passed {
		switch rule.Severity {
		case "warning":
			status = "warning"
		default:
			status = "fail"
		}
	}

	// Build details JSON
	details := map[string]interface{}{
		"rule_name": rule.Name,
		"category":  rule.Category,
		"severity":  rule.Severity,
	}
	if rule.Condition != "" {
		details["condition"] = rule.Condition
	}
	detailsJSON, _ := json.Marshal(details)

	result := models.CMDBValidationResult{
		ID:        resultID,
		TenantID:  tenantID,
		RuleID:    rule.ID,
		TargetID:  targetID,
		Status:    status,
		Message:   errMsg,
		Details:   string(detailsJSON),
		CreatedAt: time.Now(),
	}

	// Persist the result (non-blocking: log error but don't fail validation)
	if persistErr := r.repo.SaveResult(ctx, &result); persistErr != nil {
		r.logger.Warn("failed to persist validation result",
			zap.Error(persistErr),
			zap.String("rule_id", rule.ID),
		)
	}

	return result
}

// runValidator dispatches to the appropriate validator implementation.
func (r *ValidatorRegistry) runValidator(ctx context.Context, rule *models.CMDBValidationRule, data map[string]interface{}) (bool, string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Build a concrete validator instance for this rule
	switch rule.Category {
	case "format":
		v := validators.NewFormatValidator(rule.Name, rule.Condition, rule.ErrorMessage)
		return v.Validate(ctx, data)
	case "range":
		v := validators.NewRangeValidator(rule.Name, rule.Condition, rule.ErrorMessage)
		return v.Validate(ctx, data)
	case "reference":
		v := validators.NewReferenceValidator(rule.Name, rule.Condition, rule.ErrorMessage)
		return v.Validate(ctx, data)
	case "enum":
		v := validators.NewEnumValidator(rule.Name, rule.Condition, rule.ErrorMessage)
		return v.Validate(ctx, data)
	case "custom":
		v := validators.NewCustomValidator(rule.Name, rule.Condition, rule.ErrorMessage)
		return v.Validate(ctx, data)
	case "relationship":
		v := validators.NewRelationshipValidator(rule.Name, rule.Condition, rule.ErrorMessage)
		return v.Validate(ctx, data)
	case "uniqueness":
		v := validators.NewUniquenessValidator(rule.Name, rule.Condition, rule.ErrorMessage,
			func(ctx context.Context, field, value string) (bool, error) {
				return r.repo.CheckUniqueField(ctx, rule.TenantID, field, value)
			})
		return v.Validate(ctx, data)
	default:
		r.logger.Warn("unknown validator category",
			zap.String("category", rule.Category),
			zap.String("rule_id", rule.ID),
		)
		return true, "unknown rule category"
	}
}

// contains checks if a string exists in a slice.
func contains(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

// asString safely converts a value to string.
func asString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
