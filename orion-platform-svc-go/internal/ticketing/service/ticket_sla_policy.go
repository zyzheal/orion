package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
)

// --- SLA Policies ---

func (s *Service) CreateSLAPolicy(ctx context.Context, tenantID string, req models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	return s.repo.CreateSLAPolicy(ctx, tenantID, req)
}

func (s *Service) ListSLAPolicies(ctx context.Context, tenantID string) ([]models.SLAPolicy, error) {
	return s.repo.ListSLAPolicies(ctx, tenantID)
}

// 655_create_ticketing_missing_tables.sql declares ticketing_sla_policies.id
// and ticketing_automation_rules.id as UUID PRIMARY KEY, so the route parameter
// is already the identifier. These methods used to strconv.Atoi it first and
// reject every non-numeric id with "invalid policy id" before the query ran,
// which made every SLA policy read, update, delete and compliance call a hard
// 400 for the ids the database actually holds.
func (s *Service) GetSLAPolicy(ctx context.Context, tenantID string, policyID string) (*models.SLAPolicy, error) {
	return s.repo.GetSLAPolicy(ctx, tenantID, policyID)
}

func (s *Service) UpdateSLAPolicy(ctx context.Context, tenantID string, policyID string, req models.UpdateSLAPolicyRequest) (*models.SLAPolicy, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.ResponseH != nil {
		updates["response_hours"] = *req.ResponseH
	}
	if req.ResolveH != nil {
		updates["resolve_hours"] = *req.ResolveH
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if err := s.repo.UpdateSLAPolicy(ctx, tenantID, policyID, updates); err != nil {
		return nil, err
	}
	return s.repo.GetSLAPolicy(ctx, tenantID, policyID)
}

func (s *Service) DeleteSLAPolicy(ctx context.Context, tenantID string, policyID string) error {
	return s.repo.DeleteSLAPolicy(ctx, tenantID, policyID)
}

// GetTicketSLAStatus answers GET /ticketing/sla/tickets/:ticketId/status. It
// delegates to GetTicketSLA instead of re-reading ticket_sla_tracking: that
// table has no response-window column (245_ticketing_schema_fixes.sql created
// it without one), so a repository-side computation would have to duplicate
// defaultSLATargets and drift from the stored window again -- the same defect
// slaTargetsFor was introduced to remove. The previous body was a connectivity
// check that returned a struct with only ticket_id set, so every SLA field on
// the route read as zero.
func (s *Service) GetTicketSLAStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	return s.GetTicketSLA(ctx, tenantID, ticketID)
}

func (s *Service) GetBreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error) {
	return s.repo.GetSLABreaches(ctx, tenantID)
}

func (s *Service) GetCompliance(ctx context.Context, tenantID string, policyID string) (*models.ComplianceResult, error) {
	return s.repo.GetSLACompliance(ctx, tenantID, policyID)
}

// --- Automation Rules ---

func (s *Service) CreateAutomationRule(ctx context.Context, tenantID string, req models.CreateAutomationRuleRequest) (*models.AutomationRule, error) {
	return s.repo.CreateAutomationRule(ctx, tenantID, req)
}

func (s *Service) ListAutomationRules(ctx context.Context, tenantID string) ([]models.AutomationRule, error) {
	return s.repo.ListAutomationRules(ctx, tenantID)
}

func (s *Service) UpdateAutomationRule(ctx context.Context, tenantID string, ruleID string, req models.UpdateAutomationRuleRequest) (*models.AutomationRule, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Trigger != nil {
		updates["trigger"] = *req.Trigger
	}
	if req.Condition != nil {
		updates["condition"] = *req.Condition
	}
	if req.Action != nil {
		updates["action"] = *req.Action
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := s.repo.UpdateAutomationRule(ctx, tenantID, ruleID, updates); err != nil {
		return nil, err
	}
	// Fetch updated rule
	rules, err := s.repo.ListAutomationRules(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	for _, r := range rules {
		if r.ID == ruleID {
			return &r, nil
		}
	}
	return nil, ErrNotFoundRule(ruleID)
}

func (s *Service) DeleteAutomationRule(ctx context.Context, tenantID string, ruleID string) error {
	return s.repo.DeleteAutomationRule(ctx, tenantID, ruleID)
}

// ExecuteRule evaluates an automation rule against active tickets and returns
// the set of tickets that match the trigger/condition. Mirrors TS AutomationRuleService.
func (s *Service) ExecuteRule(ctx context.Context, tenantID string, ruleID string) (*models.ExecuteRuleResult, error) {
	rules, err := s.repo.ListAutomationRules(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var rule *models.AutomationRule
	for i := range rules {
		if rules[i].ID == ruleID {
			rule = &rules[i]
			break
		}
	}
	if rule == nil || !rule.Enabled {
		return &models.ExecuteRuleResult{RuleID: "", Executed: false, Message: "rule not found or disabled"}, nil
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	matched := 0
	for _, t := range tickets {
		triggerMatch := true
		switch rule.Trigger {
		case "on_create":
			if time.Since(t.CreatedAt) > time.Hour {
				triggerMatch = false
			}
		case "on_assign":
			triggerMatch = t.AssigneeID != nil
		case "on_resolve":
			triggerMatch = t.Status == "resolved"
		case "on_escalate":
			triggerMatch = t.Priority == "critical"
		}
		if triggerMatch {
			matched++
		}
	}
	return &models.ExecuteRuleResult{
		RuleID:   rule.ID,
		Executed: true,
		Message:  fmt.Sprintf("rule %s matched %d tickets (action: %s)", rule.Name, matched, rule.Action),
	}, nil
}
