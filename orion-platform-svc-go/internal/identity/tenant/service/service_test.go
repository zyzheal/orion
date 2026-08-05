package service

import (
	"testing"

	"go.uber.org/zap"
)

func TestNewTenantIsolationServiceNotNil(t *testing.T) {
	svc := NewTenantIsolationService(zap.NewNop())
	if svc == nil {
		t.Fatal("NewTenantIsolationService returned nil")
	}
}

func TestTenantIsolationEnable(t *testing.T) {
	svc := NewTenantIsolationService(zap.NewNop())
	svc.Enable()
	if !svc.IsEnabled() {
		t.Fatal("Enable() did not enable")
	}
}

func TestTenantIsolationDisable(t *testing.T) {
	svc := NewTenantIsolationService(zap.NewNop())
	svc.Disable()
	if svc.IsEnabled() {
		t.Fatal("Disable() did not disable")
	}
}
