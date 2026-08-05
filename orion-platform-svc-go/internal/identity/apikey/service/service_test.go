package service

import (
	"testing"

	"orion/platform-svc-go/internal/identity/apikey/repository"
)

func TestNewServiceNotNil(t *testing.T) {
	svc := NewService(&repository.Repository{})
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestNewServiceWithNilRepo(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}
