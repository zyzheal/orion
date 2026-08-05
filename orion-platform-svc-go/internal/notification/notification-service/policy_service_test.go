package service

import (
	"testing"
)

func TestNewPolicyService(t *testing.T) {
	svc := NewPolicyService(nil, nil)
	if svc == nil {
		t.Fatalf("NewPolicyService returned nil")
	}
}

func TestPolicyServiceNotNil(t *testing.T) {
	_ = NewPolicyService(nil, nil)
}
