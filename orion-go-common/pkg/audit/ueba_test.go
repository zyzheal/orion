package audit

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// mockUEBAStore implements UEBAStore for testing.
type mockUEBAStore struct {
	denials    map[string]int      // userID -> count
	resources  map[string][]string // userID -> resources
	entries    []*AuditEntry
	countErr   error
	resourceErr error
	denialsErr  error
	entriesErr  error
}

func newMockUEBAStore() *mockUEBAStore {
	return &mockUEBAStore{
		denials:   make(map[string]int),
		resources: make(map[string][]string),
	}
}

func (m *mockUEBAStore) CountDenialsByUser(ctx context.Context, tenantID, userID string, since time.Time) (int, error) {
	if m.countErr != nil {
		return 0, m.countErr
	}
	return m.denials[userID], nil
}

func (m *mockUEBAStore) GetUniqueResourcesByUser(ctx context.Context, tenantID, userID string, since time.Time) ([]string, error) {
	if m.resourceErr != nil {
		return nil, m.resourceErr
	}
	return m.resources[userID], nil
}

func (m *mockUEBAStore) GetDenialsByTenant(ctx context.Context, tenantID string, since time.Time) (map[string]int, error) {
	if m.denialsErr != nil {
		return nil, m.denialsErr
	}
	return m.denials, nil
}

func (m *mockUEBAStore) GetRecentEntries(ctx context.Context, tenantID, userID string, limit int) ([]*AuditEntry, error) {
	if m.entriesErr != nil {
		return nil, m.entriesErr
	}
	var result []*AuditEntry
	for _, e := range m.entries {
		if e.TenantID == tenantID && e.UserID == userID {
			result = append(result, e)
		}
	}
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func TestUEBADetector_Creation(t *testing.T) {
	store := newMockUEBAStore()
	detector := NewUEBADetector(store, nil)

	if detector.RuleCount() != 6 {
		t.Errorf("expected 6 default rules, got %d", detector.RuleCount())
	}
}

func TestUEBADetector_AddRule(t *testing.T) {
	store := newMockUEBAStore()
	detector := NewUEBADetector(store, nil)

	initial := detector.RuleCount()
	detector.AddRule(UEBADetectorRule{
		ID:       "custom-rule",
		Name:     "Custom Rule",
		Enabled:  true,
		Evaluate: func(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
			return nil, nil
		},
	})

	if detector.RuleCount() != initial+1 {
		t.Errorf("expected %d rules after add, got %d", initial+1, detector.RuleCount())
	}
}

func TestUEBADetector_Evaluate_NoAlerts(t *testing.T) {
	store := newMockUEBAStore()
	alerted := false
	detector := NewUEBADetector(store, func(ctx context.Context, alert UEBAAlert) {
		alerted = true
	})

	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "user-1",
		Resource:  "pipeline",
		Action:    "read",
		Decision:  "allow",
		Timestamp: time.Now(),
	}

	alerts, err := detector.Evaluate(context.Background(), event)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts for normal event, got %d", len(alerts))
	}
	if alerted {
		t.Error("alert callback should not have been called")
	}
}

func TestUEBADetector_GetAlerts(t *testing.T) {
	store := newMockUEBAStore()
	detector := NewUEBADetector(store, nil)

	// Manually add an alert
	detector.mu.Lock()
	detector.alerts = append(detector.alerts, UEBAAlert{
		RuleID:    "test-rule",
		TenantID:  "t1",
		UserID:    "u1",
		Timestamp: time.Now(),
	})
	detector.mu.Unlock()

	since := time.Now().Add(-1 * time.Hour)
	alerts, err := detector.GetAlerts(context.Background(), "t1", since)
	if err != nil {
		t.Fatalf("GetAlerts failed: %v", err)
	}
	if len(alerts) != 1 {
		t.Errorf("expected 1 alert, got %d", len(alerts))
	}

	// Different tenant should return empty
	alerts, err = detector.GetAlerts(context.Background(), "t2", since)
	if err != nil {
		t.Fatalf("GetAlerts failed: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts for different tenant, got %d", len(alerts))
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Individual rule tests
// ──────────────────────────────────────────────────────────────────────────────

func TestEvaluateMassDataExport_Trigger(t *testing.T) {
	store := newMockUEBAStore()
	// Create 11 export entries in the last hour
	now := time.Now()
	for i := 0; i < 11; i++ {
		store.entries = append(store.entries, &AuditEntry{
			ID:        fmt.Sprintf("export-%d", i),
			TenantID:  "t1",
			UserID:    "u1",
			Action:    "export",
			Timestamp: now.Add(-time.Duration(i) * 5 * time.Minute),
		})
	}

	event := SecurityEvent{
		Type:      "export",
		TenantID:  "t1",
		UserID:    "u1",
		Action:    "export",
		Timestamp: now,
	}

	alert, err := evaluateMassDataExport(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateMassDataExport failed: %v", err)
	}
	if alert == nil {
		t.Fatal("expected alert to trigger")
	}
	if alert.Severity != SeverityHigh {
		t.Errorf("expected HIGH severity, got %s", alert.Severity)
	}
	if alert.Metadata["action"] != "block" {
		t.Errorf("expected block action, got %v", alert.Metadata["action"])
	}
}

func TestEvaluateMassDataExport_NoTrigger(t *testing.T) {
	store := newMockUEBAStore()
	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "u1",
		Action:    "read", // not export
		Timestamp: time.Now(),
	}

	alert, err := evaluateMassDataExport(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateMassDataExport failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for non-export action")
	}
}

func TestEvaluateUnauthorizedAttempt_Trigger(t *testing.T) {
	store := newMockUEBAStore()
	store.denials["u1"] = 25 // > 20 threshold

	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "u1",
		Decision:  "deny",
		Timestamp: time.Now(),
	}

	alert, err := evaluateUnauthorizedAttempt(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateUnauthorizedAttempt failed: %v", err)
	}
	if alert == nil {
		t.Fatal("expected alert to trigger")
	}
	if alert.Severity != SeverityCritical {
		t.Errorf("expected CRITICAL severity, got %s", alert.Severity)
	}
	if alert.Metadata["action"] != "lock_account" {
		t.Errorf("expected lock_account action, got %v", alert.Metadata["action"])
	}
}

