package orchestration_test

import (
	"testing"

	"orion/platform-svc-go/internal/orchestration/models"
	"orion/platform-svc-go/internal/orchestration/service"
)

func TestOrchestration_NewService(t *testing.T) {
	s := service.NewOrchestrationService(nil, nil)
	if s == nil {
		t.Fatal("NewOrchestrationService returned nil")
	}
}

func TestOrchestration_ModelsCompile(t *testing.T) {
	o := models.Orchestration{
		ID:   "orch-1",
		Name: "test",
	}
	if o.ID != "orch-1" {
		t.Fatal("unexpected orchestration")
	}
}

func TestOrchestration_PackageAvailable(t *testing.T) {
	_ = models.AgentConfig{}
	_ = models.OrchestrationRun{}
}
