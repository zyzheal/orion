package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/audit/models"
)

// ============================================================================
// Test helpers
// ============================================================================

func buildService(t *testing.T, logs []*models.AuditLog) *Service {
	t.Helper()
	repo := newMockAuditRepo()
	for _, l := range logs {
		if l.TenantID == "" {
			l.TenantID = "t1"
		}
		if l.ID == "" {
			l.ID = "log-" + l.Action
		}
		if l.CreatedAt.IsZero() {
			l.CreatedAt = time.Now().UTC()
		}
		repo.logs[repo.key(l.TenantID, l.ID)] = l
	}
	return NewService(repo)
}

// ============================================================================
// Control catalog tests
// ============================================================================

func TestControlCatalog_HasSOC2AndISO27001(t *testing.T) {
	catalog := controlCatalog()
	var soc2, iso27001 int
	for _, c := range catalog {
		if c.Category == "SOC2" {
			soc2++
		} else if c.Category == "ISO27001" {
			iso27001++
		}
	}
	if soc2 != 6 {
		t.Errorf("expected 6 SOC2 controls (CC1-CC6), got %d", soc2)
	}
	if iso27001 < 12 {
		t.Errorf("expected >=12 ISO27001 controls, got %d", iso27001)
	}
}

func TestControlCatalog_EveryControlHasRequiredFields(t *testing.T) {
	catalog := controlCatalog()
	for _, c := range catalog {
		if c.ID == "" {
			t.Errorf("control %v has empty ID", c)
		}
		if c.Name == "" {
			t.Errorf("control %s has empty name", c.ID)
		}
		if len(c.Actions) == 0 {
			t.Errorf("control %s has no actions", c.ID)
		}
		if c.ExpectedMin <= 0 {
			t.Errorf("control %s ExpectedMin <= 0", c.ID)
		}
		if c.Remediation == "" {
			t.Errorf("control %s has empty remediation", c.ID)
		}
	}
}

func TestSelectControls_SOC2(t *testing.T) {
	catalog := controlCatalog()
	soc2 := selectControls("SOC2", catalog)
	for _, c := range soc2 {
		if c.Category != "SOC2" {
			t.Errorf("SOC2 selection returned non-SOC2 control %s", c.ID)
		}
	}
}

func TestSelectControls_ISO27001(t *testing.T) {
	catalog := controlCatalog()
	iso := selectControls("ISO27001", catalog)
	for _, c := range iso {
		if c.Category != "ISO27001" {
			t.Errorf("ISO27001 selection returned non-ISO27001 control %s", c.ID)
		}
	}
}

func TestSelectControls_Combined(t *testing.T) {
	catalog := controlCatalog()
	combined := selectControls("COMBINED", catalog)
	if len(combined) != len(catalog) {
		t.Errorf("COMBINED expected %d controls, got %d", len(catalog), len(combined))
	}
}

func TestSelectControls_CaseInsensitive(t *testing.T) {
	catalog := controlCatalog()
	soc2 := selectControls("soc2", catalog)
	if len(soc2) == 0 {
		t.Error("case-insensitive selection 'soc2' returned no controls")
	}
	iso := selectControls("iso27001", catalog)
	if len(iso) == 0 {
		t.Error("case-insensitive selection 'iso27001' returned no controls")
	}
}

func TestFrameworkName(t *testing.T) {
	tests := []struct {
		input    string
		contains string
	}{
		{"SOC2", "SOC2"},
		{"soc2", "SOC2"},
		{"ISO27001", "ISO"},
		{"iso27001", "ISO"},
		{"COMBINED", "Combined"},
		{"combined", "Combined"},
		{"UNKNOWN", "Compliance"},
	}
	for _, tt := range tests {
		result := frameworkName(tt.input)
		if !strings.Contains(result, tt.contains) {
			t.Errorf("frameworkName(%q) = %q, expected to contain %q", tt.input, result, tt.contains)
		}
	}
}

// ============================================================================
// ComplianceReport tests
// ============================================================================

