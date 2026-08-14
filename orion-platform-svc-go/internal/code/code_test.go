package code_test

import (
	"context"
	"testing"
	"time"

	codecfg "orion/platform-svc-go/internal/code/config"
	"orion/platform-svc-go/internal/code/code-repo/models"
	"orion/platform-svc-go/internal/code/code-repo/service"
)

// fakeRepo implements CodeRepoRepository so the service can be exercised
// without PostgreSQL.
type fakeRepo struct{}

func (fakeRepo) List(ctx context.Context, tenantID string) ([]models.CodeRepo, error) { return nil, nil }
func (fakeRepo) Create(ctx context.Context, name, url, provider, token, tenantID string) (*models.CodeRepo, error) { return nil, nil }
func (fakeRepo) Get(ctx context.Context, id string) (*models.CodeRepo, error) { return nil, nil }
func (fakeRepo) Update(ctx context.Context, id, name, url, provider, token string) error { return nil }
func (fakeRepo) Delete(ctx context.Context, id string) error { return nil }
func (fakeRepo) ListBranches(ctx context.Context, repoID string) ([]models.Branch, error) { return nil, nil }
func (fakeRepo) ListCommits(ctx context.Context, repoID string, limit int) ([]models.Commit, error) { return nil, nil }

// TestCode_NewService_Nil verifies that a service accepts a non-nil
// repository and returns a valid service instance.  (It also documents that
// passing nil is the caller's responsibility to avoid.)
func TestCode_NewService_Nil(t *testing.T) {
	svc := service.NewCodeRepoService(fakeRepo{})
	if svc == nil {
		t.Fatalf("NewCodeRepoService(fakeRepo) returned nil, want non-nil service")
	}
}

// TestCode_ContextDeadline verifies that the service forwards a cancelled
// context through to the underlying repository without panicking.
func TestCode_ContextDeadline(t *testing.T) {
	svc := service.NewCodeRepoService(fakeRepo{})
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	cancel() // cancel before the call

	_, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("List(cancelled ctx) returned error: %v", err)
	}
}

// TestCode_PackageAvailable verifies that the public types and helpers
// exported by the code module are usable in downstream code.
func TestCode_PackageAvailable(t *testing.T) {
	// code-repo models
	repo := models.CodeRepo{Name: "orion-core", URL: "https://github.com/orion/orion-core", Provider: "github", TenantID: "t1"}
	if repo.Name != "orion-core" || repo.Provider != "github" {
		t.Fatalf("CodeRepo fields: got (%s,%s), want (orion-core,github)", repo.Name, repo.Provider)
	}
	_ = models.Branch{ID: 1, RepoID: repo.ID, Name: "main", IsDefault: true}
	_ = models.Commit{SHA: "abc123", Message: "fix", Author: "a", Branch: "main", RepoID: repo.ID}

	// config loader defaults
	cfg := codecfg.Load()
	if cfg == nil {
		t.Fatal("Load() returned nil config")
	}
	if cfg.Port == "" {
		t.Fatal("Load() returned empty Port")
	}
}
