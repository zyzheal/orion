package service

import (
	"testing"

	"orion/platform-svc-go/internal/security/ai-security/repository"
)

func TestNewServiceNotNil(t *testing.T) {
	svc := NewService(&repository.Repository{})
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestNewServiceNilRepo(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}
