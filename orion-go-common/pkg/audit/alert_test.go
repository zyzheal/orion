package audit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestAlertService_Dispatch(t *testing.T) {
	var webhookCalled int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&webhookCalled, 1)
		w.WriteHeader(200)
	}))
	defer server.Close()

	webhook := NewWebhookChannel(server.URL, nil)
	service := NewAlertService(webhook)

	alert := UEBAAlert{
		RuleID:    "test-rule",
		RuleName:  "Test Rule",
		Severity:  SeverityHigh,
		TenantID:  "t1",
		UserID:    "u1",
		Detail:    "test alert detail",
		Timestamp: time.Now(),
	}

	err := service.Dispatch(context.Background(), alert)
	if err != nil {
		t.Fatalf("Dispatch failed: %v", err)
	}

	if atomic.LoadInt32(&webhookCalled) != 1 {
		t.Errorf("expected webhook to be called once, got %d", atomic.LoadInt32(&webhookCalled))
	}
}

func TestAlertService_DispatchBatch(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&callCount, 1)
		w.WriteHeader(200)
	}))
	defer server.Close()

	webhook := NewWebhookChannel(server.URL, nil)
	service := NewAlertService(webhook)

	alerts := []UEBAAlert{
		{RuleID: "r1", TenantID: "t1", UserID: "u1", Timestamp: time.Now()},
		{RuleID: "r2", TenantID: "t1", UserID: "u1", Timestamp: time.Now()},
		{RuleID: "r3", TenantID: "t1", UserID: "u1", Timestamp: time.Now()},
	}

	err := service.DispatchBatch(context.Background(), alerts)
	if err != nil {
		t.Fatalf("DispatchBatch failed: %v", err)
	}

	if atomic.LoadInt32(&callCount) != 3 {
		t.Errorf("expected 3 webhook calls, got %d", atomic.LoadInt32(&callCount))
	}
}

func TestAlertService_MultipleChannels(t *testing.T) {
	var webhookCount, emailCount int32

	webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&webhookCount, 1)
		w.WriteHeader(200)
	}))
	defer webhookServer.Close()

	emailServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&emailCount, 1)
		w.WriteHeader(200)
	}))
	defer emailServer.Close()

	webhook := NewWebhookChannel(webhookServer.URL, nil)
	email := NewEmailChannel(emailServer.URL, "test-key")
	service := NewAlertService(webhook, email)

	if service.ChannelCount() != 2 {
		t.Errorf("expected 2 channels, got %d", service.ChannelCount())
	}

	alert := UEBAAlert{
		RuleID:    "test-rule",
		TenantID:  "t1",
		UserID:    "u1",
		Timestamp: time.Now(),
	}

	err := service.Dispatch(context.Background(), alert)
	if err != nil {
		t.Fatalf("Dispatch failed: %v", err)
	}

	if atomic.LoadInt32(&webhookCount) != 1 {
		t.Errorf("expected webhook called once, got %d", atomic.LoadInt32(&webhookCount))
	}
	if atomic.LoadInt32(&emailCount) != 1 {
		t.Errorf("expected email called once, got %d", atomic.LoadInt32(&emailCount))
	}
}

func TestAlertService_AddChannel(t *testing.T) {
	service := NewAlertService()
	if service.ChannelCount() != 0 {
		t.Errorf("expected 0 channels initially, got %d", service.ChannelCount())
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer server.Close()

	service.AddChannel(NewWebhookChannel(server.URL, nil))
	if service.ChannelCount() != 1 {
		t.Errorf("expected 1 channel after add, got %d", service.ChannelCount())
	}
}

func TestWebhookChannel_Send(t *testing.T) {
	var receivedAlert UEBAAlert
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected application/json content type, got %s", r.Header.Get("Content-Type"))
		}
		json.NewDecoder(r.Body).Decode(&receivedAlert)
		w.WriteHeader(200)
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, map[string]string{
		"X-Custom-Header": "test-value",
	})

	alert := UEBAAlert{
		RuleID:    "test-rule",
		RuleName:  "Test Rule",
		Severity:  SeverityHigh,
		TenantID:  "t1",
		UserID:    "u1",
		Detail:    "test detail",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}

	if receivedAlert.RuleID != "test-rule" {
		t.Errorf("expected rule ID 'test-rule', got '%s'", receivedAlert.RuleID)
	}
}

