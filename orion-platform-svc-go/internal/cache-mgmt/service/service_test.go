package service

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/cache-mgmt/models"
	"orion/platform-svc-go/internal/cache-mgmt/repository"
)

// fakeRepo satisfies RepositoryInterface for service tests. GetConfigByID always
// returns an enabled config so validateConfig passes and the call reaches the
// manager.
type fakeRepo struct{ err error }

func (f *fakeRepo) CreateConfig(ctx context.Context, cfg *models.CacheConfig) error { return f.err }
func (f *fakeRepo) GetConfigByID(ctx context.Context, tenantID, id string) (*models.CacheConfig, error) {
	return &models.CacheConfig{ID: id, TenantID: tenantID, Enabled: true}, f.err
}
func (f *fakeRepo) GetConfigStatsForUpdate(ctx context.Context, tenantID, id string) (*models.CacheConfig, error) {
	return nil, f.err
}
func (f *fakeRepo) ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.CacheConfig, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return f.err
}
func (f *fakeRepo) DeleteConfig(ctx context.Context, tenantID, id string) error { return f.err }
func (f *fakeRepo) IsEnabled(ctx context.Context, id string) (bool, error)      { return true, f.err }
func (f *fakeRepo) UpsertStats(ctx context.Context, s *models.CacheStats) error { return f.err }
func (f *fakeRepo) GetStatsByConfig(ctx context.Context, id string) ([]models.CacheStats, error) {
	return nil, f.err
}
func (f *fakeRepo) GetStatsByKey(ctx context.Context, configID, key string) (*models.CacheStats, error) {
	return nil, f.err
}
func (f *fakeRepo) DeleteStatsByConfig(ctx context.Context, configID string) error { return f.err }

// TestCacheOpsSurviveWithARealManager locks in the §65.1(c) fix: the handler
// routes Flush/EvictKey/Get/Set/Delete/ClearAll all dereference s.manager. The
// old wiring passed a nil manager, so any of these routes would panic with a
// nil pointer dereference on a locked mutex. Each call below is the kind that
// would crash the process before NewMethodCacheManager was wired in.
func TestCacheOpsSurviveWithARealManager(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	manager := NewMethodCacheManager((*repository.Repository)(nil), zap.NewNop())
	svc := NewService(repo, manager)

	if err := svc.SetCachedValue(ctx, "t", "cfg-1", "k1", "v1"); err == nil {
		t.Fatalf("SetCachedValue: expected an error (cache not built for cfg-1), got nil")
	}
	if _, err := svc.GetCachedValue(ctx, "t", "cfg-1", "k1"); err != nil {
		t.Fatalf("GetCachedValue returned unexpected error: %v", err)
	}
	if err := svc.EvictKey(ctx, "t", "cfg-1", "k1"); err == nil {
		t.Fatalf("EvictKey: expected an error (cache not built for cfg-1), got nil")
	}
	if err := svc.DeleteCachedValue(ctx, "t", "cfg-1", "k1"); err == nil {
		t.Fatalf("DeleteCachedValue: expected an error (cache not built for cfg-1), got nil")
	}
	if err := svc.Flush(ctx, "t", "cfg-1"); err == nil {
		t.Fatalf("Flush: expected an error (cache not built for cfg-1), got nil")
	}
	if err := svc.ClearAllCaches(ctx); err != nil {
		t.Fatalf("ClearAllCaches returned unexpected error: %v", err)
	}
	if k := svc.CacheKey("cfg-1", "Get", 1, "x"); k == "" {
		t.Errorf("CacheKey returned empty key")
	}
	if s := svc.Stats("cfg-1"); s == nil {
		t.Errorf("Stats returned nil")
	}
}

// TestNewServiceRejectsANilManager fails if a future change reintroduces the
// NewService(repo, nil) wiring. Without the check, a nil manager is accepted
// and only crashes later inside a handler, after the server has started.
// NewService also rejects a nil repo: the wiring would otherwise start and the
// first cache op would hit a nil *sqlx.DB.
func TestNewServiceRejectsANilManager(t *testing.T) {
	if s := NewService(&fakeRepo{}, nil); s != nil {
		t.Fatalf("NewService(nil manager) must return nil, got %v", s)
	}
	if s := NewService(nil, NewMethodCacheManager(nil, zap.NewNop())); s != nil {
		t.Fatalf("NewService(nil repo) must return nil, got %v", s)
	}
	if NewService(&fakeRepo{}, NewMethodCacheManager(nil, zap.NewNop())) == nil {
		t.Fatalf("NewService with a real repo and manager must not return nil")
	}
}

// TestService_ValidateConfigSurfacesRepositoryError pins that a repository
// failure is reported instead of silently proceeding to a manager call.
func TestService_ValidateConfigSurfacesRepositoryError(t *testing.T) {
	ctx := context.Background()
	want := errors.New("boom")
	svc := NewService(&fakeRepo{err: want}, NewMethodCacheManager(nil, zap.NewNop()))

	if _, err := svc.GetCachedValue(ctx, "t", "cfg-1", "k"); !errors.Is(err, want) {
		t.Errorf("GetCachedValue: got err %v, want %v", err, want)
	}
	if err := svc.Flush(ctx, "t", "cfg-1"); !errors.Is(err, want) {
		t.Errorf("Flush: got err %v, want %v", err, want)
	}
}
