package service

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-escalation/models"
)

// --- Fake Repository ---

type fakeAERepo struct {
	policies map[string]*models.EscalationPolicy
	triggers []models.EscalationTrigger
	closures map[string]*models.AlertClosure
	metrics  []models.AlertMetrics

	// The attribute maps the service last sent to the repository. Recording them
	// is what makes the update guards observable: the service is the only layer
	// that can decide which columns an alert may be written into, so a test has
	// to see exactly what it tried to write.
	lastPolicyAttrs  map[string]interface{}
	lastClosureAttrs map[string]interface{}
	lastTriggerAttrs map[string]interface{}
	policyUpdates    int
	closureUpdates   int

	// Error injection, used to prove the service tells "no row" apart from
	// "the database failed".
	closureReadErr    error
	failCreateTrigger bool
	failCreateClosure bool
}

func newFakeAERepo() *fakeAERepo {
	return &fakeAERepo{
		policies: make(map[string]*models.EscalationPolicy),
		closures: make(map[string]*models.AlertClosure),
	}
}

func (f *fakeAERepo) CreatePolicy(ctx context.Context, p *models.EscalationPolicy) error {
	f.policies[p.ID] = p
	return nil
}

func (f *fakeAERepo) GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error) {
	p, ok := f.policies[id]
	if !ok {
		return nil, nil
	}
	return p, nil
}

func (f *fakeAERepo) ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error) {
	var items []models.EscalationPolicy
	for _, p := range f.policies {
		items = append(items, *p)
	}
	return items, nil
}

func (f *fakeAERepo) UpdatePolicy(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationPolicy, error) {
	f.lastPolicyAttrs = attrs
	f.policyUpdates++
	p, ok := f.policies[id]
	if !ok {
		return nil, nil
	}
	if v, ok := attrs["name"]; ok {
		p.Name = v.(string)
	}
	if v, ok := attrs["status"]; ok {
		p.Status = v.(string)
	}
	if v, ok := attrs["rules"]; ok {
		p.Rules = v.(string)
	}
	return p, nil
}

func (f *fakeAERepo) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := f.policies[id]; !ok {
		return false, nil
	}
	delete(f.policies, id)
	return true, nil
}

func (f *fakeAERepo) CreateTrigger(ctx context.Context, t *models.EscalationTrigger) error {
	if f.failCreateTrigger {
		return errors.New("insert failed")
	}
	f.triggers = append(f.triggers, *t)
	return nil
}

func (f *fakeAERepo) ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error) {
	return f.triggers, nil
}

func (f *fakeAERepo) UpdateTrigger(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationTrigger, error) {
	f.lastTriggerAttrs = attrs
	for i, t := range f.triggers {
		if t.ID == id {
			if v, ok := attrs["status"]; ok {
				f.triggers[i].Status = v.(string)
			}
			return &f.triggers[i], nil
		}
	}
	return nil, nil
}

func (f *fakeAERepo) CreateClosure(ctx context.Context, c *models.AlertClosure) error {
	if f.failCreateClosure {
		return errors.New("insert failed")
	}
	f.closures[c.AlertID] = c
	return nil
}

func (f *fakeAERepo) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	if f.closureReadErr != nil {
		return nil, f.closureReadErr
	}
	c, ok := f.closures[alertID]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return c, nil
}

func (f *fakeAERepo) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
	var items []models.AlertClosure
	for _, c := range f.closures {
		if status == "" || c.Status == status {
			items = append(items, *c)
		}
	}
	return items, nil
}

func (f *fakeAERepo) UpdateClosure(ctx context.Context, alertID, tenantID string, attrs map[string]interface{}) (*models.AlertClosure, error) {
	f.lastClosureAttrs = attrs
	f.closureUpdates++
	c, ok := f.closures[alertID]
	if !ok {
		return nil, nil
	}
	if v, ok := attrs["status"]; ok {
		c.Status = v.(string)
	}
	if v, ok := attrs["acknowledged_by"]; ok {
		c.AcknowledgedBy = v.(string)
	}
	if v, ok := attrs["resolved_by"]; ok {
		c.ResolvedBy = v.(string)
	}
	if v, ok := attrs["resolution_note"]; ok {
		c.ResolutionNote = v.(string)
	}
	if v, ok := attrs["mttr_seconds"]; ok {
		c.MTTRSeconds = v.(int64)
	}
	return c, nil
}

