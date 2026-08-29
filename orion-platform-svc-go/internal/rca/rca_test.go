package rca_test

import (
	"testing"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/rca/models"
	"orion/platform-svc-go/internal/rca/service"
)

func TestRCA_NewService(t *testing.T) {
	s := service.NewRCAService(nil, nil)
	if s == nil {
		t.Fatal("NewRCAService returned nil")
	}
}

func TestRCA_ModelsCompile(t *testing.T) {
	a := models.RCAAnalysis{
		ID:         uuid.New(),
		IncidentID: "inc-1",
		Status:     "running",
		Confidence: 0.75,
	}
	if a.IncidentID != "inc-1" {
		t.Fatal("unexpected analysis")
	}
}

func TestRCA_PackageAvailable(t *testing.T) {
	_ = models.RootCause{}
	_ = models.Fix{}
}