func TestComplianceReport_RepoError(t *testing.T) {
	repo := newMockAuditRepo()
	repo.err = errors.New("db error")
	svc := NewService(repo)

	_, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err == nil {
		t.Fatal("expected error from repo")
	}
}

func TestComplianceReport_SOC2EmptyLogs(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if report.ReportType != "SOC2" {
		t.Errorf("expected SOC2, got %s", report.ReportType)
	}
	if report.TotalControls != 6 {
		t.Errorf("expected 6 SOC2 controls, got %d", report.TotalControls)
	}
	if report.Score != 0 {
		t.Errorf("expected score 0 for empty logs, got %f", report.Score)
	}
	if report.Rating != "non-compliant" {
		t.Errorf("expected non-compliant, got %s", report.Rating)
	}
	if len(report.Findings) == 0 {
		t.Error("expected findings for empty logs")
	}
}

func TestComplianceReport_SOC2WithActions(t *testing.T) {
	logs := []*models.AuditLog{
		{TenantID: "t1", Action: "CREATE"},
		{TenantID: "t1", Action: "DELETE"},
		{TenantID: "t1", Action: "LOGIN"},
		{TenantID: "t1", Action: "LOGOUT"},
		{TenantID: "t1", Action: "UPDATE"},
		{TenantID: "t1", Action: "GRANT"},
		{TenantID: "t1", Action: "REVOKE"},
	}
	svc := buildService(t, logs)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if report.TotalControls != 6 {
		t.Errorf("expected 6 SOC2 controls, got %d", report.TotalControls)
	}
	if report.Score <= 0 {
		t.Errorf("expected non-zero score with diverse actions, got %f", report.Score)
	}
	if report.GeneratedAt == "" {
		t.Error("GeneratedAt should not be empty")
	}
	passed := 0
	for _, c := range report.Controls {
		if c.Status == "passed" {
			passed++
		}
	}
	if passed == 0 {
		t.Errorf("expected at least one passed control with diverse actions, got 0")
	}
}

func TestComplianceReport_ISO27001(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "ISO27001")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if report.ReportType != "ISO27001" {
		t.Errorf("expected ISO27001, got %s", report.ReportType)
	}
	if report.TotalControls < 12 {
		t.Errorf("expected >=12 ISO27001 controls, got %d", report.TotalControls)
	}
}

func TestComplianceReport_Combined(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "COMBINED")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if report.ReportType != "COMBINED" {
		t.Errorf("expected COMBINED, got %s", report.ReportType)
	}
	// Combined = all controls (6 SOC2 + 13 ISO27001 = 19).
	if report.TotalControls != 19 {
		t.Errorf("expected 19 combined controls, got %d", report.TotalControls)
	}
}

func TestComplianceReport_ControlStatusesValid(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	validStatuses := map[string]struct{}{"passed": {}, "failed": {}, "warning": {}}
	for _, c := range report.Controls {
		if _, ok := validStatuses[c.Status]; !ok {
			t.Errorf("control %s has invalid status %q", c.ID, c.Status)
		}
	}
}

func TestComplianceReport_ControlsSortedByID(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	for i := 1; i < len(report.Controls); i++ {
		if report.Controls[i-1].ID >= report.Controls[i].ID {
			t.Errorf("controls not sorted: %s >= %s", report.Controls[i-1].ID, report.Controls[i].ID)
		}
	}
}

func TestComplianceReport_FindingsHaveRemediation(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	for _, f := range report.Findings {
		if f.Remediation == "" {
			t.Errorf("finding %s has empty remediation", f.ID)
		}
		if f.ControlID == "" {
			t.Errorf("finding %s has empty controlId", f.ID)
		}
	}
}

