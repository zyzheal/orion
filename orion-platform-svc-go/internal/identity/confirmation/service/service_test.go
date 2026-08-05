package service

import (
	"testing"

	"orion/platform-svc-go/internal/identity/confirmation/repository"
)

func TestNewServiceNotNil(t *testing.T) {
	svc := NewService(&repository.Repository{})
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}
