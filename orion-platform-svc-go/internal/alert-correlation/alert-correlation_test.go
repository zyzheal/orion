package alert_correlation_test

import (
	"testing"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/alert-correlation/models"
	"orion/platform-svc-go/internal/alert-correlation/service"
)

func TestAlertCorrelation_NewService(t *testing.T) {
	s := service.NewAlertCorrelationService(nil, nil)
	if s == nil {
		t.Fatal("NewAlertCorrelationService returned nil")
	}
}

func TestAlertCorrelation_ModelsCompile(t *testing.T) {
	g := models.CorrelationGroup{
		ID:         uuid.New(),
		GroupType:  "temporal",
		Confidence: 0.85,
	}
	if g.GroupType != "temporal" {
		t.Fatal("unexpected group")
	}
}

func TestAlertCorrelation_PackageAvailable(t *testing.T) {
	_ = models.CorrelationRule{}
	_ = models.CorrelationResult{}
}
