package service

import (
	"testing"
)

func TestNewDNDService(t *testing.T) {
	svc := NewDNDService(nil, nil)
	if svc == nil {
		t.Fatalf("NewDNDService returned nil")
	}
}

func TestDNDServiceNotNil(t *testing.T) {
	_ = NewDNDService(nil, nil)
}
