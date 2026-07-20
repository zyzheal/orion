package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/monitoring/models"
)

// --- Alert Rules ----------------------------------------------------

func (s *Service) CreateRule(ctx context.Context, tenantID string, req models.CreateRuleRequest) (*models.AlertRule, error) {
	rule := &models.AlertRule{
		TenantID:         tenantID,
		Name:             req.Name,
		Metric:           req.Metric,
		Operator:         req.Operator,
		Threshold:        req.Threshold,
		EvaluationPeriod: req.EvaluationPeriod,
		Severity:         req.Severity,
		Channels:         req.Channels,
		Enabled:          true,
		Active:           true,
	}
	if rule.Operator == "" {
		rule.Operator = "gt"
	}
	if rule.Severity == "" {
		rule.Severity = "warning"
	}
	if rule.EvaluationPeriod <= 0 {
		rule.EvaluationPeriod = 60 // default 60s
	}
	if err := s.repo.CreateRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) GetRules(ctx context.Context, tenantID string, limit, offset int) ([]models.AlertRule, error) {
	return s.repo.ListRules(ctx, tenantID, limit, offset)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, req models.UpdateRuleRequest) (*models.AlertRule, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Metric != nil {
		updates["metric"] = *req.Metric
	}
	if req.Operator != nil {
		updates["operator"] = *req.Operator
	}
	if req.Threshold != nil {
		updates["threshold"] = *req.Threshold
	}
	if req.EvaluationPeriod != nil {
		updates["evaluation_period"] = *req.EvaluationPeriod
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Channels != nil {
		updates["channels"] = *req.Channels
	}
	if err := s.repo.UpdateRule(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRule(ctx, tenantID, id)
}

func (s *Service) ToggleRule(ctx context.Context, tenantID, id string, enabled bool) (*models.AlertRule, error) {
	if err := s.repo.ToggleRule(ctx, tenantID, id, enabled); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) SuppressRule(ctx context.Context, tenantID, id string, req models.SuppressRuleRequest) (*models.AlertRule, error) {
	if err := s.repo.SuppressRule(ctx, tenantID, id, req.Reason, req.DurationH); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) UnsuppressRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	if err := s.repo.UnsuppressRule(ctx, tenantID, id); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

// EvaluateRules runs the rule-evaluation engine.
//
// For every rule (or all enabled rules when ruleIDs is empty) the latest metric
// value is compared against the rule's threshold using the configured operator.
// When a rule fires, a new Alert is persisted.
//
// Returns one result entry per evaluated rule with fields:
//   - "rule_id", "rule_name", "metric", "current_value", "threshold"
//   - "status": "fired", "ok" or "skipped"
//   - "alert_id" (when fired)
//   - "message"
func (s *Service) EvaluateRules(ctx context.Context, tenantID string, ruleIDs []string) ([]map[string]interface{}, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}

	rules, err := s.repo.ListRules(ctx, tenantID, 500, 0)
	if err != nil {
		return nil, fmt.Errorf("evaluate rules: list rules: %w", err)
	}

	// Build a lookup so callers can restrict evaluation to a subset.
	ruleFilter := make(map[string]struct{})
	for _, rid := range ruleIDs {
		ruleFilter[rid] = struct{}{}
	}

	var results []map[string]interface{}
	for _, rule := range rules {
		if len(ruleFilter) > 0 {
			if _, ok := ruleFilter[rule.ID]; !ok {
				// Rule not in the requested subset.
				// Skip.
				_ = rule.ID
				continue
			}
		}
		results = append(results, s.evaluateSingleRule(ctx, tenantID, &rule))
	}

	return results, nil
}

// evaluateSingleRule evaluates one rule and returns a result map.
func (s *Service) evaluateSingleRule(ctx context.Context, tenantID string, rule *models.AlertRule) map[string]interface{} {
	res := map[string]interface{}{
		"rule_id":       rule.ID,
		"rule_name":     rule.Name,
		"metric":        rule.Metric,
		"threshold":     rule.Threshold,
		"operator":      rule.Operator,
		"severity":      rule.Severity,
		"status":        "ok",
		"current_value": nil,
		"message":       "rule evaluated",
	}

	if !rule.Enabled {
		res["status"] = "skipped"
		res["message"] = "rule is disabled"
		return res
	}
	if !rule.Active {
		res["status"] = "skipped"
		res["message"] = "rule is suppressed"
		return res
	}

	// Fetch the latest data point for the rule's metric.
	series, err := s.repo.GetMetricSeries(ctx, tenantID, rule.Metric, nil, nil, 1)
	if err != nil || len(series) == 0 {
		res["status"] = "skipped"
		if err != nil {
			res["message"] = fmt.Sprintf("failed to fetch metric data: %s", err.Error())
		} else {
			res["message"] = "no metric data available"
		}
		return res
	}
	currentValue := series[0].Value
	res["current_value"] = currentValue

	// Compare value against threshold using the configured operator.
	fired := compare(currentValue, rule.Operator, rule.Threshold)
	if !fired {
		res["message"] = fmt.Sprintf("%g %s %g: ok", currentValue, rule.Operator, rule.Threshold)
		return res
	}

	// Fire alert.
	alert := &models.Alert{
		TenantID: tenantID,
		RuleID:   rule.ID,
		Status:   "firing",
		Message:  fmt.Sprintf("%s: %g %s threshold %g", rule.Name, currentValue, rule.Operator, rule.Threshold),
		Value:    currentValue,
		Severity: rule.Severity,
	}
	if err := s.repo.CreateAlert(ctx, alert); err != nil {
		// Non-fatal: one metric failing does not abort the batch.
		_ = err
	}

	return res
}