func (f *fakeAERepo) CreateMetrics(ctx context.Context, m *models.AlertMetrics) error {
	f.metrics = append(f.metrics, *m)
	return nil
}

func (f *fakeAERepo) ListMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error) {
	return f.metrics, nil
}

// --- Tests ---

func TestAE_CreatePolicy_success(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	req := &models.CreatePolicyRequest{
		Name:     "severe-policy",
		Severity: "critical",
		Rules: []models.EscalationRule{
			{Level: 1, DelayMinutes: 5, Target: "oncall", Channel: "slack", Message: "page"},
		},
	}
	p, err := svc.CreatePolicy(context.Background(), req, "t1", "admin")
	if err != nil {
		t.Fatalf("CreatePolicy error: %v", err)
	}
	if p.Name != "severe-policy" {
		t.Errorf("Name = %q", p.Name)
	}
	if p.Severity != "critical" {
		t.Errorf("Severity = %q, want critical", p.Severity)
	}
	if p.Status != "active" {
		t.Errorf("Status = %q, want active", p.Status)
	}
}

func TestAE_CreatePolicy_defaultsSeverity(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	req := &models.CreatePolicyRequest{
		Name: "default-sev",
		Rules: []models.EscalationRule{
			{Level: 1, DelayMinutes: 0},
		},
	}
	p, err := svc.CreatePolicy(context.Background(), req, "t1", "admin")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if p.Severity != "all" {
		t.Errorf("Severity = %q, want 'all' (default)", p.Severity)
	}
}

func TestAE_EvaluatePolicy_matchesSeverity(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:     "crit-only",
		Severity: "critical",
		Rules: []models.EscalationRule{
			{Level: 1, DelayMinutes: 0, Target: "t1", Channel: "c1", Message: "m1"},
		},
	}, "t1", "admin")

	triggers, err := svc.EvaluatePolicy(context.Background(), "alert-1", "warning", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(triggers) != 0 {
		t.Errorf("EvaluatePolicy(warning) = %d, want 0 (policy is critical-only)", len(triggers))
	}

	triggers, err = svc.EvaluatePolicy(context.Background(), "alert-1", "critical", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(triggers) != 1 {
		t.Errorf("EvaluatePolicy(critical) = %d, want 1", len(triggers))
	}
}

func TestAE_EvaluatePolicy_skipsInactive(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	p, _ := svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:  "inactive",
		Rules: []models.EscalationRule{{Level: 1}},
	}, "t1", "admin")
	// Manually set inactive
	repo.policies[p.ID].Status = "disabled"

	triggers, _ := svc.EvaluatePolicy(context.Background(), "a", "all", "t1")
	if len(triggers) != 0 {
		t.Error("EvaluatePolicy should skip inactive policies")
	}
}

func TestAE_CreateAlertClosure(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	c, err := svc.CreateAlertClosure(context.Background(), "alert-1", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "open" {
		t.Errorf("Status = %q, want open", c.Status)
	}
}

func TestAE_AcknowledgeAlert_createsWhenMissing(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall-user")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "acknowledged" {
		t.Errorf("Status = %q, want acknowledged", c.Status)
	}
	if c.AcknowledgedBy != "oncall-user" {
		t.Errorf("AcknowledgedBy = %q", c.AcknowledgedBy)
	}
}

func TestAE_AcknowledgeAlert_updatesExisting(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	// Create closure first
	svc.CreateAlertClosure(context.Background(), "alert-1", "t1")

	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "acknowledged" {
		t.Errorf("Status = %q, want acknowledged", c.Status)
	}
}

