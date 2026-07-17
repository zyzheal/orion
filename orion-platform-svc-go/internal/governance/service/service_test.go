package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/governance/models"
	"orion/platform-svc-go/internal/governance/repository"
)

// --- mock repository ---

type mockGovernanceRepo struct {
	policies         map[string]*models.GovernancePolicy // key: tenantID:id
	policyStats      repository.PolicyStats
	statsErr         error
	listRulesErr     error
	getAuditLogsErr  error
	dbErr            error // injected DB error (simulates sql.ErrNoRows etc.)
}

func (m *mockGovernanceRepo) getPolicy(id, tenantID string) (*models.GovernancePolicy, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	p, ok := m.policies[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}

func (m *mockGovernanceRepo) GetPolicy(ctx context.Context, id, tenantID string) (*models.GovernancePolicy, error) {
	return m.getPolicy(id, tenantID)
}

func (m *mockGovernanceRepo) CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, createdBy string) (*models.GovernancePolicy, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	rulesJSON, _ := json.Marshal(req.Rules)
	scopeJSON, _ := json.Marshal(req.Scope)
	metaJSON, _ := json.Marshal(req.Metadata)
	now := time.Now().UTC()
	p := &models.GovernancePolicy{
		ID:          "policy-1",
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Status:      models.PolicyStatusDraft,
		Severity:    req.Severity,
		Rules:       string(rulesJSON),
		Scope:       string(scopeJSON),
		Enforcement: req.Enforcement,
		CreatedBy:   createdBy,
		Metadata:    string(metaJSON),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.policies[tenantID+":"+p.ID] = p
	return p, nil
}

func (m *mockGovernanceRepo) ListPoliciesPaginated(ctx context.Context, tenantID string, q *models.PolicyListQuery, offset, limit int) ([]models.GovernancePolicy, int, error) {
	if m.dbErr != nil {
		return nil, 0, m.dbErr
	}
	var out []models.GovernancePolicy
	total := 0
	for k, p := range m.policies {
		if !policyMatchesTenant(k, tenantID) {
			continue
		}
		if q != nil {
			if q.Type != "" && p.Type != q.Type {
				continue
			}
			if q.Status != "" && p.Status != q.Status {
				continue
			}
			if q.Severity != "" && p.Severity != q.Severity {
				continue
			}
		}
		out = append(out, *p)
		total++
	}
	return out, total, nil
}

func (m *mockGovernanceRepo) UpdatePolicy(ctx context.Context, id, tenantID string, updates map[string]interface{}) (*models.GovernancePolicy, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	p, ok := m.policies[tenantID+":"+id]
	if !ok {
		return nil, errors.New("not found")
	}
	if v, ok := updates["status"]; ok {
		p.Status = v.(string)
	}
	if v, ok := updates["name"]; ok {
		p.Name = v.(string)
	}
	if v, ok := updates["description"]; ok {
		p.Description = v.(string)
	}
	if v, ok := updates["severity"]; ok {
		p.Severity = v.(string)
	}
	if v, ok := updates["enforcement"]; ok {
		p.Enforcement = v.(string)
	}
	if v, ok := updates["rules"]; ok {
		p.Rules = v.(string)
	}
	if v, ok := updates["scope"]; ok {
		p.Scope = v.(string)
	}
	if v, ok := updates["metadata"]; ok {
		p.Metadata = v.(string)
	}
	p.UpdatedAt = time.Now().UTC()
	return p, nil
}

func (m *mockGovernanceRepo) UpdatePolicyStatus(ctx context.Context, id, tenantID, status string) (*models.GovernancePolicy, error) {
	return m.UpdatePolicy(ctx, id, tenantID, map[string]interface{}{"status": status})
}

func (m *mockGovernanceRepo) DeletePolicy(ctx context.Context, id, tenantID string) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	delete(m.policies, tenantID+":"+id)
	return nil
}

