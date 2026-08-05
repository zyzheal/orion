package service

import (
	"testing"

	"orion/platform-svc-go/internal/identity/user/repository"
)

func TestNewUserServiceNotNil(t *testing.T) {
	svc := NewUserService(&repository.UserRepository{})
	if svc == nil {
		t.Fatal("NewUserService returned nil")
	}
}