func TestEvaluateUnauthorizedAttempt_NoTrigger_Allow(t *testing.T) {
	store := newMockUEBAStore()
	store.denials["u1"] = 25

	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "u1",
		Decision:  "allow", // not deny
		Timestamp: time.Now(),
	}

	alert, err := evaluateUnauthorizedAttempt(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateUnauthorizedAttempt failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for allow decision")
	}
}

func TestEvaluateOffHoursSensitiveAccess_Trigger(t *testing.T) {
	store := newMockUEBAStore()

	// 22:00 is off-hours
	event := SecurityEvent{
		Type:      "access",
		TenantID:  "t1",
		UserID:    "u1",
		Resource:  "secrets",
		Action:    "read",
		Timestamp: time.Date(2026, 6, 7, 22, 0, 0, 0, time.UTC),
	}

	alert, err := evaluateOffHoursSensitiveAccess(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateOffHoursSensitiveAccess failed: %v", err)
	}
	if alert == nil {
		t.Fatal("expected alert to trigger for off-hours secrets access")
	}
	if alert.Severity != SeverityMedium {
		t.Errorf("expected MEDIUM severity, got %s", alert.Severity)
	}
}

func TestEvaluateOffHoursSensitiveAccess_NoTrigger_WorkingHours(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "access",
		TenantID:  "t1",
		UserID:    "u1",
		Resource:  "secrets",
		Timestamp: time.Date(2026, 6, 7, 14, 0, 0, 0, time.UTC), // 14:00 is working hours
	}

	alert, err := evaluateOffHoursSensitiveAccess(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateOffHoursSensitiveAccess failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger during working hours")
	}
}

func TestEvaluateOffHoursSensitiveAccess_NoTrigger_NonSensitive(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "access",
		TenantID:  "t1",
		UserID:    "u1",
		Resource:  "dashboard", // not sensitive
		Timestamp: time.Date(2026, 6, 7, 22, 0, 0, 0, time.UTC),
	}

	alert, err := evaluateOffHoursSensitiveAccess(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateOffHoursSensitiveAccess failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for non-sensitive resource")
	}
}

func TestEvaluateAPIPatternAnomaly_Trigger(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "access",
		TenantID:  "t1",
		UserID:    "u1",
		Resource:  "api",
		Metadata:  map[string]interface{}{"anomaly_score": 0.95},
		Timestamp: time.Now(),
	}

	alert, err := evaluateAPIPatternAnomaly(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateAPIPatternAnomaly failed: %v", err)
	}
	if alert == nil {
		t.Fatal("expected alert for anomaly score > 0.8")
	}
	if alert.Severity != SeverityMedium {
		t.Errorf("expected MEDIUM severity, got %s", alert.Severity)
	}
}

func TestEvaluateAPIPatternAnomaly_NoTrigger(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "access",
		TenantID:  "t1",
		UserID:    "u1",
		Metadata:  map[string]interface{}{"anomaly_score": 0.5},
		Timestamp: time.Now(),
	}

	alert, err := evaluateAPIPatternAnomaly(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateAPIPatternAnomaly failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for anomaly score <= 0.8")
	}
}