func (m *mockGovernanceRepo) IncrementApplyCount(ctx context.Context, id, tenantID string) error {
	p := m.policies[tenantID+":"+id]
	if p == nil {
		return nil
	}
	p.AppliedCount++
	return nil
}

func (m *mockGovernanceRepo) IncrementViolationCount(ctx context.Context, id, tenantID string) error {
	p := m.policies[tenantID+":"+id]
	if p == nil {
		return nil
	}
	p.ViolationCount++
	return nil
}

func (m *mockGovernanceRepo) CreateAuditLog(ctx context.Context, policyID string, req *repository.AuditLogCreateReq) (*models.GovernanceAuditLog, error) {
	// no-op for service tests
	return &models.GovernanceAuditLog{ID: "log-1", PolicyID: policyID, Action: req.Action}, nil
}

func (m *mockGovernanceRepo) GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]models.GovernanceAuditLog, int, error) {
	if m.getAuditLogsErr != nil {
		return nil, 0, m.getAuditLogsErr
	}
	return []models.GovernanceAuditLog{
		{ID: "log-1", PolicyID: policyID, Action: "create", Timestamp: time.Now().UTC(), Outcome: "success"},
	}, 1, nil
}

func (m *mockGovernanceRepo) CreateComplianceCheck(ctx context.Context, policyID string, req *models.ComplianceCheckRequest) error {
	return nil
}

func (m *mockGovernanceRepo) ListRules(ctx context.Context, tenantID string, offset, limit int) ([]models.PolicyRule, int, error) {
	if m.listRulesErr != nil {
		return nil, 0, m.listRulesErr
	}
	return []models.PolicyRule{
		{ID: "rule-1", Name: "rate-limit", Condition: `{"field":"requests","operator":">","value":100}`, Action: `{"type":"block","config":{}}`, Priority: 1, Enabled: true},
	}, 1, nil
}

func (m *mockGovernanceRepo) GetPolicyStats(ctx context.Context, tenantID string) (*repository.PolicyStats, error) {
	if m.statsErr != nil {
		return &repository.PolicyStats{}, m.statsErr
	}
	return &m.policyStats, nil
}

func policyMatchesTenant(key, tenantID string) bool {
	// key format is tenantID:id
	return len(key) > len(tenantID)+1 && key[:len(tenantID)] == tenantID && key[len(tenantID)] == ':'
}

func newTestGovernanceRepo() *mockGovernanceRepo {
	return &mockGovernanceRepo{
		policies:    map[string]*models.GovernancePolicy{},
		policyStats: repository.PolicyStats{TotalPolicies: 5, ActivePolicies: 3},
	}
}

// --- helpers ---

func makeTestPolicy(tenantID, id, name, typ, status, sev, enforcement string) *models.GovernancePolicy {
	return &models.GovernancePolicy{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Description: "test policy",
		Type:        typ,
		Status:      status,
		Severity:    sev,
		Rules:       `[{"name":"r1","condition":{"field":"f","operator":"=","value":"v"},"action":{"type":"block"}}]`,
		Scope:       `{"include":["*"],"exclude":[]}`,
		Enforcement: enforcement,
		CreatedBy:   "user-1",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		Metadata:    "{}",
	}
}

func makeTestService(repo *mockGovernanceRepo) *Service {
	return NewService(repo)
}

// --- Tests ---

func TestGovernanceCreatePolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	resp, err := svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:        "test-policy",
		Description: "desc",
		Type:        "rate_limit",
		Rules:       []models.PolicyRuleBody{{Name: "r1", Condition: models.PolicyCondition{Field: "f", Operator: "="}, Action: models.PolicyActionBody{Type: "block"}}},
	}, "tenant-1", "user-1")

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Name != "test-policy" {
		t.Errorf("expected test-policy, got %s", resp.Name)
	}
	if resp.Status != models.PolicyStatusDraft {
		t.Errorf("expected draft, got %s", resp.Status)
	}
}