func TestAE_ResolveAlert_computesMTTR(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	c, err := svc.ResolveAlert(context.Background(), &models.ResolveRequest{
		AlertID:        "alert-1",
		Operator:       "fixer",
		ResolutionNote: "restarted service",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "resolved" {
		t.Errorf("Status = %q, want resolved", c.Status)
	}
	if c.ResolvedBy != "fixer" {
		t.Errorf("ResolvedBy = %q", c.ResolvedBy)
	}
	if c.ResolutionNote != "restarted service" {
		t.Errorf("ResolutionNote = %q", c.ResolutionNote)
	}
	if c.MTTRSeconds < 0 {
		t.Errorf("MTTRSeconds = %d, want >= 0", c.MTTRSeconds)
	}
}

var reUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func TestAE_GeneratedIDsAreUUIDs(t *testing.T) {
	// The old id was an 8-hex-character digest of a second-granularity
	// timestamp, so two escalations created in the same second could collide on
	// the primary key. The id column is VARCHAR(36), which fits a UUID.
	repo := newFakeAERepo()
	svc := NewService(repo)
	p, err := svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:  "uuid-pol",
		Rules: []models.EscalationRule{{Level: 1}},
	}, "t1", "admin")
	if err != nil {
		t.Fatalf("CreatePolicy error: %v", err)
	}
	if !reUUID.MatchString(p.ID) {
		t.Fatalf("policy ID %q is not a UUID", p.ID)
	}
	c, err := svc.CreateAlertClosure(context.Background(), "alert-1", "t1")
	if err != nil {
		t.Fatalf("CreateAlertClosure error: %v", err)
	}
	if !reUUID.MatchString(c.ID) {
		t.Fatalf("closure ID %q is not a UUID", c.ID)
	}
	if err := svc.RecordMetric(context.Background(), "t1", time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC), nil); err != nil {
		t.Fatalf("RecordMetric error: %v", err)
	}
	if len(repo.metrics) != 1 {
		t.Fatalf("metrics rows = %d, want 1", len(repo.metrics))
	}
	if !reUUID.MatchString(repo.metrics[0].ID) {
		t.Fatalf("metrics ID %q is not a UUID", repo.metrics[0].ID)
	}
}

func TestAE_GetPolicy_missingRowIsErrNoRows(t *testing.T) {
	svc := NewService(newFakeAERepo())
	p, err := svc.GetPolicy(context.Background(), "no-such-policy", "t1")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("GetPolicy err = %v, want sql.ErrNoRows", err)
	}
	if p != nil {
		t.Fatalf("GetPolicy resp = %v, want nil", p)
	}
}

func TestAE_GetPolicy_corruptRulesIsAnError(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	repo.policies["bad"] = &models.EscalationPolicy{ID: "bad", Name: "bad", Rules: "{not json"}
	p, err := svc.GetPolicy(context.Background(), "bad", "t1")
	if err == nil {
		t.Fatalf("GetPolicy returned no error for a corrupt rules column")
	}
	if p != nil {
		t.Fatalf("GetPolicy resp = %v, want nil", p)
	}
	if !strings.Contains(err.Error(), "decoding rules of policy") {
		t.Errorf("err = %q, want the decoding failure to be named", err)
	}
}

func TestAE_ListPolicies_corruptRulesIsAnError(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	repo.policies["bad"] = &models.EscalationPolicy{ID: "bad", Name: "bad", Rules: "{not json"}
	policies, err := svc.ListPolicies(context.Background(), "t1")
	if err == nil {
		t.Fatalf("ListPolicies returned no error for a corrupt rules column")
	}
	if policies != nil {
		t.Fatalf("ListPolicies resp = %v, want nil", policies)
	}
}

func TestAE_EvaluatePolicy_corruptRulesIsAnError(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	repo.policies["bad"] = &models.EscalationPolicy{
		ID: "bad", Name: "bad", Severity: "all", Status: "active", Rules: "{not json",
	}
	triggers, err := svc.EvaluatePolicy(context.Background(), "alert-1", "critical", "t1")
	if err == nil {
		t.Fatalf("EvaluatePolicy returned no error for a corrupt rules column")
	}
	if triggers != nil {
		t.Fatalf("EvaluatePolicy resp = %v, want nil", triggers)
	}
}

func TestAE_EvaluatePolicy_triggerInsertFailureIsFatal(t *testing.T) {
	repo := newFakeAERepo()
	repo.failCreateTrigger = true
	svc := NewService(repo)
	repo.policies["p1"] = &models.EscalationPolicy{
		ID: "p1", Name: "p1", Severity: "all", Status: "active",
		Rules: `[{"level":1,"target":"t","channel":"c","message":"m"}]`,
	}
	triggers, err := svc.EvaluatePolicy(context.Background(), "alert-1", "critical", "t1")
	if err == nil {
		t.Fatalf("EvaluatePolicy returned no error when the trigger insert failed")
	}
	if triggers != nil {
		t.Fatalf("EvaluatePolicy resp = %v, want nil", triggers)
	}
}

