package service_test

import (
	"context"
	"testing"

	acs "orion/platform-svc-go/internal/api-component/service"
)

func TestService_NewService(t *testing.T) {
	t.Parallel()
	svc := acs.NewService()
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}

func TestService_Context(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	_ = ctx
}
