package service

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap"
)

func Test_NewFactory_NilRepo_NilLogger(t *testing.T) {
	f := NewFactory(nil, nil)
	if f == nil {
		t.Fatal("expected non-nil factory")
	}
	if f.repo != nil {
		t.Fatal("expected nil repo")
	}
	if f.handlerConstructors == nil {
		t.Fatal("expected non-nil handlerConstructors map")
	}
	if f.initialized == nil {
		t.Fatal("expected non-nil initialized map")
	}
}

func Test_NewFactory_WithLogger(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	if f == nil {
		t.Fatal("expected non-nil factory")
	}
	if f.logger != logger {
		t.Fatal("expected the provided logger")
	}
}

func Test_NewAdapterService_NilDeps(t *testing.T) {
	svc := NewAdapterService(nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil adapter service")
	}
	if svc.factory != nil {
		t.Fatal("expected nil factory")
	}
	if svc.repo != nil {
		t.Fatal("expected nil repo")
	}
}

func Test_AdapterHealth_NilDeps(t *testing.T) {
	svc := NewAdapterService(nil, nil)
	status, err := svc.AdapterHealth(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != "ok" {
		t.Fatalf("expected 'ok', got '%s'", status)
	}
}

func Test_EnsureID_EmptyString(t *testing.T) {
	id := ""
	EnsureID(&id)
	if id == "" {
		t.Fatal("expected non-empty UUID")
	}
	// Basic UUID format check: 8-4-4-4-12 = 36 chars
	if len(id) != 36 {
		t.Fatalf("expected UUID length 36, got %d", len(id))
	}
}

func Test_EnsureID_AlreadySet(t *testing.T) {
	id := "existing-uuid"
	EnsureID(&id)
	if id != "existing-uuid" {
		t.Fatalf("expected 'existing-uuid', got '%s'", id)
	}
}

func Test_strPtr(t *testing.T) {
	s := "hello"
	p := strPtr(s)
	if p == nil {
		t.Fatal("expected non-nil pointer")
	}
	if *p != "hello" {
		t.Fatalf("expected 'hello', got '%s'", *p)
	}
}

func Test_alertQueue_EnqueueDrain(t *testing.T) {
	q := newAlertQueue()
	alerts := []map[string]interface{}{
		{"title": "alert1"},
		{"title": "alert2"},
	}
	q.Enqueue(alerts...)

	drained := q.Drain()
	if len(drained) != 2 {
		t.Fatalf("expected 2 drained alerts, got %d", len(drained))
	}
	if drained[0]["title"] != "alert1" {
		t.Fatalf("expected 'alert1', got '%v'", drained[0]["title"])
	}
}

func Test_alertQueue_DrainEmpty(t *testing.T) {
	q := newAlertQueue()
	drained := q.Drain()
	if drained != nil {
		t.Fatalf("expected nil from empty drain, got %v", drained)
	}
}

func Test_noopHandler_ValidateConfig(t *testing.T) {
	h := &noopHandler{name: "test", atype: "test", category: "source"}
	err := h.ValidateConfig(context.Background(), map[string]string{"key": "val"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_noopHandler_Shutdown(t *testing.T) {
	h := &noopHandler{name: "test", atype: "test", category: "source"}
	err := h.Shutdown(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_PrometheusHandler_NameType(t *testing.T) {
	h := NewPrometheusHandler()
	if h.Name() != "Prometheus" {
		t.Fatalf("expected 'Prometheus', got '%s'", h.Name())
	}
	if h.Type() != "prometheus" {
		t.Fatalf("expected 'prometheus', got '%s'", h.Type())
	}
	if h.Category() != "source" {
		t.Fatalf("expected 'source', got '%s'", h.Category())
	}
}

func Test_PrometheusHandler_Initialize(t *testing.T) {
	h := NewPrometheusHandler()
	err := h.Initialize(context.Background(), map[string]string{
		"alertmanager_url": "http://localhost:9093",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_PrometheusHandler_SendReceive(t *testing.T) {
	h := NewPrometheusHandler()
	ctx := context.Background()

	// Send should be a no-op
	err := h.Send(ctx, map[string]interface{}{"title": "test"})
	if err != nil {
		t.Fatalf("unexpected error from Send: %v", err)
	}

	// Receive from empty queue returns nil
	alerts, err := h.Receive(ctx)
	if err != nil {
		t.Fatalf("unexpected error from Receive: %v", err)
	}
	if alerts != nil {
		t.Fatalf("expected nil alerts from empty queue, got %v", alerts)
	}
}

func Test_GrafanaHandler_NameType(t *testing.T) {
	h := NewGrafanaHandler()
	if h.Name() != "Grafana" {
		t.Fatalf("expected 'Grafana', got '%s'", h.Name())
	}
	if h.Type() != "grafana" {
		t.Fatalf("expected 'grafana', got '%s'", h.Type())
	}
}

func Test_EmailHandler_NameType(t *testing.T) {
	h := NewEmailHandler()
	if h.Name() != "Email" {
		t.Fatalf("expected 'Email', got '%s'", h.Name())
	}
	if h.Type() != "email" {
		t.Fatalf("expected 'email', got '%s'", h.Type())
	}
	if h.Category() != "notification" {
		t.Fatalf("expected 'notification', got '%s'", h.Category())
	}
}

func Test_EmailHandler_Send_NoOp(t *testing.T) {
	h := NewEmailHandler()
	err := h.Send(context.Background(), map[string]interface{}{"title": "test", "severity": "info"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_WebhookHandler_Send_NoURL(t *testing.T) {
	h := NewWebhookHandler()
	err := h.Send(context.Background(), map[string]interface{}{"title": "test"})
	if err != ErrInvalidConfig {
		t.Fatalf("expected ErrInvalidConfig, got %v", err)
	}
}

func Test_KafkaHandler_ValidateConfig_MissingBrokers(t *testing.T) {
	h := NewKafkaHandler()
	err := h.ValidateConfig(context.Background(), map[string]string{})
	if err == nil {
		t.Fatal("expected error for missing brokers")
	}
}

func Test_SMSHandler_Send_NoOp(t *testing.T) {
	h := NewSMSHandler()
	err := h.Send(context.Background(), map[string]interface{}{"title": "test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_WeChatHandler_NameType(t *testing.T) {
	h := NewWeChatHandler()
	if h.Name() != "WeChat" {
		t.Fatalf("expected 'WeChat', got '%s'", h.Name())
	}
	if h.Type() != "wechat" {
		t.Fatalf("expected 'wechat', got '%s'", h.Type())
	}
}

func Test_SlackHandler_NameType(t *testing.T) {
	h := NewSlackHandler()
	if h.Name() != "Slack" {
		t.Fatalf("expected 'Slack', got '%s'", h.Name())
	}
	if h.Type() != "slack" {
		t.Fatalf("expected 'slack', got '%s'", h.Type())
	}
}

func Test_PagerDutyHandler_NameType(t *testing.T) {
	h := NewPagerDutyHandler()
	if h.Name() != "PagerDuty" {
		t.Fatalf("expected 'PagerDuty', got '%s'", h.Name())
	}
	if h.Type() != "pagerduty" {
		t.Fatalf("expected 'pagerduty', got '%s'", h.Type())
	}
}

func Test_WebhookHandler_Initialize_DefaultMethod(t *testing.T) {
	h := NewWebhookHandler()
	err := h.Initialize(context.Background(), map[string]string{
		"url": "http://example.com/hook",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h.method != "POST" {
		t.Fatalf("expected default method 'POST', got '%s'", h.method)
	}
}

func Test_EmailHandler_Initialize_DefaultPort(t *testing.T) {
	h := NewEmailHandler()
	err := h.Initialize(context.Background(), map[string]string{
		"smtp_host": "smtp.example.com",
		"to":        "test@example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h.smtpPort != "587" {
		t.Fatalf("expected default port '587', got '%s'", h.smtpPort)
	}
}

func Test_AlertAdapterFactory_Register_EmptyType(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	// Register with empty type should be a no-op (not panic)
	f.Register("", nil)
}

func Test_AlertAdapterFactory_Register_NilConstructor(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	// Register with nil constructor should be a no-op
	f.Register("prometheus", nil)
}

func Test_AlertAdapterFactory_GetHandler_Unregistered(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	_, err := f.GetHandler("nonexistent")
	if err == nil {
		t.Fatal("expected error for unregistered handler")
	}
}

func Test_AlertAdapterFactory_RegisterAndGet(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	f.Register("prometheus", func() AlertAdapterHandler {
		return NewPrometheusHandler()
	})
	h, err := f.GetHandler("prometheus")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
	if h.Type() != "prometheus" {
		t.Fatalf("expected 'prometheus', got '%s'", h.Type())
	}
}

func Test_AlertAdapterFactory_GetHandler_CaseInsensitive(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	f.Register("prometheus", func() AlertAdapterHandler {
		return NewPrometheusHandler()
	})
	h, err := f.GetHandler("  PROMETHEUS  ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h.Type() != "prometheus" {
		t.Fatalf("expected 'prometheus', got '%s'", h.Type())
	}
}

func Test_AlertAdapterFactory_Shutdown_Empty(t *testing.T) {
	logger := zap.NewNop()
	f := NewFactory(nil, logger)
	err := f.Shutdown(context.Background())
	if err != nil {
		t.Fatalf("unexpected error from shutdown on empty factory: %v", err)
	}
}

func Test_AlertAdapterFactory_Shutdown_NilLogger(t *testing.T) {
	f := NewFactory(nil, nil)
	// Shutdown with nil logger should not panic
	err := f.Shutdown(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_AlertAdapterFactory_SendToAdapter_NilRepo(t *testing.T) {
	f := NewFactory(nil, nil)
	defer func() {
		if r := recover(); r != nil {
			t.Log("SendToAdapter with nil repo panicked as expected")
		}
	}()
	f.SendToAdapter(context.Background(), "adapter-1", map[string]interface{}{"title": "test"})
}

func Test_NewAlertQueue(t *testing.T) {
	q := newAlertQueue()
	if q == nil {
		t.Fatal("expected non-nil queue")
	}
}

// Test that time.Time behavior works correctly in service
func Test_TimeUTC(t *testing.T) {
	now := time.Now().UTC()
	if now.IsZero() {
		t.Fatal("expected non-zero UTC time")
	}
	// UTC time should have no offset
	if now != now.UTC() {
		t.Fatal("time should already be UTC")
	}
}
