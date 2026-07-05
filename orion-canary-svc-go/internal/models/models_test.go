package models

import (
	"testing"
	"time"
)

func TestCanary_Fields(t *testing.T) {
	now := time.Now()
	canary := Canary{
		ID:           "canary-1",
		TenantID:     "tenant-1",
		DeploymentID: "deploy-1",
		ServiceName:  "user-svc",
		Version:      "v1.0.0",
		Status:       CanaryPending,
		Weight:       10,
		TargetWeight: 100,
		StartedAt:    nil,
		CompletedAt:  nil,
		CreatedAt:    now,
	}

	if canary.ID != "canary-1" {
		t.Errorf("expected ID 'canary-1', got '%s'", canary.ID)
	}
	if canary.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", canary.TenantID)
	}
	if canary.ServiceName != "user-svc" {
		t.Errorf("expected ServiceName 'user-svc', got '%s'", canary.ServiceName)
	}
	if canary.Status != CanaryPending {
		t.Errorf("expected Status 'pending', got '%s'", canary.Status)
	}
	if canary.Weight != 10 {
		t.Errorf("expected Weight 10, got %d", canary.Weight)
	}
}

func TestCanaryStatus_Constants(t *testing.T) {
	if CanaryPending != "pending" {
		t.Errorf("expected CanaryPending = 'pending', got '%s'", CanaryPending)
	}
	if CanaryRunning != "running" {
		t.Errorf("expected CanaryRunning = 'running', got '%s'", CanaryRunning)
	}
	if CanarySuccess != "success" {
		t.Errorf("expected CanarySuccess = 'success', got '%s'", CanarySuccess)
	}
	if CanaryFailed != "failed" {
		t.Errorf("expected CanaryFailed = 'failed', got '%s'", CanaryFailed)
	}
	if CanaryRolled != "rolled_back" {
		t.Errorf("expected CanaryRolled = 'rolled_back', got '%s'", CanaryRolled)
	}
}

func TestCanaryMetric_Fields(t *testing.T) {
	now := time.Now()
	metric := CanaryMetric{
		ID:         "metric-1",
		CanaryID:   "canary-1",
		MetricName: "error_rate",
		Value:      0.05,
		Source:     "prometheus",
		Timestamp:  now,
	}

	if metric.ID != "metric-1" {
		t.Errorf("expected ID 'metric-1', got '%s'", metric.ID)
	}
	if metric.CanaryID != "canary-1" {
		t.Errorf("expected CanaryID 'canary-1', got '%s'", metric.CanaryID)
	}
	if metric.MetricName != "error_rate" {
		t.Errorf("expected MetricName 'error_rate', got '%s'", metric.MetricName)
	}
	if metric.Value != 0.05 {
		t.Errorf("expected Value 0.05, got %f", metric.Value)
	}
}

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := PaginatedRequest{}

	offset := p.Offset()
	if offset != 0 {
		t.Errorf("expected offset 0, got %d", offset)
	}

	limit := p.Limit()
	if limit != 20 {
		t.Errorf("expected limit 20, got %d", limit)
	}
}