func TestGovernanceCreatePolicy_DBError(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.dbErr = errors.New("db write failed")
	svc := makeTestService(repo)

	_, err := svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:    "x",
		Type:    "custom",
		Rules:   []models.PolicyRuleBody{{Name: "r1", Condition: models.PolicyCondition{Field: "f", Operator: "="}, Action: models.PolicyActionBody{Type: "block"}}},
	}, "tenant-1", "user-1")
	if err == nil {
		t.Fatal("expected error for db failure")
	}
}

func TestGovernanceGetPolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	p := makeTestPolicy("tenant-1", "p1", "test", "quota", models.PolicyStatusActive, models.SeverityHigh, models.EnforcementStrict)
	repo.policies["tenant-1:p1"] = p
	svc := makeTestService(repo)

	resp, err := svc.GetPolicy(context.Background(), "p1", "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.ID != "p1" {
		t.Errorf("expected p1, got %s", resp.ID)
	}
	if resp.Name != "test" {
		t.Errorf("expected test, got %s", resp.Name)
	}
}

func TestGovernanceGetPolicy_NotFound(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	_, err := svc.GetPolicy(context.Background(), "missing", "tenant-1")
	if !IsNotFound(err) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGovernanceListPolicies_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policies["tenant-1:p1"] = makeTestPolicy("tenant-1", "p1", "p1", "quota", models.PolicyStatusActive, "high", "")
	repo.policies["tenant-1:p2"] = makeTestPolicy("tenant-1", "p2", "p2", "quota", models.PolicyStatusDraft, "medium", "")
	repo.policies["tenant-2:p3"] = makeTestPolicy("tenant-2", "p3", "p3", "quota", models.PolicyStatusActive, "low", "")
	svc := makeTestService(repo)

	// No filter
	policies, total, err := svc.ListPolicies(context.Background(), "tenant-1", nil, 0, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(policies) != 2 {
		t.Errorf("expected 2 policies, got %d", len(policies))
	}

	// Filter by status
	_, total2, err := svc.ListPolicies(context.Background(), "tenant-1", &models.PolicyListQuery{Status: models.PolicyStatusActive}, 0, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total2 != 1 {
		t.Errorf("expected total 1 after filter, got %d", total2)
	}
}

func TestGovernanceListPolicies_DBError(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.dbErr = errors.New("db read failed")
	svc := makeTestService(repo)

	_, _, err := svc.ListPolicies(context.Background(), "tenant-1", nil, 0, 20)
	if err == nil {
		t.Fatal("expected error for db failure")
	}
}

func TestGovernanceUpdatePolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	p := makeTestPolicy("tenant-1", "p1", "old", "quota", models.PolicyStatusDraft, "low", "")
	repo.policies["tenant-1:p1"] = p
	svc := makeTestService(repo)

	name := "new-name"
	s := models.EnforcementSoft
	resp, err := svc.UpdatePolicy(context.Background(), "p1", "tenant-1", &models.UpdatePolicyRequest{
		Name:        &name,
		Enforcement: &s,
	}, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Name != "new-name" {
		t.Errorf("expected new-name, got %s", resp.Name)
	}
	if resp.Enforcement != models.EnforcementSoft {
		t.Errorf("expected soft enforcement, got %s", resp.Enforcement)
	}
}

func TestGovernanceUpdatePolicy_NoFields(t *testing.T) {
	repo := newTestGovernanceRepo()
	p := makeTestPolicy("tenant-1", "p1", "original", "quota", models.PolicyStatusDraft, "low", "")
	repo.policies["tenant-1:p1"] = p
	svc := makeTestService(repo)

	resp, err := svc.UpdatePolicy(context.Background(), "p1", "tenant-1", &models.UpdatePolicyRequest{}, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Name != "original" {
		t.Errorf("expected original name unchanged, got %s", resp.Name)
	}
}

func TestGovernanceUpdatePolicy_NotFound(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	_, err := svc.UpdatePolicy(context.Background(), "missing", "tenant-1", &models.UpdatePolicyRequest{}, "user-1")
	if !IsNotFound(err) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGovernanceDeletePolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policies["tenant-1:p1"] = makeTestPolicy("tenant-1", "p1", "x", "quota", "draft", "low", "")
	svc := makeTestService(repo)

	err := svc.DeletePolicy(context.Background(), "p1", "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	// Verify deleted
	_, ok := repo.policies["tenant-1:p1"]
	if ok {
		t.Error("expected policy to be deleted")
	}
}

func TestGovernanceDeletePolicy_NotFound(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	err := svc.DeletePolicy(context.Background(), "missing", "tenant-1", "user-1")
	if !IsNotFound(err) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGovernanceEnablePolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	p := makeTestPolicy("tenant-1", "p1", "x", "quota", models.PolicyStatusDraft, "low", "")
	repo.policies["tenant-1:p1"] = p
	svc := makeTestService(repo)

	resp, err := svc.EnablePolicy(context.Background(), "p1", "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Status != models.PolicyStatusActive {
		t.Errorf("expected active, got %s", resp.Status)
	}
}

func TestGovernanceEnablePolicy_NotFound(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	_, err := svc.EnablePolicy(context.Background(), "missing", "tenant-1", "user-1")
	if !IsNotFound(err) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGovernanceDisablePolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	p := makeTestPolicy("tenant-1", "p1", "x", "quota", models.PolicyStatusActive, "low", "")
	repo.policies["tenant-1:p1"] = p
	svc := makeTestService(repo)

	resp, err := svc.DisablePolicy(context.Background(), "p1", "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Status != models.PolicyStatusPaused {
		t.Errorf("expected paused, got %s", resp.Status)
	}
}

func TestGovernanceGetAuditLogs_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	logs, total, err := svc.GetAuditLogs(context.Background(), "p1", 0, 50)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(logs) != 1 {
		t.Errorf("expected 1 log, got %d", len(logs))
	}
}

func TestGovernanceGetAuditLogs_DBError(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.getAuditLogsErr = errors.New("audit db error")
	svc := makeTestService(repo)

	_, _, err := svc.GetAuditLogs(context.Background(), "p1", 0, 50)
	if err == nil {
		t.Fatal("expected error for db failure")
	}
}

func TestGovernanceCheckCompliance_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policies["tenant-1:p1"] = makeTestPolicy("tenant-1", "p1", "active-policy", "quota", models.PolicyStatusActive, "high", "")
	repo.policies["tenant-1:p2"] = makeTestPolicy("tenant-1", "p2", "draft-policy", "quota", models.PolicyStatusDraft, "low", "")
	svc := makeTestService(repo)

	resp, err := svc.CheckCompliance(context.Background(), &models.ComplianceCheckRequest{
		ResourceID:   "res-1",
		ResourceType: "service",
	}, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.ResourceID != "res-1" {
		t.Errorf("expected res-1, got %s", resp.ResourceID)
	}
	if resp.Score < 0 || resp.Score > 100 {
		t.Errorf("expected score between 0-100, got %d", resp.Score)
	}
	if resp.Status == "" {
		t.Error("expected non-empty status")
	}
}

func TestGovernanceCheckCompliance_WithPolicyIDs(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policies["tenant-1:p1"] = makeTestPolicy("tenant-1", "p1", "p1", "quota", models.PolicyStatusActive, "high", "")
	repo.policies["tenant-1:p2"] = makeTestPolicy("tenant-1", "p2", "p2", "quota", models.PolicyStatusActive, "low", "")
	svc := makeTestService(repo)

	resp, err := svc.CheckCompliance(context.Background(), &models.ComplianceCheckRequest{
		ResourceID:   "res-1",
		ResourceType: "service",
		PolicyIDs:    []string{"p1"},
	}, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	// Only p1 active policy is considered, p2 is also active so total 2 active but filtered to 1
	if resp.Status == "" {
		t.Error("expected non-empty status")
	}
}

func TestGovernanceGetComplianceReport_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policyStats = repository.PolicyStats{TotalPolicies: 10, ActivePolicies: 5}
	svc := makeTestService(repo)

	resp, err := svc.GetComplianceReport(context.Background(), "tenant-1", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.OverallScore < 0 || resp.OverallScore > 100 {
		t.Errorf("expected score 0-100, got %d", resp.OverallScore)
	}
	if resp.Summary.TotalPolicies != 10 {
		t.Errorf("expected 10 total policies, got %d", resp.Summary.TotalPolicies)
	}
	if resp.Summary.ActivePolicies != 5 {
		t.Errorf("expected 5 active policies, got %d", resp.Summary.ActivePolicies)
	}
	if resp.Period.Start == "" {
		t.Error("expected non-empty period start")
	}
}

func TestGovernanceGetComplianceReport_WithPeriod(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	start := "2024-01-01T00:00:00Z"
	end := "2024-02-01T00:00:00Z"
	resp, err := svc.GetComplianceReport(context.Background(), "tenant-1", &models.CompliancePeriod{Start: start, End: end})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Period.Start != start {
		t.Errorf("expected period start %s, got %s", start, resp.Period.Start)
	}
	if resp.Period.End != end {
		t.Errorf("expected period end %s, got %s", end, resp.Period.End)
	}
}

func TestGovernanceGetComplianceReport_StatsError(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.statsErr = errors.New("stats db error")
	svc := makeTestService(repo)

	_, err := svc.GetComplianceReport(context.Background(), "tenant-1", nil)
	if err == nil {
		t.Fatal("expected error for stats failure")
	}
}

func TestGovernanceApplyPolicy_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policies["tenant-1:p1"] = makeTestPolicy("tenant-1", "p1", "active", "quota", models.PolicyStatusActive, "high", "")
	svc := makeTestService(repo)

	resp, err := svc.ApplyPolicy(context.Background(), "p1", "tenant-1", &models.ApplyPolicyRequest{
		ResourceID:   "res-1",
		ResourceType: "service",
	}, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.PolicyID != "p1" {
		t.Errorf("expected p1, got %s", resp.PolicyID)
	}
	if resp.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}
}

func TestGovernanceApplyPolicy_NotFound(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	_, err := svc.ApplyPolicy(context.Background(), "missing", "tenant-1", &models.ApplyPolicyRequest{
		ResourceID:   "res-1",
		ResourceType: "service",
	}, "user-1")
	if !IsNotFound(err) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGovernanceApplyPolicy_PolicyNotActive(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.policies["tenant-1:p1"] = makeTestPolicy("tenant-1", "p1", "x", "quota", models.PolicyStatusDraft, "low", "")
	svc := makeTestService(repo)

	_, err := svc.ApplyPolicy(context.Background(), "p1", "tenant-1", &models.ApplyPolicyRequest{
		ResourceID:   "res-1",
		ResourceType: "service",
	}, "user-1")
	if err != ErrPolicyNotActive {
		t.Errorf("expected ErrPolicyNotActive, got %v", err)
	}
}

func TestGovernanceGetRules_Success(t *testing.T) {
	repo := newTestGovernanceRepo()
	svc := makeTestService(repo)

	rules, total, err := svc.GetRules(context.Background(), "tenant-1", 0, 50)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(rules))
	}
}

func TestGovernanceGetRules_DBError(t *testing.T) {
	repo := newTestGovernanceRepo()
	repo.listRulesErr = errors.New("rules db error")
	svc := makeTestService(repo)

	_, _, err := svc.GetRules(context.Background(), "tenant-1", 0, 50)
	if err == nil {
		t.Fatal("expected error for rules db failure")
	}
}

func (m *mockGovernanceRepo) ListPolicies(ctx context.Context, tenantID string, q *models.PolicyListQuery) ([]models.GovernancePolicy, int, error) {
	if m.listRulesErr != nil {
		return nil, 0, m.listRulesErr
	}
	var result []models.GovernancePolicy
	for k, p := range m.policies {
		if strings.HasPrefix(k, tenantID+":") {
			result = append(result, *p)
		}
	}
	return result, len(result), nil
}
