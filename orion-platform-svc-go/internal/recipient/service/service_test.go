package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/recipient/models"
	"orion/platform-svc-go/internal/recipient/resolver"
)

// 简单 resolver 实现，用于测试。
type fakeUserResolver struct{}

func (r *fakeUserResolver) Kind() models.Kind { return models.KindUser }
func (r *fakeUserResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	ids := spec.ParamStringSlice("user_ids")
	if len(ids) == 0 {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: user_ids is required")
	}
	users := make([]models.ResolvedUser, len(ids))
	for i, id := range ids {
		users[i] = models.ResolvedUser{UserID: id, Role: "member"}
	}
	return users, nil
}

func newTestRegistry() *resolver.Registry {
	reg := resolver.NewRegistry()
	reg.Register(&fakeUserResolver{})
	return reg
}

func TestValidate_NilSpec(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	if err := svc.Validate(nil); err != ErrSpecInvalid {
		t.Errorf("expected ErrSpecInvalid, got %v", err)
	}
}

func TestValidate_EmptyKind(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	err := svc.Validate(&models.RecipientSpec{TenantID: "t1"})
	if err != ErrSpecInvalid {
		t.Errorf("expected ErrSpecInvalid, got %v", err)
	}
}

func TestValidate_MissingTenantID(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	err := svc.Validate(&models.RecipientSpec{Kind: models.KindUser})
	if err != ErrParamMissing {
		t.Errorf("expected ErrParamMissing, got %v", err)
	}
}

func TestValidate_UnknownKind(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	err := svc.Validate(&models.RecipientSpec{
		Kind:     models.Kind("unknown"),
		TenantID: "t1",
	})
	if err != ErrKindUnknown {
		t.Errorf("expected ErrKindUnknown, got %v", err)
	}
}

func TestValidate_ValidSpec(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	err := svc.Validate(&models.RecipientSpec{
		Kind:     models.KindUser,
		TenantID: "t1",
	})
	if err != nil {
		t.Errorf("expected nil, got %v", err)
	}
}

func TestResolve_UserKind(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	spec := &models.RecipientSpec{
		Kind:     models.KindUser,
		TenantID: "t1",
		Params:   map[string]any{"user_ids": []string{"u1", "u2", "u3"}},
	}
	result, err := svc.Resolve(context.Background(), spec)
	if err != nil {
		t.Fatalf("Resolve failed: %v", err)
	}
	if len(result.ResolvedUsers) != 3 {
		t.Errorf("expected 3 users, got %d", len(result.ResolvedUsers))
	}
	if result.SpecKind != models.KindUser {
		t.Errorf("expected kind=user, got %s", result.SpecKind)
	}
	if result.ResolvedUsers[0].UserID != "u1" {
		t.Errorf("expected first user u1, got %s", result.ResolvedUsers[0].UserID)
	}
}

func TestResolve_MissingParam(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	spec := &models.RecipientSpec{
		Kind:     models.KindUser,
		TenantID: "t1",
		Params:   map[string]any{},
	}
	_, err := svc.Resolve(context.Background(), spec)
	if err == nil {
		t.Error("expected error for missing user_ids")
	}
}

func TestKinds(t *testing.T) {
	svc := NewService(newTestRegistry(), zap.NewNop())
	kinds := svc.Kinds()
	if len(kinds) != 1 || kinds[0] != models.KindUser {
		t.Errorf("expected [user], got %v", kinds)
	}
}

// 测试 resolver 超时保护
type slowResolver struct{}

func (r *slowResolver) Kind() models.Kind { return models.KindBroadcast }
func (r *slowResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	select {
	case <-time.After(5 * time.Second):
		return nil, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func TestResolve_Timeout(t *testing.T) {
	// ResolveTimeout 是常量，通过传入已取消的 context 触发错误路径
	reg := resolver.NewRegistry()
	reg.Register(&slowResolver{})
	svc := NewService(reg, zap.NewNop())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	spec := &models.RecipientSpec{
		Kind:     models.KindBroadcast,
		TenantID: "t1",
	}
	_, err := svc.Resolve(ctx, spec)
	if err == nil {
		t.Error("expected error for cancelled context")
	}
}
