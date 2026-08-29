package alert_adapter_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-adapter/models"
	svc "orion/platform-svc-go/internal/alert-adapter/service"
	"orion/platform-svc-go/internal/alert-adapter/service/spi"
)

// TestAlertAdapter_ModelsAndConstantsExist verifies that the models package
// exports the expected structs, request types, and validation maps.
func TestAlertAdapter_ModelsAndConstantsExist(t *testing.T) {
	now := time.Now().UTC()

	// Verify AlertAdapter struct is constructible and has expected fields.
	adapter := models.AlertAdapter{
		ID:        "test-id",
		TenantID:  "tenant-1",
		Name:      "prometheus-source",
		Type:      "prometheus",
		Category:  "source",
		Config:    `{"url":"http://localhost:9090"}`,
		Status:    "enabled",
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if adapter.ID != "test-id" {
		t.Fatalf("AlertAdapter.ID = %q, want %q", adapter.ID, "test-id")
	}
	if adapter.Type != "prometheus" {
		t.Fatalf("AlertAdapter.Type = %q, want %q", adapter.Type, "prometheus")
	}
	if !adapter.Enabled {
		t.Fatal("AlertAdapter.Enabled should be true")
	}

	// Verify AlertEvent struct is constructible.
	event := models.AlertEvent{
		ID:        "evt-1",
		TenantID:  "tenant-1",
		AdapterID: "test-id",
		Source:    "prometheus-test",
		Title:     "High CPU",
		Message:   "CPU > 90%",
		Severity:  "warning",
		Status:    "received",
		CreatedAt: now,
	}
	if event.Severity != "warning" {
		t.Fatalf("AlertEvent.Severity = %q, want %q", event.Severity, "warning")
	}
	if event.Title != "High CPU" {
		t.Fatalf("AlertEvent.Title = %q, want %q", event.Title, "High CPU")
	}

	// Verify CreateAdapterRequest.
	createReq := models.CreateAdapterRequest{
		Name:     "my-adapter",
		Type:     "webhook",
		Category: "notification",
		Config:   models.JSONB{"url": "http://example.com"},
	}
	if createReq.Name != "my-adapter" {
		t.Fatalf("CreateAdapterRequest.Name = %q, want %q", createReq.Name, "my-adapter")
	}

	// Verify UpdateAdapterRequest uses pointer fields.
	statusVal := "disabled"
	updateReq := models.UpdateAdapterRequest{
		Status: &statusVal,
	}
	if updateReq.Status == nil || *updateReq.Status != "disabled" {
		t.Fatal("UpdateAdapterRequest.Status should be pointer to 'disabled'")
	}
}

// TestAlertAdapter_ValidationMaps verifies that the package-level validation
// maps contain the expected adapter types, categories, statuses, and severities.
func TestAlertAdapter_ValidationMaps(t *testing.T) {
	// ValidAdapterTypes
	expectedTypes := []string{
		"prometheus", "zabbix", "grafana", "kafka",
		"webhook", "email", "sms", "wechat", "slack", "pagerduty",
	}
	for _, typ := range expectedTypes {
		if !models.ValidAdapterTypes[typ] {
			t.Errorf("ValidAdapterTypes missing %q", typ)
		}
	}
	if models.ValidAdapterTypes["invalid-type"] {
		t.Error("ValidAdapterTypes should not contain 'invalid-type'")
	}

	// ValidAdapterCategories
	expectedCategories := []string{"source", "notification", "export"}
	for _, cat := range expectedCategories {
		if !models.ValidAdapterCategories[cat] {
			t.Errorf("ValidAdapterCategories missing %q", cat)
		}
	}

	// ValidAdapterStatuses
	expectedStatuses := []string{"enabled", "disabled", "error"}
	for _, st := range expectedStatuses {
		if !models.ValidAdapterStatuses[st] {
			t.Errorf("ValidAdapterStatuses missing %q", st)
		}
	}

	// ValidSeverities
	expectedSeverities := []string{"info", "warning", "critical", "emergency"}
	for _, sev := range expectedSeverities {
		if !models.ValidSeverities[sev] {
			t.Errorf("ValidSeverities missing %q", sev)
		}
	}

	// ValidEventStatuses
	expectedEventStatuses := []string{"received", "processed", "failed"}
	for _, es := range expectedEventStatuses {
		if !models.ValidEventStatuses[es] {
			t.Errorf("ValidEventStatuses missing %q", es)
		}
	}
}

// TestAlertAdapter_SPIAndFactoryVerify verifies that the SPI interface,
// factory errors, and helper functions exist and behave correctly.
func TestAlertAdapter_SPIAndFactoryVerify(t *testing.T) {
	// Verify SPI severity constants match expected values.
	if spi.SeverityInfo != "info" {
		t.Fatalf("SeverityInfo = %q, want %q", spi.SeverityInfo, "info")
	}
	if spi.SeverityWarning != "warning" {
		t.Fatalf("SeverityWarning = %q, want %q", spi.SeverityWarning, "warning")
	}
	if spi.SeverityCritical != "critical" {
		t.Fatalf("SeverityCritical = %q, want %q", spi.SeverityCritical, "critical")
	}
	if spi.SeverityEmergency != "emergency" {
		t.Fatalf("SeverityEmergency = %q, want %q", spi.SeverityEmergency, "emergency")
	}

	// Verify AdapterStatus constants and IsHealthy.
	if spi.AdapterStatusNew != "new" {
		t.Fatalf("AdapterStatusNew = %q, want %q", spi.AdapterStatusNew, "new")
	}
	if spi.AdapterStatusRunning != "running" {
		t.Fatalf("AdapterStatusRunning = %q, want %q", spi.AdapterStatusRunning, "running")
	}
	if spi.AdapterStatusStopped != "stopped" {
		t.Fatalf("AdapterStatusStopped = %q, want %q", spi.AdapterStatusStopped, "stopped")
	}
	if spi.AdapterStatusError != "error" {
		t.Fatalf("AdapterStatusError = %q, want %q", spi.AdapterStatusError, "error")
	}
	if spi.AdapterStatusUnavailable != "unavailable" {
		t.Fatalf("AdapterStatusUnavailable = %q, want %q", spi.AdapterStatusUnavailable, "unavailable")
	}

	if !spi.AdapterStatusRunning.IsHealthy() {
		t.Fatal("AdapterStatusRunning.IsHealthy() should be true")
	}
	if spi.AdapterStatusStopped.IsHealthy() {
		t.Fatal("AdapterStatusStopped.IsHealthy() should be false")
	}

	// Verify AdapterInfo is constructible.
	info := spi.AdapterInfo{
		Name:    "Test Adapter",
		Type:    "prometheus",
		Status:  spi.AdapterStatusRunning,
		Enabled: true,
	}
	if info.Name != "Test Adapter" || !info.Enabled {
		t.Fatal("AdapterInfo construction failed")
	}

	// Verify Alert struct fields.
	alert := spi.Alert{
		ID:          "alert-1",
		TenantID:    "tenant-1",
		Title:       "Disk Full",
		Message:     "disk usage > 95%",
		Severity:    "critical",
		Source:      "node-exporter",
		Labels:      map[string]string{"host": "server-1"},
		Fingerprint: "abc123",
		GeneratedAt: "2026-08-14T10:00:00Z",
		Status:      "firing",
	}
	if alert.Severity != "critical" || alert.Labels["host"] != "server-1" {
		t.Fatal("Alert construction failed")
	}

	// Verify factory error variables exist and are non-nil.
	errs := map[string]error{
		"ErrInvalidType":     svc.ErrInvalidType,
		"ErrInvalidCategory": svc.ErrInvalidCategory,
		"ErrInvalidConfig":   svc.ErrInvalidConfig,
		"ErrInvalidStatus":   svc.ErrInvalidStatus,
		"ErrAdapterDisabled": svc.ErrAdapterDisabled,
		"ErrNoHandler":       svc.ErrNoHandler,
		"ErrAdapterNotFound": svc.ErrAdapterNotFound,
		"ErrInitFailed":      svc.ErrInitFailed,
		"ErrShutdownFailed":  svc.ErrShutdownFailed,
	}
	for name, err := range errs {
		if err == nil {
			t.Errorf("%s should be non-nil", name)
		}
	}

	// Verify EnsureID helper generates a UUID for empty string.
	emptyID := ""
	svc.EnsureID(&emptyID)
	if emptyID == "" {
		t.Fatal("EnsureID should generate a non-empty ID for empty string")
	}
	// UUIDs are 36 chars with dashes
	if len(emptyID) != 36 {
		t.Fatalf("EnsureID generated ID length = %d, want 36 (UUID)", len(emptyID))
	}
	if !strings.Contains(emptyID, "-") {
		t.Fatal("EnsureID generated ID should contain dashes (UUID format)")
	}

	// EnsureID should NOT overwrite an existing ID.
	existingID := "my-existing-id"
	svc.EnsureID(&existingID)
	if existingID != "my-existing-id" {
		t.Fatalf("EnsureID should not overwrite existing ID, got %q", existingID)
	}

	// Verify adapter conforms to spi.AlertAdapter interface using a minimal implementation.
	type testAdapter struct{}
	var _ spi.AlertAdapter = &testAdapterImpl{}

	// Verify context-aware methods work on the test implementation.
	ctx := context.Background()
	h, err := testAdapterImpl{}.Receive(ctx, nil)
	if err != nil {
		t.Fatalf("testAdapterImpl.Receive failed: %v", err)
	}
	if len(h) != 2 {
		t.Fatalf("testAdapterImpl.Receive should return 2 alerts, got %d", len(h))
	}
}

// testAdapterImpl is a minimal implementation of spi.AlertAdapter used for interface verification.
type testAdapterImpl struct{}

func (testAdapterImpl) Name() string { return "Test" }
func (testAdapterImpl) Type() string { return "test" }
func (testAdapterImpl) Receive(ctx context.Context, alerts []spi.Alert) ([]spi.Alert, error) {
	return []spi.Alert{
		{ID: "a1", Severity: spi.SeverityInfo},
		{ID: "a2", Severity: spi.SeverityWarning},
	}, nil
}
func (testAdapterImpl) Start(ctx context.Context, config map[string]string) (spi.AdapterStatus, error) {
	return spi.AdapterStatusRunning, nil
}
func (testAdapterImpl) Stop(ctx context.Context) (spi.AdapterStatus, error) {
	return spi.AdapterStatusStopped, nil
}
func (testAdapterImpl) HealthCheck(ctx context.Context) (spi.AdapterInfo, error) {
	return spi.AdapterInfo{Name: "Test", Type: "test", Status: spi.AdapterStatusRunning, Enabled: true}, nil
}
