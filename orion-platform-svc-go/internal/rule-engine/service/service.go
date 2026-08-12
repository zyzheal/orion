package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	condition_models "orion/platform-svc-go/internal/condition/models"
	condition_service "orion/platform-svc-go/internal/condition/service"
	"orion/platform-svc-go/internal/rule-engine/models"
	"orion/platform-svc-go/internal/rule-engine/repository"
	"go.uber.org/zap"
)

type RuleEngineService struct {
	repo   *repository.Repository
	logger *zap.Logger
	cond   *condition_service.ConditionEngine
}

func NewRuleEngineService(repo *repository.Repository, logger *zap.Logger) *RuleEngineService {
	return &RuleEngineService{
		repo:   repo,
		logger: logger,
	}
}

// SetConditionEngine injects the shared condition engine for evaluation.
func (s *RuleEngineService) SetConditionEngine(eng *condition_service.ConditionEngine) {
	s.cond = eng
}

// CreateRule creates a new rule.
func (s *RuleEngineService) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.Rule, error) {
	now := time.Now()

	rule := &models.Rule{
		ID:          fmt.Sprintf("rule_%d", time.Now().UnixNano()),
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

	if err := s.repo.Create(ctx, rule); err != nil {
		return nil, err
	}

	s.logger.Info("rule created",
		zap.String("ruleId", rule.ID),
		zap.String("name", req.Name),
		zap.Int("priority", req.Priority),
	)
	return rule, nil
}

// Evaluate evaluates a rule against input data.
func (s *RuleEngineService) Evaluate(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.EvaluateResult, error) {
	rule, err := s.repo.GetByID(ctx, tenantID, req.RuleID)
	if err != nil {
		return nil, err
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

// evaluateConditions evaluates rule conditions using the condition-engine.
// Supports two formats:
//   - JSON array: [{"field":"name","operator":"=","value":"admin"}, ...] — full expression
//   - Legacy flat: "key=value,key2=value2" — simple equality (backward compat)
func (s *RuleEngineService) evaluateConditions(conditionsStr string, data map[string]interface{}) bool {
	if conditionsStr == "" {
		return true
	}

	// Try JSON array of condition expressions
	var exprs []jsonCondition
	if err := json.Unmarshal([]byte(conditionsStr), &exprs); err == nil && len(exprs) > 0 {
		return s.evaluateJSONConditions(exprs, data)
	}

	// Legacy fallback: flat "key=value" pairs
	pairs := strings.Split(conditionsStr, ",")
	for _, pair := range pairs {
		pair = strings.TrimSpace(pair)
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			expectedVal := strings.TrimSpace(parts[1])
			actualVal, ok := data[key]
			if !ok || fmt.Sprintf("%v", actualVal) != expectedVal {
				return false
			}
		}
	}
	return len(pairs) > 0
}

// jsonCondition is the JSON wire format for condition expressions within rules.
type jsonCondition struct {
	Field     string `json:"field"`
	Operator  string `json:"operator"`
	Value     string `json:"value"`
	ValueType string `json:"value_type,omitempty"`
}

func (s *RuleEngineService) evaluateJSONConditions(exprs []jsonCondition, data map[string]interface{}) bool {
	if s.cond == nil {
		// Fallback to simple equality when no condition engine wired
		for _, expr := range exprs {
			if expr.Operator != "=" && expr.Operator != "==" {
				s.logger.Warn("condition engine not available, falling back to simple equality",
					zap.String("operator", expr.Operator))
				return false
			}
			actualVal, ok := data[expr.Field]
			if !ok || fmt.Sprintf("%v", actualVal) != expr.Value {
				return false
			}
		}
		return true
	}
	for _, expr := range exprs {
		exprModel := &condition_models.ConditionExpression{
			Field:     expr.Field,
			Operator:  expr.Operator,
			Value:     expr.Value,
			ValueType: expr.Value,
			Enabled:   true,
		}
		if expr.ValueType != "" {
			exprModel.ValueType = expr.ValueType
		}
		ok, err := s.cond.EvaluateExpression(exprModel, data)
		if err != nil {
			s.logger.Warn("condition evaluation failed",
				zap.String("field", expr.Field),
				zap.String("operator", expr.Operator),
				zap.Error(err))
			return false
		}
		if !ok {
			return false
		}
	}
	return true
}

// evaluateActions executes rule actions.
func (s *RuleEngineService) evaluateActions(actionsStr string, data map[string]interface{}) []interface{} {
	var actions []interface{}
	actionsList := strings.Split(actionsStr, ",")

	for _, action := range actionsList {
		action = strings.TrimSpace(action)
		if !strings.HasPrefix(action, "[") && !strings.HasPrefix(action, "{") {
			actions = append(actions, map[string]string{
				"type":      action,
				"status":    "executed",
				"timestamp": time.Now().Format(time.RFC3339),
			})
		}
	}
	return actions
}

// QueryRules returns all rules for a tenant.
func (s *RuleEngineService) QueryRules(ctx context.Context, tenantID string) (models.RuleResponse, error) {
	rules, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return models.RuleResponse{}, err
	}
	return models.RuleResponse{Data: rules, Total: int64(len(rules))}, nil
}

// GetRule returns a rule by ID.
func (s *RuleEngineService) GetRule(ctx context.Context, tenantID, id string) (*models.Rule, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// UpdateRule updates a rule.
func (s *RuleEngineService) UpdateRule(ctx context.Context, tenantID, id string, name, description *string, priority *int, isEnabled *bool) (*models.Rule, error) {
	updates := map[string]interface{}{}
	if name != nil {
		updates["name"] = *name
	}
	if description != nil {
		updates["description"] = *description
	}
	if priority != nil {
		updates["priority"] = *priority
	}
	if isEnabled != nil {
		updates["is_enabled"] = *isEnabled
	}

	rule, err := s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		return nil, err
	}

	s.logger.Info("rule updated",
		zap.String("ruleId", id),
	)
	return rule, nil
}

// DeleteRule removes a rule.
func (s *RuleEngineService) DeleteRule(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return err
	}
	s.logger.Info("rule deleted", zap.String("ruleId", id))
	return nil
}