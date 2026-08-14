package alert_adapter_v2_test

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-adapter-v2/handler"
	"orion/platform-svc-go/internal/alert-adapter-v2/models"
	"orion/platform-svc-go/internal/alert-adapter-v2/service"
)

// mockHandler is a no-op implementation of service.INotificationHandler
// used to verify the SPI interface contract at compile time.
type mockHandler struct{}

func (m *mockHandler) Channel() string {
	return "mock"
}

func (m *mockHandler) Initialize(ctx context.Context, config map[string]string) error {
	return nil
}

func (m *mockHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	return nil
}

func (m *mockHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	return nil
}

// ---------------------------------------------------------------------------

// TestAlertAdapterV2_ModelConstants validates that the models package exposes
// the expected sets of valid channels, adapter statuses, and event statuses.
func TestAlertAdapterV2_ModelConstants(t *testing.T) {
	expectedChannels := []string{
		"email", "sms", "wechat", "dingtalk", "feishu",
		"slack", "telegram", "pagerduty", "opsgenie",
		"webhook", "phone", "push", "in_app", "kafka", "rabbitmq",
	}
	for _, ch := range expectedChannels {
		if !models.ValidChannels[ch] {
			t.Errorf("expected channel %q to be valid", ch)
		}
	}
	if len(models.ValidChannels) < len(expectedChannels) {
		t.Errorf("ValidChannels has %d entries, expected at least %d",
			len(models.ValidChannels), len(expectedChannels))
	}

	expectedStatuses := []string{"enabled", "disabled", "error"}
	for _, s := range expectedStatuses {
		if !models.ValidAdapterStatuses[s] {
			t.Errorf("expected adapter status %q to be valid", s)
		}
	}

	expectedEventStatuses := []string{"queued", "sent", "failed", "delivered"}
	for _, s := range expectedEventStatuses {
		if !models.ValidEventStatuses[s] {
			t.Errorf("expected event status %q to be valid", s)
		}
	}
}

// TestAlertAdapterV2_ModelStructsAndPagination validates that the exported
// model structs have the expected fields and that PaginatedRequest methods
// compute offset/limit correctly.
func TestAlertAdapterV2_ModelStructsAndPagination(t *testing.T) {
	now := time.Now().UTC()

	adapter := models.AlertNotificationAdapter{
		ID:        "adapter-1",
		TenantID:  "tenant-1",
		Name:      "my-adapter",
		Channel:   "email",
		Config:    `{"to":"test@example.com"}`,
		Status:    "enabled",
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if adapter.ID != "adapter-1" || adapter.Channel != "email" || !adapter.Enabled {
		t.Error("AlertNotificationAdapter field assignment failed")
	}

	sentAt := now.Add(-1 * time.Minute)
	event := models.AlertNotificationEvent{
		ID:          "event-1",
		TenantID:    "tenant-1",
		AdapterID:   adapter.ID,
		AlertID:     "alert-1",
		Payload:     `{"rendered":"hi"}`,
		Status:      "delivered",
		SentAt:      &sentAt,
		DeliveredAt: &now,
		CreatedAt:   now,
	}
	if event.ID != "event-1" || event.Status != "delivered" {
		t.Error("AlertNotificationEvent field assignment failed")
	}

	tpl := models.AlertNotificationTemplate{
		ID:        "tpl-1",
		TenantID:  "tenant-1",
		Name:      "welcome-email",
		Channel:   "email",
		Template:  "Hello {{name}}, your alert {{alertId}} fired.",
		Variables: `["name","alertId"]`,
		CreatedAt: now,
	}
	if tpl.Template == "" {
		t.Error("AlertNotificationTemplate.Template should not be empty")
	}

	_ = models.CreateAdapterRequest{
		Name:    "new-adapter",
		Channel: "sms",
		Config:  `{"phone":"123"}`,
	}
	_ = models.UpdateAdapterRequest{
		Name: strPtr("renamed"),
	}
	_ = models.SendNotificationRequest{
		TemplateID: "tpl-1",
		AdapterID:  "adapter-1",
		AlertID:    "alert-1",
		Variables:  `{"name":"test"}`,
	}

	// PaginatedRequest defaults.
	p := &models.PaginatedRequest{}
	if p.Offset() != 0 {
		t.Errorf("default Offset() = %d, want 0", p.Offset())
	}
	if p.Limit() != 20 {
		t.Errorf("default Limit() = %d, want 20", p.Limit())
	}

	p = &models.PaginatedRequest{Page: 3, PageSize: 10}
	if p.Offset() != 20 {
		t.Errorf("Offset(page=3,pageSize=10) = %d, want 20", p.Offset())
	}
	if p.Limit() != 10 {
		t.Errorf("Limit(page=3,pageSize=10) = %d, want 10", p.Limit())
	}

	p = &models.PaginatedRequest{Page: 1, PageSize: 500}
	if p.Limit() != 100 {
		t.Errorf("Limit(pageSize=500) = %d, want 100", p.Limit())
	}
}

// TestAlertAdapterV2_HandlerAndServiceTypes validates that the handler and
// service package types and constructors are available and callable without
// a database connection.
func TestAlertAdapterV2_HandlerAndServiceTypes(t *testing.T) {
	// Verify mockHandler satisfies the INotificationHandler SPI at runtime.
	var h service.INotificationHandler = &mockHandler{}
	if h.Channel() != "mock" {
		t.Errorf("Channel() = %q, want %q", h.Channel(), "mock")
	}

	mh := &mockHandler{}
	if mh.Channel() != "mock" {
		t.Errorf("mockHandler.Channel() = %q, want %q", mh.Channel(), "mock")
	}

	ctx := context.Background()
	if err := mh.Initialize(ctx, map[string]string{"key": "val"}); err != nil {
		t.Error("mockHandler.Initialize should return nil")
	}
	if err := mh.Send(ctx, "hello", nil); err != nil {
		t.Error("mockHandler.Send should return nil")
	}
	if err := mh.ValidateConfig(ctx, nil); err != nil {
		t.Error("mockHandler.ValidateConfig should return nil")
	}

	// handler.NewHandler is callable with nil factory.
	adapterHandler := handler.NewHandler(nil)
	if adapterHandler == nil {
		t.Fatal("NewHandler(nil) returned nil")
	}
}

// strPtr returns a pointer to the given string.
func strPtr(s string) *string {
	return &s
}
