package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ai/rule-engine/models"
	"go.uber.org/zap"
)

type RuleEngineService struct {
	rules  map[string]*models.Rule
	logger *zap.Logger
}

func NewRuleEngineService(logger *zap.Logger) *RuleEngineService {
	return &RuleEngineService{
		rules:  make(map[string]*models.Rule),
		logger: logger,
	}
}

// CreateRule creates a new rule.
func (s *RuleEngineService) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.Rule, error) {
	now := time.Now()
	id := fmt.Sprintf("rule_%d", time.Now().UnixNano())

	rule := &models.Rule{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Priority:    req.Priority,
		Conditions:  fmt.Sprintf("%v", req.Conditions),
		Actions:     fmt.Sprintf("%v", req.Actions),
		IsEnabled:   true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	s.rules[id] = rule

	s.logger.Info("rule created",
		zap.String("ruleId", id),
		zap.String("name", req.Name),
		zap.Int("priority", req.Priority),
	)
	return rule, nil
}

// Evaluate evaluates a rule against input data.
func (s *RuleEngineService) Evaluate(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.EvaluateResult, error) {
	rule, ok := s.rules[req.RuleID]
	if !ok {
		return nil, fmt.Errorf("rule not found: %s", req.RuleID)
	}
	if rule.TenantID != tenantID {
		return nil, fmt.Errorf("rule not accessible: %s", req.RuleID)
	}
	if !rule.IsEnabled {
		return &models.EvaluateResult{
			RuleID:  rule.ID,
			Message: "rule is disabled",
		}, nil
	}

	triggered := s.evaluateConditions(rule.Conditions, req.Data)
	result := &models.EvaluateResult{
		RuleID:    rule.ID,
		Triggered: triggered,
		Message:   "evaluated",
	}

	if triggered {
		result.Actions = s.evaluateActions(rule.Actions, req.Data)
		result.Message = "rule triggered, actions executed"
	} else {
		result.Message = "rule condition not met"
	}

	s.logger.Info("rule evaluated",
		zap.String("ruleId", rule.ID),
		zap.Bool("triggered", triggered),
	)
	return result, nil
}

// evaluateConditions evaluates rule conditions.
func (s *RuleEngineService) evaluateConditions(conditionsStr string, data map[string]interface{}) bool {
	// Simple evaluation: check if conditions are met
	// In a real implementation, this would parse JSON conditions
	conditions := strings.Split(conditionsStr, ",")
	for _, cond := range conditions {
		cond = strings.TrimSpace(cond)
		if !strings.HasPrefix(cond, "[") && !strings.HasPrefix(cond, "{") {
			// Simple key=value condition
			parts := strings.SplitN(cond, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				expectedVal := strings.TrimSpace(parts[1])
				actualVal, ok := data[key]
				if !ok {
					return false
				}
				if fmt.Sprintf("%v", actualVal) != expectedVal {
					return false
				}
			}
		}
	}
	return len(conditions) == 0 // If no conditions, rule always triggers
}

// evaluateActions executes rule actions.
func (s *RuleEngineService) evaluateActions(actionsStr string, data map[string]interface{}) []interface{} {
	var actions []interface{}
	actionsList := strings.Split(actionsStr, ",")

	for _, action := range actionsList {
		action = strings.TrimSpace(action)
		if !strings.HasPrefix(action, "[") && !strings.HasPrefix(action, "{") {
			actions = append(actions, map[string]string{
				"type":     action,
				"status":   "executed",
				"timestamp": time.Now().Format(time.RFC3339),
			})
		}
	}
	return actions
}

// QueryRules returns all rules for a tenant.
func (s *RuleEngineService) QueryRules(tenantID string) (models.RuleResponse, error) {
	var resp models.RuleResponse
	for _, rule := range s.rules {
		if rule.TenantID == tenantID {
			resp.Data = append(resp.Data, *rule)
		}
	}
	resp.Total = int64(len(resp.Data))
	return resp, nil
}

// GetRule returns a rule by ID.
func (s *RuleEngineService) GetRule(tenantID, id string) (*models.Rule, error) {
	rule, ok := s.rules[id]
	if !ok {
		return nil, fmt.Errorf("rule not found: %s", id)
	}
	if rule.TenantID != tenantID {
		return nil, fmt.Errorf("rule not accessible: %s", id)
	}
	return rule, nil
}

// UpdateRule updates a rule.
func (s *RuleEngineService) UpdateRule(ctx context.Context, tenantID, id string, name, description *string, priority *int, isEnabled *bool) (*models.Rule, error) {
	rule, ok := s.rules[id]
	if !ok {
		return nil, fmt.Errorf("rule not found: %s", id)
	}
	if rule.TenantID != tenantID {
		return nil, fmt.Errorf("rule not accessible: %s", id)
	}

	if name != nil {
		rule.Name = *name
	}
	if description != nil {
		rule.Description = *description
	}
	if priority != nil {
		rule.Priority = *priority
	}
	if isEnabled != nil {
		rule.IsEnabled = *isEnabled
	}
	rule.UpdatedAt = time.Now()

	s.logger.Info("rule updated",
		zap.String("ruleId", id),
		zap.String("name", rule.Name),
	)
	return rule, nil
}

// DeleteRule removes a rule.
func (s *RuleEngineService) DeleteRule(ctx context.Context, tenantID, id string) error {
	rule, ok := s.rules[id]
	if !ok {
		return fmt.Errorf("rule not found: %s", id)
	}
	if rule.TenantID != tenantID {
		return fmt.Errorf("rule not accessible: %s", id)
	}

	delete(s.rules, id)
	s.logger.Info("rule deleted", zap.String("ruleId", id))
	return nil
}