func TestWebhookChannel_Send_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	channel := NewWebhookChannel(server.URL, nil)
	alert := UEBAAlert{RuleID: "test", TenantID: "t1", Timestamp: time.Now()}

	err := channel.Send(context.Background(), alert)
	if err == nil {
		t.Error("expected error for 500 response")
	}
}

func TestWebhookChannel_Name(t *testing.T) {
	channel := NewWebhookChannel("http://localhost", nil)
	if channel.Name() != "webhook" {
		t.Errorf("expected 'webhook', got '%s'", channel.Name())
	}
}

func TestEmailChannel_Send(t *testing.T) {
	var receivedPath string
	var receivedPayload map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		json.NewDecoder(r.Body).Decode(&receivedPayload)
		w.WriteHeader(200)
	}))
	defer server.Close()

	channel := NewEmailChannel(server.URL, "test-api-key")

	alert := UEBAAlert{
		RuleID:    "test-rule",
		RuleName:  "Test Rule",
		Severity:  SeverityCritical,
		TenantID:  "t1",
		UserID:    "u1",
		Detail:    "critical alert",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}

	if receivedPath != "/api/notifications/email" {
		t.Errorf("expected path '/api/notifications/email', got '%s'", receivedPath)
	}
	if receivedPayload["type"] != "email" {
		t.Errorf("expected type 'email', got '%v'", receivedPayload["type"])
	}
}

func TestEmailChannel_Name(t *testing.T) {
	channel := NewEmailChannel("http://localhost", "")
	if channel.Name() != "email" {
		t.Errorf("expected 'email', got '%s'", channel.Name())
	}
}

func TestInAppChannel_Send(t *testing.T) {
	var receivedPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		w.WriteHeader(200)
	}))
	defer server.Close()

	channel := NewInAppChannel(server.URL, "")

	alert := UEBAAlert{
		RuleID:    "test-rule",
		RuleName:  "Test Rule",
		Severity:  SeverityMedium,
		TenantID:  "t1",
		UserID:    "u1",
		Timestamp: time.Now(),
	}

	err := channel.Send(context.Background(), alert)
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}

	if receivedPath != "/api/notifications/in-app" {
		t.Errorf("expected path '/api/notifications/in-app', got '%s'", receivedPath)
	}
}

func TestInAppChannel_Name(t *testing.T) {
	channel := NewInAppChannel("http://localhost", "")
	if channel.Name() != "in-app" {
		t.Errorf("expected 'in-app', got '%s'", channel.Name())
	}
}

func TestAlertService_Dispatch_PartialFailure(t *testing.T) {
	// One channel succeeds, one fails
	goodServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer goodServer.Close()

	badServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer badServer.Close()

	good := NewWebhookChannel(goodServer.URL, nil)
	bad := NewWebhookChannel(badServer.URL, nil)
	service := NewAlertService(good, bad)

	alert := UEBAAlert{RuleID: "test", TenantID: "t1", Timestamp: time.Now()}
	err := service.Dispatch(context.Background(), alert)
	if err == nil {
		t.Error("expected error when one channel fails")
	}
}

func TestAlertRouter_ExtendedRuleMapping(t *testing.T) {
	tests := []struct {
		ruleID   string
		expected SecurityAlertType
	}{
		{"excessive-denials", AlertTypePermissionDenial},
		{"unauthorized-attempt", AlertTypePermissionDenial},
		{"privilege-escalation-attempt", AlertTypePrivilegeEscalation},
		{"mass-data-export", AlertTypeAnomalousBehavior},
		{"service-account-abuse", AlertTypeAnomalousBehavior},
		{"off-hours-sensitive-access", AlertTypeAnomalousBehavior},
		{"api-pattern-anomaly", AlertTypeAnomalousBehavior},
		{"multi-location-login", AlertTypeAnomalousBehavior},
		{"cross-tenant-attempt", AlertTypeCrossTenant},
		{"unknown-rule", AlertTypeAnomalousBehavior},
	}

	for _, tt := range tests {
		result := mapUEBAToAlertType(tt.ruleID)
		if result != tt.expected {
			t.Errorf("mapUEBAToAlertType(%s): expected %s, got %s", tt.ruleID, tt.expected, result)
		}
	}
}