func TestComplianceReport_RatingThresholds(t *testing.T) {
	// Non-compliant when score < 40 (empty logs).
	svc := buildService(t, nil)
	if report, _ := svc.ComplianceReport(context.Background(), "t1", "SOC2"); report.Rating != "non-compliant" {
		t.Errorf("empty logs -> expected non-compliant, got %s", report.Rating)
	}

	// Fill logs with every possible action to drive score up.
	allActions := []string{"CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
		"GRANT", "REVOKE", "APPROVE", "REJECT", "REVIEW", "SCAN", "AUDIT",
		"ALERT", "DEPLOY", "EXPORT", "BACKUP", "RESTORE"}
	logs := make([]*models.AuditLog, len(allActions))
	for i, a := range allActions {
		logs[i] = &models.AuditLog{TenantID: "t1", Action: a}
	}
	svc2 := buildService(t, logs)
	if report, _ := svc2.ComplianceReport(context.Background(), "t1", "SOC2"); report.Rating != "compliant" && report.Rating != "partial" {
		t.Errorf("full actions -> expected compliant or partial, got %s (score=%f)", report.Rating, report.Score)
	}
}

func TestComplianceReport_AssessmentPeriod(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	ps, _ := time.Parse(time.RFC3339, report.PeriodStart)
	pe, _ := time.Parse(time.RFC3339, report.PeriodEnd)
	span := pe.Sub(ps)
	if span.Hours() < 90*24-24 || span.Hours() > 90*24+24 {
		t.Errorf("expected ~90-day period, got %.0f days", span.Hours()/24)
	}
}

func TestComplianceReport_RecommendationsPresent(t *testing.T) {
	svc := buildService(t, nil)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(report.Recommendations) == 0 {
		t.Error("expected recommendations for failing controls")
	}
}

func TestComplianceReport_CompliantNoGaps(t *testing.T) {
	// Supply a wide set of actions to satisfy all SOC2 controls.
	allActions := []string{
		"CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
		"GRANT", "REVOKE", "APPROVE", "REJECT", "REVIEW", "SCAN", "AUDIT", "ALERT",
	}
	logs := make([]*models.AuditLog, len(allActions))
	for i, a := range allActions {
		logs[i] = &models.AuditLog{TenantID: "t1", Action: a}
	}
	svc := buildService(t, logs)

	report, err := svc.ComplianceReport(context.Background(), "t1", "SOC2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	for _, c := range report.Controls {
		if c.EvidenceCount == 0 {
			t.Errorf("control %s should have evidence with all actions present", c.ID)
		}
	}
	for _, f := range report.Findings {
		if f.Severity == "high" || f.Severity == "critical" {
			t.Errorf("expected no high/critical findings with all actions, got %s for %s", f.Severity, f.ID)
		}
	}
}

// ============================================================================
// CoverageStats tests
// ============================================================================

func TestCoverageStats_RepoError(t *testing.T) {
	repo := newMockAuditRepo()
	repo.err = errors.New("db error")
	svc := NewService(repo)

	_, err := svc.CoverageStats(context.Background(), "t1")
	if err == nil {
		t.Fatal("expected error from repo")
	}
}

func TestCoverageStats_EmptyLogs(t *testing.T) {
	svc := buildService(t, nil)

	_ = svc
	stats, err := svc.CoverageStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(stats.ByFramework) != 2 {
		t.Errorf("expected 2 frameworks, got %d", len(stats.ByFramework))
	}
	if stats.ByFramework["SOC2"] != 0 {
		t.Errorf("SOC2 score should be 0 with empty logs, got %f", stats.ByFramework["SOC2"])
	}
	if stats.OverallCoveragePct != 0 {
		t.Errorf("overall should be 0 with empty logs, got %f", stats.OverallCoveragePct)
	}
	if stats.AssessedAt == "" {
		t.Error("AssessedAt should not be empty")
	}
}

// ============================================================================
// sevRank helper
// ============================================================================

func TestSevRank(t *testing.T) {
	tests := map[string]int{
		"critical": 4,
		"Critical": 4,
		"high":     3,
		"medium":   2,
		"low":      1,
		"":         0,
		"unknown":  0,
	}
	for sev, want := range tests {
		if got := sevRank(sev); got != want {
			t.Errorf("sevRank(%q) = %d, want %d", sev, got, want)
		}
	}
}