func TestEvaluateAPIPatternAnomaly_NoMetadata(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "access",
		TenantID:  "t1",
		UserID:    "u1",
		Metadata:  nil,
		Timestamp: time.Now(),
	}

	alert, err := evaluateAPIPatternAnomaly(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateAPIPatternAnomaly failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger without anomaly_score metadata")
	}
}

func TestEvaluateMultiLocationLogin_Trigger(t *testing.T) {
	store := newMockUEBAStore()
	now := time.Now()
	// Create entries from different IPs
	store.entries = []*AuditEntry{
		{ID: "e1", TenantID: "t1", UserID: "u1", IPAddress: "1.1.1.1", Timestamp: now.Add(-30 * time.Minute)},
		{ID: "e2", TenantID: "t1", UserID: "u1", IPAddress: "2.2.2.2", Timestamp: now.Add(-20 * time.Minute)},
		{ID: "e3", TenantID: "t1", UserID: "u1", IPAddress: "3.3.3.3", Timestamp: now.Add(-10 * time.Minute)},
	}

	event := SecurityEvent{
		Type:      "login",
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "4.4.4.4", // 4th distinct IP
		Timestamp: now,
	}

	alert, err := evaluateMultiLocationLogin(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateMultiLocationLogin failed: %v", err)
	}
	if alert == nil {
		t.Fatal("expected alert for >3 different IPs")
	}
	if alert.Severity != SeverityMedium {
		t.Errorf("expected MEDIUM severity, got %s", alert.Severity)
	}
}

func TestEvaluateMultiLocationLogin_NoTrigger(t *testing.T) {
	store := newMockUEBAStore()
	now := time.Now()
	store.entries = []*AuditEntry{
		{ID: "e1", TenantID: "t1", UserID: "u1", IPAddress: "1.1.1.1", Timestamp: now.Add(-30 * time.Minute)},
	}

	event := SecurityEvent{
		Type:      "login",
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "1.1.1.1", // same IP
		Timestamp: now,
	}

	alert, err := evaluateMultiLocationLogin(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateMultiLocationLogin failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for same IP")
	}
}

func TestEvaluateMultiLocationLogin_NoIP(t *testing.T) {
	store := newMockUEBAStore()
	event := SecurityEvent{
		Type:      "login",
		TenantID:  "t1",
		UserID:    "u1",
		IPAddress: "", // no IP
		Timestamp: time.Now(),
	}

	alert, err := evaluateMultiLocationLogin(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateMultiLocationLogin failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger without IP address")
	}
}

func TestEvaluateServiceAccountAbuse_Trigger(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "svc_deploy", // service account
		UserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0",
		Timestamp: time.Now(),
	}

	alert, err := evaluateServiceAccountAbuse(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateServiceAccountAbuse failed: %v", err)
	}
	if alert == nil {
		t.Fatal("expected alert for service account with browser user agent")
	}
	if alert.Severity != SeverityHigh {
		t.Errorf("expected HIGH severity, got %s", alert.Severity)
	}
	if alert.Metadata["action"] != "revoke" {
		t.Errorf("expected revoke action, got %v", alert.Metadata["action"])
	}
}

func TestEvaluateServiceAccountAbuse_NoTrigger_HumanAccount(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "john.doe", // not a service account
		UserAgent: "Mozilla/5.0 Chrome/120.0",
		Timestamp: time.Now(),
	}

	alert, err := evaluateServiceAccountAbuse(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateServiceAccountAbuse failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for human user account")
	}
}

func TestEvaluateServiceAccountAbuse_NoTrigger_BotUA(t *testing.T) {
	store := newMockUEBAStore()

	event := SecurityEvent{
		Type:      "auth",
		TenantID:  "t1",
		UserID:    "svc_deploy", // service account
		UserAgent: "orion-deploy-agent/1.0", // not a browser
		Timestamp: time.Now(),
	}

	alert, err := evaluateServiceAccountAbuse(context.Background(), event, store)
	if err != nil {
		t.Fatalf("evaluateServiceAccountAbuse failed: %v", err)
	}
	if alert != nil {
		t.Error("should not trigger for service account with non-browser user agent")
	}
}

func TestEvaluateServiceAccountAbuse_ServicePrefix(t *testing.T) {
	store := newMockUEBAStore()

	// Test different service account prefixes
	prefixes := []string{"svc_", "service_", "bot_"}
	for _, prefix := range prefixes {
		event := SecurityEvent{
			Type:      "auth",
			TenantID:  "t1",
			UserID:    prefix + "test",
			UserAgent: "Mozilla/5.0 Firefox/120.0",
			Timestamp: time.Now(),
		}

		alert, err := evaluateServiceAccountAbuse(context.Background(), event, store)
		if err != nil {
			t.Fatalf("evaluateServiceAccountAbuse failed for prefix %s: %v", prefix, err)
		}
		if alert == nil {
			t.Errorf("expected alert for service account with prefix %s", prefix)
		}
	}
}
