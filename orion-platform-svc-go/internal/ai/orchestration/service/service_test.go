package service

import (
	"testing"

	"orion/platform-svc-go/internal/ai/orchestration/models"
)

func TestCreateValidation(t *testing.T) {
	svc := &OrchestrationService{}

	_, err := svc.Create(nil, "tenant-1", "test", "desc", nil)
	if err == nil {
		t.Error("expected error for nil agents, got nil")
	}

	_, err = svc.Create(nil, "tenant-1", "test", "desc", []models.AgentConfig{})
	if err == nil {
		t.Error("expected error for empty agents, got nil")
	}
}

func TestNewOrchestrationService(t *testing.T) {
	svc := NewOrchestrationService(nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}
