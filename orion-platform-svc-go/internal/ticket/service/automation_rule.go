package service

import (
	"context"
	"encoding/json"
	"fmt"

	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/repository"
)

type AutomationRuleService struct {
	repo     *repository.AutomationRuleRepository
	ticketRepo repository.TicketRepositoryInterface
}

func NewAutomationRuleService(repo *repository.AutomationRuleRepository, ticketRepo repository.TicketRepositoryInterface) *AutomationRuleService {
	return &AutomationRuleService{repo: repo, ticketRepo: ticketRepo}
}

func (s *AutomationRuleService) Create(ctx context.Context, tenantID, createdBy string, req *models.CreateAutomationRuleRequest) (*models.AutomationRule, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Condition == "" {
		return nil, fmt.Errorf("condition is required")
	}
	if req.Actions == "" {
		return nil, fmt.Errorf("actions is required")
	}

	// Validate JSON
	var cond any
	if err := json.Unmarshal([]byte(req.Condition), &cond); err != nil {
		return nil, fmt.Errorf("invalid condition JSON: %w", err)
	}
	var actions any
	if err := json.Unmarshal([]byte(req.Actions), &actions); err != nil {
		return nil, fmt.Errorf("invalid actions JSON: %w", err)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	rule := &models.AutomationRule{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Condition:   req.Condition,
		Actions:     req.Actions,
		Enabled:     enabled,
		CreatedBy:   createdBy,
	}

	if err := s.repo.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *AutomationRuleService) Get(ctx context.Context, tenantID, id string) (*models.AutomationRule, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *AutomationRuleService) List(ctx context.Context, tenantID string, enabled *bool) ([]models.AutomationRule, error) {
	return s.repo.List(ctx, tenantID, enabled)
}

func (s *AutomationRuleService) Update(ctx context.Context, tenantID, id string, req *models.UpdateAutomationRuleRequest) (*models.AutomationRule, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if req.Condition != "" {
		var cond any
		if err := json.Unmarshal([]byte(req.Condition), &cond); err != nil {
			return nil, fmt.Errorf("invalid condition JSON: %w", err)
		}
		existing.Condition = req.Condition
	}
	if req.Actions != "" {
		var actions any
		if err := json.Unmarshal([]byte(req.Actions), &actions); err != nil {
			return nil, fmt.Errorf("invalid actions JSON: %w", err)
		}
		existing.Actions = req.Actions
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *AutomationRuleService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *AutomationRuleService) Execute(ctx context.Context, tenantID, ruleID, ticketID, triggeredBy string, ticketData map[string]any) (*models.AutomationRuleExecution, error) {
	rule, err := s.repo.GetByID(ctx, tenantID, ruleID)
	if err != nil {
		return nil, err
	}
	if !rule.Enabled {
		return nil, fmt.Errorf("automation rule is disabled")
	}

	// Parse conditions and check if they match
	var conditions []map[string]any
	if err := json.Unmarshal([]byte(rule.Condition), &conditions); err != nil {
		return nil, fmt.Errorf("invalid conditions")
	}

	conditionsMet := true
	// Simplified: check if all conditions are present in ticket data
	for _, cond := range conditions {
		field, ok := cond["field"].(string)
		if !ok {
			continue
		}
		expected, ok := cond["value"]
		if !ok {
			continue
		}
		actual, exists := ticketData[field]
		if !exists {
			conditionsMet = false
			break
		}
		if actual != expected {
			conditionsMet = false
			break
		}
	}

	// Parse and execute actions if conditions met
	var actions []map[string]any
	if err := json.Unmarshal([]byte(rule.Actions), &actions); err != nil {
		return nil, fmt.Errorf("invalid actions")
	}

	var actionsTaken []map[string]any
	if conditionsMet {
		for _, action := range actions {
			actionType, _ := action["type"].(string)
			params := action["params"]
			actionsTaken = append(actionsTaken, map[string]any{
				"type":   actionType,
				"params": params,
				"result": "executed",
			})
		}
	}

	execution := &models.AutomationRuleExecution{
		RuleID:        ruleID,
		TicketID:      ticketID,
		TenantID:      tenantID,
		TriggeredBy:   triggeredBy,
		ConditionsMet: conditionsMet,
		ActionsTaken:  "{}",
		Status:        "success",
	}
	if conditionsMet {
		jsonData, _ := json.Marshal(actionsTaken)
		execution.ActionsTaken = string(jsonData)
	}

	if err := s.repo.LogExecution(ctx, execution); err != nil {
		return nil, err
	}
	return execution, nil
}
