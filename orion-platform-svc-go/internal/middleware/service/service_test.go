package service_test

import (
	"context"
	"testing"

	msvc "orion/platform-svc-go/internal/middleware/service"
)

func TestService_NewService(t *testing.T) {
	t.Parallel()
	svc := msvc.NewService()
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}

func TestService_Context(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	_ = ctx
}
