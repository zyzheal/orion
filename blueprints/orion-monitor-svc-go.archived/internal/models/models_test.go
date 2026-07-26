package models

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestMetric_Fields(t *testing.T) {
	now := time.Now()
	id := uuid.New()
	tenantID := uuid.New()
	tags := json.RawMessage(`{"env":"prod"}`)
	metric := Metric{
		ID:         id,
		TenantID:   tenantID,
		MetricName: "cpu_usage",
		Value:      75.5,
		Tags:       tags,
		Timestamp:  now,
		CreatedAt:  now,
	}

	if metric.ID != id {
		t.Errorf("expected ID %v, got %v", id, metric.ID)
	}
	if metric.TenantID != tenantID {
		t.Errorf("expected TenantID %v, got %v", tenantID, metric.TenantID)
	}
	if metric.MetricName != "cpu_usage" {
		t.Errorf("expected MetricName 'cpu_usage', got '%s'", metric.MetricName)
	}
	if metric.Value != 75.5 {
		t.Errorf("expected Value 75.5, got %f", metric.Value)
	}
}

func TestTrace_Fields(t *testing.T) {
	now := time.Now()
	id := uuid.New()
	tenantID := uuid.New()
	parentSpanID := "parent-span-1"
	trace := Trace{
		ID:            id,
		TenantID:      tenantID,
		TraceID:       "trace-1",
		SpanID:        "span-1",
		ParentSpanID:  &parentSpanID,
		ServiceName:   "user-svc",
		OperationName: "GET /api/users",
		Status:        "ok",
		DurationMs:    150,
		Attributes:    json.RawMessage(`{"http.method":"GET"}`),
		CreatedAt:     now,
	}

	if trace.ID != id {
		t.Errorf("expected ID %v, got %v", id, trace.ID)
	}
	if trace.TraceID != "trace-1" {
		t.Errorf("expected TraceID 'trace-1', got '%s'", trace.TraceID)
	}
	if trace.SpanID != "span-1" {
		t.Errorf("expected SpanID 'span-1', got '%s'", trace.SpanID)
	}
	if *trace.ParentSpanID != "parent-span-1" {
		t.Errorf("expected ParentSpanID 'parent-span-1', got '%s'", *trace.ParentSpanID)
	}
	if trace.ServiceName != "user-svc" {
		t.Errorf("expected ServiceName 'user-svc', got '%s'", trace.ServiceName)
	}
	if trace.DurationMs != 150 {
		t.Errorf("expected DurationMs 150, got %d", trace.DurationMs)
	}
}

func TestAlert_Fields(t *testing.T) {
	now := time.Now()
	id := uuid.New()
	tenantID := uuid.New()
	alert := Alert{
		ID:          id,
		TenantID:    tenantID,
		RuleName:    "high-cpu",
		Severity:    "critical",
		Status:      "firing",
		Description: "CPU usage exceeded 90%",
		TriggeredAt: now,
		ResolvedAt:  nil,
		CreatedAt:   now,
	}

	if alert.ID != id {
		t.Errorf("expected ID %v, got %v", id, alert.ID)
	}
	if alert.RuleName != "high-cpu" {
		t.Errorf("expected RuleName 'high-cpu', got '%s'", alert.RuleName)
	}
	if alert.Severity != "critical" {
		t.Errorf("expected Severity 'critical', got '%s'", alert.Severity)
	}
	if alert.Status != "firing" {
		t.Errorf("expected Status 'firing', got '%s'", alert.Status)
	}
	if alert.ResolvedAt != nil {
		t.Error("expected ResolvedAt to be nil")
	}
}

func TestAlertRule_Fields(t *testing.T) {
	now := time.Now()
	id := uuid.New()
	tenantID := uuid.New()
	rule := AlertRule{
		ID:                    id,
		TenantID:              tenantID,
		Name:                  "high-cpu",
		MetricName:            "cpu_usage",
		Operator:              ">",
		Threshold:             90.0,
		EvaluationIntervalSec: 60,
		IsEnabled:             true,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if rule.ID != id {
		t.Errorf("expected ID %v, got %v", id, rule.ID)
	}
	if rule.Name != "high-cpu" {
		t.Errorf("expected Name 'high-cpu', got '%s'", rule.Name)
	}
	if rule.MetricName != "cpu_usage" {
		t.Errorf("expected MetricName 'cpu_usage', got '%s'", rule.MetricName)
	}
	if rule.Operator != ">" {
		t.Errorf("expected Operator '>', got '%s'", rule.Operator)
	}
	if rule.Threshold != 90.0 {
		t.Errorf("expected Threshold 90.0, got %f", rule.Threshold)
	}
	if rule.EvaluationIntervalSec != 60 {
		t.Errorf("expected EvaluationIntervalSec 60, got %d", rule.EvaluationIntervalSec)
	}
	if !rule.IsEnabled {
		t.Error("expected IsEnabled to be true")
	}
}

func TestServiceOverview_Fields(t *testing.T) {
	now := time.Now()
	overview := ServiceOverview{
		ServiceName:   "user-svc",
		RequestCount:  1000,
		ErrorRate:     0.05,
		AvgDurationMs: 150.5,
		P95DurationMs: 300.0,
		P99DurationMs: 500.0,
		ActiveTraces:  10,
		LastSeen:      now,
	}

	if overview.ServiceName != "user-svc" {
		t.Errorf("expected ServiceName 'user-svc', got '%s'", overview.ServiceName)
	}
	if overview.RequestCount != 1000 {
		t.Errorf("expected RequestCount 1000, got %d", overview.RequestCount)
	}
	if overview.ErrorRate != 0.05 {
		t.Errorf("expected ErrorRate 0.05, got %f", overview.ErrorRate)
	}
	if overview.AvgDurationMs != 150.5 {
		t.Errorf("expected AvgDurationMs 150.5, got %f", overview.AvgDurationMs)
	}
}
