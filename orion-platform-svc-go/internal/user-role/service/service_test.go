package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/user-role/models"
	"orion/platform-svc-go/internal/user-role/repository"
)

// fakeRepo 是 Repository 的测试实现。
type fakeRepo struct {
	items map[string]*models.UserRole
	err   error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{items: make(map[string]*models.UserRole)}
}

func (f *fakeRepo) Create(ctx context.Context, ur *models.UserRole) error {
	if f.err != nil {
		return f.err
	}
	f.items[ur.ID] = ur
	return nil
}

func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.UserRole, error) {
	if ur, ok := f.items[id]; ok {
		if ur.TenantID == tenantID {
			return ur, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (f *fakeRepo) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.UserRole, int, error) {
	var out []models.UserRole
	for _, ur := range f.items {
		if ur.TenantID != tenantID {
			continue
		}
		if filter != nil {
			if filter.Status != nil && ur.Status != *filter.Status {
				continue
			}
			if filter.UserID != nil && ur.UserID != *filter.UserID {
				continue
			}
			if filter.Role != nil && ur.Role != *filter.Role {
				continue
			}
		}
		out = append(out, *ur)
	}
	return out, len(out), nil
}

func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, req *models.PatchRequest) error {
	ur, ok := f.items[id]
	if !ok {
		return repository.ErrNotFound
	}
	if req.Status != nil {
		ur.Status = *req.Status
		if *req.Status == models.StatusRevoked {
			now := time.Now()
			ur.RevokedAt = &now
		}
	}
	ur.UpdatedAt = time.Now()
	return nil
}

func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error {
	if _, ok := f.items[id]; !ok {
		return repository.ErrNotFound
	}
	ur := f.items[id]
	ur.Status = models.StatusRevoked
	now := time.Now()
	ur.RevokedAt = &now
	return nil
}

func (f *fakeRepo) RolesForUser(ctx context.Context, tenantID, userID string) ([]string, error) {
	var roles []string
	for _, ur := range f.items {
		if ur.TenantID != tenantID || ur.UserID != userID {
			continue
		}
		if ur.Status != models.StatusActive {
			continue
		}
		if ur.ExpiresAt != nil && time.Now().After(*ur.ExpiresAt) {
			continue
		}
		roles = append(roles, ur.Role)
	}
	return roles, nil
}

func (f *fakeRepo) UsersWithRole(ctx context.Context, tenantID, role string) ([]string, error) {
	var ids []string
	for _, ur := range f.items {
		if ur.TenantID != tenantID || ur.Role != role {
			continue
		}
		if ur.Status != models.StatusActive {
			continue
		}
		if ur.ExpiresAt != nil && time.Now().After(*ur.ExpiresAt) {
			continue
		}
		ids = append(ids, ur.UserID)
	}
	return ids, nil
}

func TestGrant_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, zap.NewNop())

	req := &models.GrantRequest{
		TenantID: "t1",
		UserID:   "u1",
		Role:     "triage_oncall",
	}
	ur, err := svc.Grant(context.Background(), req, nil)
	if err != nil {
		t.Fatalf("Grant failed: %v", err)
	}
	if ur.ID == "" {
		t.Error("expected ID to be set")
	}
	if ur.Status != models.StatusActive {
		t.Errorf("expected active, got %s", ur.Status)
	}
}

func TestGrant_MissingTenantID(t *testing.T) {
	svc := NewService(newFakeRepo(), zap.NewNop())
	_, err := svc.Grant(context.Background(), &models.GrantRequest{UserID: "u1", Role: "r"}, nil)
	if err == nil {
		t.Fatal("expected error for missing tenant_id")
	}
}

func TestList_Pagination(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, zap.NewNop())

	// Insert 3 records
	for _, role := range []string{"r1", "r2", "r3"} {
		_, _ = svc.Grant(context.Background(), &models.GrantRequest{
			TenantID: "t1",
			UserID:   "u1",
			Role:     role,
		}, nil)
	}

	result, err := svc.List(context.Background(), "t1", nil, 1, 10)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if result.Total != 3 {
		t.Errorf("expected 3 total, got %d", result.Total)
	}
	if len(result.Data) != 3 {
		t.Errorf("expected 3 items, got %d", len(result.Data))
	}
}

func TestList_FilterByStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, zap.NewNop())

	_, _ = svc.Grant(context.Background(), &models.GrantRequest{TenantID: "t1", UserID: "u1", Role: "r1"}, nil)
	_, _ = svc.Grant(context.Background(), &models.GrantRequest{TenantID: "t1", UserID: "u2", Role: "r1"}, nil)

	// Revoke second
	items, _ := svc.List(context.Background(), "t1", nil, 1, 10)
	if len(items.Data) < 2 {
		t.Fatal("need at least 2 items")
	}
	_ = svc.Delete(context.Background(), "t1", items.Data[1].ID)

	active := models.StatusActive
	result, _ := svc.List(context.Background(), "t1", &models.ListFilter{Status: &active}, 1, 10)
	if result.Total != 1 {
		t.Errorf("expected 1 active, got %d", result.Total)
	}
}

func TestPatch_InvalidStatus(t *testing.T) {
	svc := NewService(newFakeRepo(), zap.NewNop())
	_, err := svc.Patch(context.Background(), "t1", "id1", &models.PatchRequest{
		Status: strPtr("invalid"),
	})
	if err != ErrInvalidStatus {
		t.Errorf("expected ErrInvalidStatus, got %v", err)
	}
}

func TestHasRole_True(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, zap.NewNop())

	_, _ = svc.Grant(context.Background(), &models.GrantRequest{
		TenantID: "t1",
		UserID:   "u1",
		Role:     "triage_oncall",
	}, nil)

	has, err := svc.HasRole(context.Background(), "t1", "u1", "triage_oncall")
	if err != nil {
		t.Fatalf("HasRole failed: %v", err)
	}
	if !has {
		t.Error("expected HasRole to be true")
	}
}

func TestHasRole_ExpiredNotCounted(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, zap.NewNop())

	expiredAt := time.Now().Add(-1 * time.Hour)
	_, _ = svc.Grant(context.Background(), &models.GrantRequest{
		TenantID:  "t1",
		UserID:    "u1",
		Role:      "triage_oncall",
		ExpiresAt: &expiredAt,
	}, nil)

	has, _ := svc.HasRole(context.Background(), "t1", "u1", "triage_oncall")
	if has {
		t.Error("expected HasRole to be false for expired")
	}
}

func TestDelete_NotFound(t *testing.T) {
	svc := NewService(newFakeRepo(), zap.NewNop())
	err := svc.Delete(context.Background(), "t1", "nonexistent")
	if !errors.Is(err, repository.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func strPtr(s string) *string {
	return &s
}
