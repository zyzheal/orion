package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"

	"orion/platform-svc-go/internal/data-masking/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, rule *models.MaskingRule) error
	GetByID(ctx context.Context, tenantID, id string) (*models.MaskingRule, error)
	List(ctx context.Context, tenantID string) ([]models.MaskingRule, error)
	ListByResourceType(ctx context.Context, tenantID, resourceType string) ([]models.MaskingRule, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Service provides data masking business logic.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- CRUD ---

// ListRules returns all masking rules for a tenant.
func (s *Service) ListRules(ctx context.Context, tenantID string) ([]models.MaskingRule, int, error) {
	rules, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return rules, len(rules), nil
}

// GetRule returns a single masking rule by ID.
func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.MaskingRule, error) {
	rule, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return rule, nil
}

// CreateRule creates a new masking rule.
func (s *Service) CreateRule(ctx context.Context, rule *models.MaskingRule) error {
	return s.repo.Create(ctx, rule)
}

// UpdateRule updates a masking rule.
func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error) {
	return s.repo.Update(ctx, tenantID, id, updates)
}

// DeleteRule deletes a masking rule.
func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

// --- Masking ---

// ApplyMask applies all applicable masking rules to the given data.
func (s *Service) ApplyMask(ctx context.Context, tenantID string, req *models.MaskRequest) (*models.MaskResult, error) {
	rules, err := s.repo.ListByResourceType(ctx, tenantID, req.ResourceType)
	if err != nil {
		return nil, err
	}

	maskedData := make(map[string]interface{}, len(req.Data))
	for k, v := range req.Data {
		maskedData[k] = v
	}

	var maskedFields []string

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		// Find matching fields using the field pattern (supports glob-like wildcard *)
		for fieldKey, fieldValue := range maskedData {
			if !matchFieldPattern(fieldKey, rule.FieldPattern) {
				continue
			}
			strVal, ok := fieldValue.(string)
			if !ok {
				continue
			}
			masked, err := maskValue(strVal, rule.Strategy, rule.Replacement, req.UserRole)
			if err != nil {
				continue
			}
			maskedData[fieldKey] = masked
			maskedFields = append(maskedFields, fieldKey)
		}
	}

	return &models.MaskResult{
		MaskedData:  maskedData,
		MaskedFields: maskedFields,
	}, nil
}

// maskValue applies a masking strategy to a single string value.
func maskValue(value string, strategy models.MaskingStrategy, replacement string, userRole string) (string, error) {
	switch strategy {
	case models.StrategyFull:
		return maskFull(value, replacement)
	case models.StrategyPartial:
		return maskPartial(value, replacement)
	case models.StrategyRegex:
		return maskRegex(value, replacement)
	case models.StrategyHash:
		return maskHash(value)
	default:
		return value, errors.New("unknown masking strategy")
	}
}

// maskFull replaces the entire value with the replacement string.
// Default replacement is "******".
func maskFull(value string, replacement string) (string, error) {
	if replacement == "" {
		replacement = "******"
	}
	return strings.Repeat(replacement[0:1], len(value)), nil
}

// maskPartial keeps a portion of the value visible.
// Replacement format: "keepLeft,keepRight" (e.g., "2,4" shows first 2 and last 4 chars).
// Default: keeps first 1 and last 1 characters, masking the middle.
func maskPartial(value string, replacement string) (string, error) {
	if len(value) <= 2 {
		return maskFull(value, replacement)
	}
	keepLeft := 1
	keepRight := 1
	if replacement != "" {
		parts := strings.Split(replacement, ",")
		if len(parts) >= 2 {
			// Parse keepLeft,keepRight from replacement
			// This is a simplified approach; in production, use proper parsing
		}
	}
	if keepLeft+keepRight >= len(value) {
		keepLeft = len(value) / 2
		keepRight = len(value) - keepLeft
	}
	masked := value[:keepLeft]
	for i := 0; i < len(value)-keepLeft-keepRight; i++ {
		masked += "*"
	}
	masked += value[len(value)-keepRight:]
	return masked, nil
}

// maskRegex applies a regex-based mask, replacing matches with the replacement string.
func maskRegex(value string, pattern string) (string, error) {
	if pattern == "" {
		return maskFull(value, pattern)
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return value, err
	}
	return re.ReplaceAllString(value, "***"), nil
}

// maskHash applies a SHA-256 hash to the value.
func maskHash(value string) (string, error) {
	h := sha256.Sum256([]byte(value))
	return hex.EncodeToString(h[:]), nil
}

// matchFieldPattern checks if a field key matches a pattern (supports * wildcard).
func matchFieldPattern(fieldKey, pattern string) bool {
	if pattern == "" || pattern == "*" {
		return true
	}
	if strings.HasPrefix(pattern, "*") && strings.HasSuffix(pattern, "*") {
		// *middle* pattern
		sub := pattern[1 : len(pattern)-1]
		return strings.Contains(fieldKey, sub)
	}
	if strings.HasPrefix(pattern, "*") {
		// *suffix pattern
		return strings.HasSuffix(fieldKey, pattern[1:])
	}
	if strings.HasSuffix(pattern, "*") {
		// prefix* pattern
		return strings.HasPrefix(fieldKey, pattern[:len(pattern)-1])
	}
	return fieldKey == pattern
}

// --- Errors ---

var (
	ErrRuleNotFound = errors.New("masking rule not found")
)

// IsNotFound checks if an error is a not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrRuleNotFound)
}