package service

import "testing"

func TestNewComplianceServiceNotNil(t *testing.T) {
	svc := NewComplianceService()
	if svc == nil {
		t.Fatal("NewComplianceService returned nil")
	}
}