func TestAE_UpdatePolicy_emptyRequestIsErrEmptyUpdate(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	repo.policies["p1"] = &models.EscalationPolicy{ID: "p1", Name: "p1", Status: "active", Rules: "[]"}
	p, err := svc.UpdatePolicy(context.Background(), "p1", "t1", &models.UpdatePolicyRequest{})
	if !errors.Is(err, ErrEmptyUpdate) {
		t.Fatalf("UpdatePolicy err = %v, want ErrEmptyUpdate", err)
	}
	if p != nil {
		t.Fatalf("UpdatePolicy resp = %v, want nil", p)
	}
	if repo.policyUpdates != 0 {
		t.Fatalf("UpdatePolicy reached the repository %d times, want 0", repo.policyUpdates)
	}
}

func TestAE_UpdatePolicy_stampsUpdatedAtAndKeepsIdentityOut(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	repo.policies["p1"] = &models.EscalationPolicy{ID: "p1", Name: "p1", Status: "active", Rules: "[]"}
	name := "renamed"
	if _, err := svc.UpdatePolicy(context.Background(), "p1", "t1", &models.UpdatePolicyRequest{Name: &name}); err != nil {
		t.Fatalf("UpdatePolicy error: %v", err)
	}
	if _, ok := repo.lastPolicyAttrs["updated_at"]; !ok {
		t.Fatalf("UpdatePolicy did not stamp updated_at; attrs = %v", repo.lastPolicyAttrs)
	}
	for _, k := range []string{"id", "tenant_id"} {
		if _, ok := repo.lastPolicyAttrs[k]; ok {
			t.Errorf("UpdatePolicy tried to write the identity column %q", k)
		}
	}
}

func TestAE_ResolveTrigger_writesOnlyDataColumns(t *testing.T) {
	repo := newFakeAERepo()
	repo.triggers = []models.EscalationTrigger{{ID: "et-1", Status: "pending"}}
	svc := NewService(repo)
	tg, err := svc.ResolveTrigger(context.Background(), "et-1", "t1")
	if err != nil {
		t.Fatalf("ResolveTrigger error: %v", err)
	}
	if tg.Status != "resolved" {
		t.Fatalf("Status = %q, want resolved", tg.Status)
	}
	if len(repo.lastTriggerAttrs) != 2 {
		t.Fatalf("ResolveTrigger wrote %d columns, want 2: %v", len(repo.lastTriggerAttrs), repo.lastTriggerAttrs)
	}
	if _, ok := repo.lastTriggerAttrs["status"]; !ok {
		t.Errorf("ResolveTrigger did not write status: %v", repo.lastTriggerAttrs)
	}
	if _, ok := repo.lastTriggerAttrs["resolved_at"]; !ok {
		t.Errorf("ResolveTrigger did not write resolved_at: %v", repo.lastTriggerAttrs)
	}
}

func TestAE_AcknowledgeAlert_doesNotDowngradeResolved(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	now := time.Now()
	repo.closures["alert-1"] = &models.AlertClosure{
		ID: "c1", AlertID: "alert-1", Status: "resolved", ResolvedAt: &now, ResolvedBy: "fixer",
	}
	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall")
	if err != nil {
		t.Fatalf("AcknowledgeAlert error: %v", err)
	}
	if c.Status != "resolved" {
		t.Fatalf("Status = %q, want resolved: acknowledging a resolved alert must not un-resolve it", c.Status)
	}
	if _, ok := repo.lastClosureAttrs["status"]; ok {
		t.Fatalf("AcknowledgeAlert put status into the SET clause of a resolved closure")
	}
	if c.AcknowledgedBy != "oncall" {
		t.Errorf("AcknowledgedBy = %q, want oncall", c.AcknowledgedBy)
	}
	if c.AcknowledgedAt == nil {
		t.Errorf("AcknowledgedAt is nil, want the acknowledgement time")
	}
}

func TestAE_AcknowledgeAlert_storageErrorIsNotMissing(t *testing.T) {
	repo := newFakeAERepo()
	repo.closureReadErr = errors.New("connection refused")
	svc := NewService(repo)
	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall")
	if err == nil {
		t.Fatalf("AcknowledgeAlert returned no error when reading the closure failed")
	}
	if c != nil {
		t.Fatalf("AcknowledgeAlert resp = %v, want nil", c)
	}
	if _, ok := repo.closures["alert-1"]; ok {
		t.Fatalf("AcknowledgeAlert created a closure although the read failed rather than merely found nothing")
	}
}

