package service

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"time"

	"orion/platform-svc-go/internal/alert-escalation/models"
)

type RepositoryInterface interface {
	CreatePolicy(ctx context.Context, p *models.EscalationPolicy) error
	GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error)
	UpdatePolicy(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationPolicy, error)
	DeletePolicy(ctx context.Context, id, tenantID string) (bool, error)

	CreateTrigger(ctx context.Context, t *models.EscalationTrigger) error
	ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error)
	UpdateTrigger(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationTrigger, error)

	CreateClosure(ctx context.Context, c *models.AlertClosure) error
	GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error)
	ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error)
	UpdateClosure(ctx context.Context, alertID, tenantID string, attrs map[string]interface{}) (*models.AlertClosure, error)

	CreateMetrics(ctx context.Context, m *models.AlertMetrics) error
	ListMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Escalation Policy CRUD ---

func (s *Service) CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, operator string) (*models.EscalationPolicy, error) {
	rulesJSON, _ := json.Marshal(req.Rules)
	p := &models.EscalationPolicy{
		ID:          generateID("ep"),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Severity:    req.Severity,
		Status:      "active",
		Rules:       string(rulesJSON),
		CreatedBy:   operator,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		RulesList:   req.Rules,
	}
	if p.Severity == "" {
		p.Severity = "all"
	}
	if err := s.repo.CreatePolicy(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error) {
	p, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if p.Rules != "" {
		json.Unmarshal([]byte(p.Rules), &p.RulesList)
	}
	return p, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error) {
	policies, err := s.repo.ListPolicies(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if policies == nil {
		return []models.EscalationPolicy{}, nil
	}
	for i := range policies {
		if policies[i].Rules != "" {
			json.Unmarshal([]byte(policies[i].Rules), &policies[i].RulesList)
		}
	}
	return policies, nil
}

func (s *Service) UpdatePolicy(ctx context.Context, id, tenantID string, req *models.UpdatePolicyRequest) (*models.EscalationPolicy, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	if req.Description != nil {
		attrs["description"] = *req.Description
	}
	if req.Severity != nil {
		attrs["severity"] = *req.Severity
	}
	if req.Status != nil {
		attrs["status"] = *req.Status
	}
	if req.Rules != nil {
		rulesJSON, _ := json.Marshal(req.Rules)
		attrs["rules"] = string(rulesJSON)
	}
	return s.repo.UpdatePolicy(ctx, id, tenantID, attrs)
}

func (s *Service) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeletePolicy(ctx, id, tenantID)
}

// --- Escalation Trigger ---

func (s *Service) EvaluatePolicy(ctx context.Context, alertID, severity, tenantID string) ([]*models.EscalationTrigger, error) {
	policies, err := s.repo.ListPolicies(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var triggers []*models.EscalationTrigger
	now := time.Now()

	for _, policy := range policies {
		if policy.Status != "active" {
			continue
		}
		if policy.Severity != "all" && policy.Severity != severity {
			continue
		}

		if err := json.Unmarshal([]byte(policy.Rules), &policy.RulesList); err != nil {
			continue
		}

		for _, rule := range policy.RulesList {
			delay := time.Duration(rule.DelayMinutes) * time.Minute
			t := &models.EscalationTrigger{
				ID:          generateID("et"),
				TenantID:    tenantID,
				PolicyID:    policy.ID,
				AlertID:     alertID,
				Level:       rule.Level,
				Target:      rule.Target,
				Channel:     rule.Channel,
				Message:     fmt.Sprintf("[%s] 告警升级 - Level %d: %s", policy.Name, rule.Level, rule.Message),
				TriggeredAt: now.Add(delay),
				Status:      "pending",
			}
			if err := s.repo.CreateTrigger(ctx, t); err != nil {
				continue
			}
			triggers = append(triggers, t)
		}
	}

	return triggers, nil
}

func (s *Service) ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error) {
	triggers, err := s.repo.ListTriggers(ctx, tenantID, policyID)
	if err != nil {
		return nil, err
	}
	if triggers == nil {
		return []models.EscalationTrigger{}, nil
	}
	return triggers, nil
}

func (s *Service) ResolveTrigger(ctx context.Context, id, tenantID string) (*models.EscalationTrigger, error) {
	now := time.Now()
	return s.repo.UpdateTrigger(ctx, id, tenantID, map[string]interface{}{
		"status":      "resolved",
		"resolved_at": &now,
	})
}

// --- Alert Closure ---

func (s *Service) CreateAlertClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	c := &models.AlertClosure{
		ID:        generateID("ac"),
		TenantID:  tenantID,
		AlertID:   alertID,
		Status:    "open",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.repo.CreateClosure(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) AcknowledgeAlert(ctx context.Context, alertID, tenantID, operator string) (*models.AlertClosure, error) {
	c, err := s.repo.GetClosure(ctx, alertID, tenantID)
	if err != nil {
		c = &models.AlertClosure{
			ID:        generateID("ac"),
			TenantID:  tenantID,
			AlertID:   alertID,
			Status:    "acknowledged",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		now := time.Now()
		c.AcknowledgedAt = &now
		c.AcknowledgedBy = operator
		if err := s.repo.CreateClosure(ctx, c); err != nil {
			return nil, err
		}
	} else {
		now := time.Now()
		c.AcknowledgedAt = &now
		c.AcknowledgedBy = operator
		if c.Status == "open" {
			c.Status = "acknowledged"
		}
		c.UpdatedAt = now
		_, err = s.repo.UpdateClosure(ctx, alertID, tenantID, map[string]interface{}{
			"status":          "acknowledged",
			"acknowledged_by": operator,
			"acknowledged_at": &now,
		})
		if err != nil {
			return nil, err
		}
		c.Status = "acknowledged"
	}
	return c, nil
}

func (s *Service) ResolveAlert(ctx context.Context, req *models.ResolveRequest, tenantID string) (*models.AlertClosure, error) {
	c, err := s.repo.GetClosure(ctx, req.AlertID, tenantID)
	if err != nil {
		c = &models.AlertClosure{
			ID:        generateID("ac"),
			TenantID:  tenantID,
			AlertID:   req.AlertID,
			Status:    "resolved",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		now := time.Now()
		c.ResolvedAt = &now
		c.ResolvedBy = req.Operator
		c.ResolutionNote = req.ResolutionNote
		c.MTTRSeconds = int64(now.Sub(c.CreatedAt).Seconds())
		if err := s.repo.CreateClosure(ctx, c); err != nil {
			return nil, err
		}
	} else {
		now := time.Now()
		c.ResolvedAt = &now
		c.ResolvedBy = req.Operator
		c.ResolutionNote = req.ResolutionNote
		if c.AcknowledgedAt != nil {
			c.MTTRSeconds = int64(now.Sub(*c.AcknowledgedAt).Seconds())
		} else {
			c.MTTRSeconds = int64(now.Sub(c.CreatedAt).Seconds())
		}
		c.Status = "resolved"
		c.UpdatedAt = now
		_, err = s.repo.UpdateClosure(ctx, req.AlertID, tenantID, map[string]interface{}{
			"status":          "resolved",
			"resolved_by":     req.Operator,
			"resolved_at":     &now,
			"resolution_note": req.ResolutionNote,
			"mttr_seconds":    c.MTTRSeconds,
		})
		if err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *Service) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	return s.repo.GetClosure(ctx, alertID, tenantID)
}

func (s *Service) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
	closures, err := s.repo.ListClosures(ctx, tenantID, status)
	if err != nil {
		return nil, err
	}
	if closures == nil {
		return []models.AlertClosure{}, nil
	}
	return closures, nil
}

// --- Alert Metrics ---

func (s *Service) GetMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error) {
	metrics, err := s.repo.ListMetrics(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}
	if metrics == nil {
		return []models.AlertMetrics{}, nil
	}
	return metrics, nil
}

func (s *Service) RecordMetric(ctx context.Context, tenantID string, day time.Time, stats map[string]interface{}) error {
	m := &models.AlertMetrics{
		ID:         generateID("am"),
		TenantID:   tenantID,
		MetricDate: day,
		CreatedAt:  time.Now(),
	}
	if v, ok := stats["totalAlerts"]; ok {
		if i, ok := v.(float64); ok {
			m.TotalAlerts = int(i)
		}
	}
	if v, ok := stats["acknowledgedCount"]; ok {
		if i, ok := v.(float64); ok {
			m.AcknowledgedCount = int(i)
		}
	}
	if v, ok := stats["resolvedCount"]; ok {
		if i, ok := v.(float64); ok {
			m.ResolvedCount = int(i)
		}
	}
	if v, ok := stats["escalatedCount"]; ok {
		if i, ok := v.(float64); ok {
			m.EscalatedCount = int(i)
		}
	}
	if v, ok := stats["avgResponseSeconds"]; ok {
		if i, ok := v.(float64); ok {
			m.AvgResponseSeconds = int64(i)
		}
	}
	if v, ok := stats["avgResolutionSeconds"]; ok {
		if i, ok := v.(float64); ok {
			m.AvgResolutionSeconds = int64(i)
		}
	}
	if v, ok := stats["slaBreachCount"]; ok {
		if i, ok := v.(float64); ok {
			m.SLABreachCount = int(i)
		}
	}
	if v, ok := stats["autoRemediationSuccess"]; ok {
		if i, ok := v.(float64); ok {
			m.AutoRemediationSuccess = int(i)
		}
	}
	if v, ok := stats["autoRemediationFailed"]; ok {
		if i, ok := v.(float64); ok {
			m.AutoRemediationFailed = int(i)
		}
	}
	return s.repo.CreateMetrics(ctx, m)
}

func generateID(prefix string) string {
	h := fnv.New64a()
	h.Write([]byte(prefix + "-" + time.Now().Format("20060102150405") + "-" + fmt.Sprintf("%d", time.Now().UnixNano()%100000)))
	return fmt.Sprintf("%s-%x", prefix, h.Sum(nil)[:8])
}
