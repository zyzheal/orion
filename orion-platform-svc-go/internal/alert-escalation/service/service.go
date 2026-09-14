package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/alert-escalation/models"
)

// ErrEmptyUpdate is returned when an update request names no field to write.
// The request used to reach Postgres as "UPDATE escalation_policy SET  WHERE
// ...", which is a syntax error the handler reported to the caller as
// "policy not found".
var ErrEmptyUpdate = errors.New("no fields to update")

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
	rulesJSON, err := json.Marshal(req.Rules)
	if err != nil {
		return nil, fmt.Errorf("encoding escalation rules: %w", err)
	}
	p := &models.EscalationPolicy{
		ID:          generateID(),
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
	if p == nil {
		// A repository that answers nil without an error would panic the handler
		// at p.Rules instead of returning a 404.
		return nil, sql.ErrNoRows
	}
	if p.Rules != "" {
		// The error used to be discarded, so a corrupt rules column made GET
		// /policies/:id answer 200 with an empty rules list for a policy that
		// actually had rules.
		if err := json.Unmarshal([]byte(p.Rules), &p.RulesList); err != nil {
			return nil, fmt.Errorf("decoding rules of policy %s: %w", p.ID, err)
		}
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
		if policies[i].Rules == "" {
			continue
		}
		// Same discarded error as GetPolicy: one bad row used to leave that
		// policy with an empty rules list while the rest of the response looked
		// normal.
		if err := json.Unmarshal([]byte(policies[i].Rules), &policies[i].RulesList); err != nil {
			return nil, fmt.Errorf("decoding rules of policy %s: %w", policies[i].ID, err)
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
		rulesJSON, err := json.Marshal(req.Rules)
		if err != nil {
			return nil, fmt.Errorf("encoding escalation rules: %w", err)
		}
		attrs["rules"] = string(rulesJSON)
	}
	if len(attrs) == 0 {
		return nil, ErrEmptyUpdate
	}
	attrs["updated_at"] = time.Now()
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

		if policy.Rules != "" {
			if err := json.Unmarshal([]byte(policy.Rules), &policy.RulesList); err != nil {
				// Skipping the policy meant an alert that should have escalated
				// did not, with nothing left to say why.
				return nil, fmt.Errorf("decoding rules of policy %s: %w", policy.ID, err)
			}
		}

		for _, rule := range policy.RulesList {
			delay := time.Duration(rule.DelayMinutes) * time.Minute
			t := &models.EscalationTrigger{
				ID:          generateID(),
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
				// A failed insert used to be skipped, so the endpoint reported
				// success with fewer escalations than the policy asked for.
				return nil, fmt.Errorf("creating escalation trigger for policy %s: %w", policy.ID, err)
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
	now := time.Now()
	c := &models.AlertClosure{
		ID:        generateID(),
		TenantID:  tenantID,
		AlertID:   alertID,
		Status:    "open",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.CreateClosure(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) AcknowledgeAlert(ctx context.Context, alertID, tenantID, operator string) (*models.AlertClosure, error) {
	c, err := s.repo.GetClosure(ctx, alertID, tenantID)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			// Anything other than "no closure yet" is a database failure. The old
			// code treated it as not-found and wrote a second row for an alert
			// that already had one, and alert_closure has no unique constraint on
			// alert_id to stop that.
			return nil, fmt.Errorf("reading closure of alert %s: %w", alertID, err)
		}
		now := time.Now()
		c = &models.AlertClosure{
			ID:             generateID(),
			TenantID:       tenantID,
			AlertID:        alertID,
			Status:         "acknowledged",
			AcknowledgedBy: operator,
			AcknowledgedAt: &now,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := s.repo.CreateClosure(ctx, c); err != nil {
			return nil, err
		}
		return c, nil
	}

	now := time.Now()
	c.AcknowledgedAt = &now
	c.AcknowledgedBy = operator
	c.UpdatedAt = now
	attrs := map[string]interface{}{
		"acknowledged_by": operator,
		"acknowledged_at": &now,
		"updated_at":      now,
	}
	if c.Status == "open" {
		// An already-resolved closure used to be written back as acknowledged,
		// so acknowledging an alert twice after resolution un-resolved it.
		c.Status = "acknowledged"
		attrs["status"] = "acknowledged"
	}
	return s.repo.UpdateClosure(ctx, alertID, tenantID, attrs)
}

func (s *Service) ResolveAlert(ctx context.Context, req *models.ResolveRequest, tenantID string) (*models.AlertClosure, error) {
	c, err := s.repo.GetClosure(ctx, req.AlertID, tenantID)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("reading closure of alert %s: %w", req.AlertID, err)
		}
		now := time.Now()
		c = &models.AlertClosure{
			ID:             generateID(),
			TenantID:       tenantID,
			AlertID:        req.AlertID,
			Status:         "resolved",
			ResolvedBy:     req.Operator,
			ResolvedAt:     &now,
			ResolutionNote: req.ResolutionNote,
			MTTRSeconds:    0,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := s.repo.CreateClosure(ctx, c); err != nil {
			return nil, err
		}
		return c, nil
	}

	now := time.Now()
	c.ResolvedAt = &now
	c.ResolvedBy = req.Operator
	c.ResolutionNote = req.ResolutionNote
	if c.AcknowledgedAt != nil {
		c.MTTRSeconds = int64(now.Sub(*c.AcknowledgedAt).Seconds())
	} else {
		c.MTTRSeconds = int64(now.Sub(c.CreatedAt).Seconds())
	}
	if c.MTTRSeconds < 0 {
		// A stored acknowledged_at in the future would otherwise persist a
		// negative MTTR that the metrics endpoint averages in.
		c.MTTRSeconds = 0
	}
	c.Status = "resolved"
	c.UpdatedAt = now
	return s.repo.UpdateClosure(ctx, req.AlertID, tenantID, map[string]interface{}{
		"status":          "resolved",
		"resolved_by":     req.Operator,
		"resolved_at":     &now,
		"resolution_note": req.ResolutionNote,
		"mttr_seconds":    c.MTTRSeconds,
		"updated_at":      now,
	})
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

// metricBindings is the whole set of numeric columns alert_metrics has a column
// for. p95ResponseSeconds and p95ResolutionSeconds were missing from the old
// per-key if-chain, so those two values were dropped while the columns stayed at
// their default of 0.
var metricBindings = []struct {
	key   string
	apply func(m *models.AlertMetrics, v int64)
}{
	{"totalAlerts", func(m *models.AlertMetrics, v int64) { m.TotalAlerts = int(v) }},
	{"acknowledgedCount", func(m *models.AlertMetrics, v int64) { m.AcknowledgedCount = int(v) }},
	{"resolvedCount", func(m *models.AlertMetrics, v int64) { m.ResolvedCount = int(v) }},
	{"escalatedCount", func(m *models.AlertMetrics, v int64) { m.EscalatedCount = int(v) }},
	{"avgResponseSeconds", func(m *models.AlertMetrics, v int64) { m.AvgResponseSeconds = v }},
	{"avgResolutionSeconds", func(m *models.AlertMetrics, v int64) { m.AvgResolutionSeconds = v }},
	{"p95ResponseSeconds", func(m *models.AlertMetrics, v int64) { m.P95ResponseSeconds = v }},
	{"p95ResolutionSeconds", func(m *models.AlertMetrics, v int64) { m.P95ResolutionSeconds = v }},
	{"slaBreachCount", func(m *models.AlertMetrics, v int64) { m.SLABreachCount = int(v) }},
	{"autoRemediationSuccess", func(m *models.AlertMetrics, v int64) { m.AutoRemediationSuccess = int(v) }},
	{"autoRemediationFailed", func(m *models.AlertMetrics, v int64) { m.AutoRemediationFailed = int(v) }},
}

func (s *Service) RecordMetric(ctx context.Context, tenantID string, day time.Time, stats map[string]interface{}) error {
	m := &models.AlertMetrics{
		ID:         generateID(),
		TenantID:   tenantID,
		MetricDate: day,
		CreatedAt:  time.Now(),
	}
	for _, b := range metricBindings {
		raw, ok := stats[b.key]
		if !ok {
			continue
		}
		if n, ok := toInt64(raw); ok {
			b.apply(m, n)
		}
	}
	return s.repo.CreateMetrics(ctx, m)
}

// toInt64 accepts the shapes a stat map can actually hold: float64 from JSON,
// int and int64 from a caller that builds the map in Go. The old code matched
// only float64, so a Go-built map silently recorded 0 for every counter.
func toInt64(v interface{}) (int64, bool) {
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case float32:
		return int64(n), true
	case int:
		return int64(n), true
	case int64:
		return n, true
	case int32:
		return int64(n), true
	case int16:
		return int64(n), true
	case int8:
		return int64(n), true
	case uint:
		return int64(n), true
	case uint64:
		return int64(n), true
	case bool:
		if n {
			return 1, true
		}
		return 0, true
	}
	return 0, false
}

// generateID returns a random UUID. The previous implementation hashed a
// second-granularity timestamp with UnixNano%100000 into an 8-hex-character
// digest, so two concurrent escalations could produce the same id and one of
// them would die on the primary key.
func generateID() string {
	return uuid.NewString()
}