func TestAE_AcknowledgeAlert_createFailureIsFatal(t *testing.T) {
	repo := newFakeAERepo()
	repo.failCreateClosure = true
	svc := NewService(repo)
	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall")
	if err == nil {
		t.Fatalf("AcknowledgeAlert returned no error when the closure insert failed")
	}
	if c != nil {
		t.Fatalf("AcknowledgeAlert resp = %v, want nil", c)
	}
}

func TestAE_ResolveAlert_storageErrorIsNotMissing(t *testing.T) {
	repo := newFakeAERepo()
	repo.closureReadErr = errors.New("connection refused")
	svc := NewService(repo)
	c, err := svc.ResolveAlert(context.Background(), &models.ResolveRequest{AlertID: "alert-1", Operator: "fixer"}, "t1")
	if err == nil {
		t.Fatalf("ResolveAlert returned no error when reading the closure failed")
	}
	if c != nil {
		t.Fatalf("ResolveAlert resp = %v, want nil", c)
	}
	if _, ok := repo.closures["alert-1"]; ok {
		t.Fatalf("ResolveAlert created a closure although the read failed rather than merely found nothing")
	}
}

func TestAE_ResolveAlert_clampsNegativeMTTR(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	future := time.Now().Add(time.Hour)
	repo.closures["alert-1"] = &models.AlertClosure{
		ID: "c1", AlertID: "alert-1", Status: "acknowledged",
		AcknowledgedAt: &future, CreatedAt: time.Now().Add(-time.Hour),
	}
	c, err := svc.ResolveAlert(context.Background(), &models.ResolveRequest{AlertID: "alert-1", Operator: "fixer"}, "t1")
	if err != nil {
		t.Fatalf("ResolveAlert error: %v", err)
	}
	if c.MTTRSeconds < 0 {
		t.Fatalf("MTTRSeconds = %d, want >= 0", c.MTTRSeconds)
	}
	if got := repo.lastClosureAttrs["mttr_seconds"]; got != int64(0) {
		t.Fatalf("persisted mttr_seconds = %v, want 0", got)
	}
}

func TestAE_RecordMetric_bindsEveryNumericColumn(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)
	stats := map[string]interface{}{
		"totalAlerts":            float64(50),
		"acknowledgedCount":      40,
		"resolvedCount":          int64(30),
		"escalatedCount":         int32(7),
		"avgResponseSeconds":     int64(120),
		"avgResolutionSeconds":   float64(900),
		"p95ResponseSeconds":     int64(300),
		"p95ResolutionSeconds":   float64(2400),
		"slaBreachCount":         2,
		"autoRemediationSuccess": int8(4),
		"autoRemediationFailed":  1,
	}
	if err := svc.RecordMetric(context.Background(), "t1", time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC), stats); err != nil {
		t.Fatalf("RecordMetric error: %v", err)
	}
	if len(repo.metrics) != 1 {
		t.Fatalf("metrics rows = %d, want 1", len(repo.metrics))
	}
	m := repo.metrics[0]
	if m.TotalAlerts != 50 || m.AcknowledgedCount != 40 || m.ResolvedCount != 30 || m.EscalatedCount != 7 {
		t.Errorf("counts = %d/%d/%d/%d, want 50/40/30/7",
			m.TotalAlerts, m.AcknowledgedCount, m.ResolvedCount, m.EscalatedCount)
	}
	if m.AvgResponseSeconds != 120 || m.AvgResolutionSeconds != 900 {
		t.Errorf("averages = %d/%d, want 120/900", m.AvgResponseSeconds, m.AvgResolutionSeconds)
	}
	if m.P95ResponseSeconds != 300 || m.P95ResolutionSeconds != 2400 {
		t.Errorf("p95 = %d/%d, want 300/2400", m.P95ResponseSeconds, m.P95ResolutionSeconds)
	}
	if m.SLABreachCount != 2 || m.AutoRemediationSuccess != 4 || m.AutoRemediationFailed != 1 {
		t.Errorf("sla/remediation = %d/%d/%d, want 2/4/1",
			m.SLABreachCount, m.AutoRemediationSuccess, m.AutoRemediationFailed)
	}
}
