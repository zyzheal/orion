package service

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/repository"
)

// The stub returned an empty Differences slice unconditionally; these tests
// assert the actual comparison, so a stub cannot pass them.
func TestCompareEnvironments_ReportsEveryDiffKind(t *testing.T) {
	repo := newMockConfigRepo()
	repo.configs["c-1"] = &models.Config{TenantID: "t-1", Key: "db.host", Environment: "dev", Value: "dev-db"}
	repo.configs["c-2"] = &models.Config{TenantID: "t-1", Key: "db.port", Environment: "dev", Value: "5432"}
	repo.configs["c-3"] = &models.Config{TenantID: "t-1", Key: "db.port", Environment: "prod", Value: "5433"}
	repo.configs["c-4"] = &models.Config{TenantID: "t-1", Key: "feature.new_ui", Environment: "prod", Value: "true"}
	// identical in both: must not appear
	repo.configs["c-5"] = &models.Config{TenantID: "t-1", Key: "log.level", Environment: "dev", Value: "info"}
	repo.configs["c-6"] = &models.Config{TenantID: "t-1", Key: "log.level", Environment: "prod", Value: "info"}
	// another tenant: must not appear
	repo.configs["c-7"] = &models.Config{TenantID: "t-2", Key: "db.host", Environment: "prod", Value: "x"}

	res, err := NewService(repo).CompareEnvironments(context.Background(), "t-1", "dev", "prod")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []models.ConfigDiff{
		{Key: "db.host", OldVal: "dev-db", Status: "removed"},
		{Key: "db.port", OldVal: "5432", NewVal: "5433", Status: "modified"},
		{Key: "feature.new_ui", NewVal: "true", Status: "added"},
	}
	if res.TotalCount != len(want) {
		t.Fatalf("TotalCount = %d, want %d", res.TotalCount, len(want))
	}
	if len(res.Differences) != len(want) {
		t.Fatalf("Differences = %+v", res.Differences)
	}
	for i, w := range want {
		if res.Differences[i] != w {
			t.Fatalf("Differences[%d] = %+v, want %+v", i, res.Differences[i], w)
		}
	}
	if res.SourceEnv != "dev" || res.TargetEnv != "prod" {
		t.Fatalf("envs = %q -> %q", res.SourceEnv, res.TargetEnv)
	}
}

func TestCompareEnvironments_NoDriftWhenTheValuesMatch(t *testing.T) {
	repo := newMockConfigRepo()
	repo.configs["c-1"] = &models.Config{TenantID: "t-1", Key: "a", Environment: "dev", Value: "1"}
	repo.configs["c-2"] = &models.Config{TenantID: "t-1", Key: "a", Environment: "prod", Value: "1"}
	res, err := NewService(repo).CompareEnvironments(context.Background(), "t-1", "dev", "prod")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.TotalCount != 0 || len(res.Differences) != 0 {
		t.Fatalf("TotalCount=%d Differences=%+v", res.TotalCount, res.Differences)
	}
	if res.Differences == nil {
		t.Fatal("Differences must be an empty slice, not nil, so the JSON body is [] and not null")
	}
}

func TestCompareEnvironments_RequiresBothEnvironments(t *testing.T) {
	svc := NewService(newMockConfigRepo())
	for _, tc := range []struct{ src, tgt string }{{"", ""}, {"dev", ""}, {"", "prod"}} {
		if _, err := svc.CompareEnvironments(context.Background(), "t-1", tc.src, tc.tgt); err == nil {
			t.Fatalf("src=%q tgt=%q: expected an error", tc.src, tc.tgt)
		}
	}
}

// pagingConfigRepo honours Page/PageSize, so the service cannot get away with a
// single List call.
type pagingConfigRepo struct {
	RepositoryInterface
	envConfigs map[string][]models.Config
	pagesByEnv map[string]int
}

func (r *pagingConfigRepo) List(_ context.Context, _ string, f repository.ConfigFilter) ([]models.Config, int, error) {
	r.pagesByEnv[f.Environment]++
	rows := r.envConfigs[f.Environment]
	ps := f.PageSize
	if ps <= 0 {
		ps = 20
	}
	start := f.Page * ps
	if start >= len(rows) {
		return []models.Config{}, len(rows), nil
	}
	end := start + ps
	if end > len(rows) {
		end = len(rows)
	}
	out := make([]models.Config, end-start)
	copy(out, rows[start:end])
	return out, len(rows), nil
}

// A single List call caps the scan at the first page; the keys past it would be
// reported as "removed" from the target environment, which is the opposite of
// the truth.
func TestCompareEnvironments_PagesThroughEveryConfig(t *testing.T) {
	rows := make([]models.Config, 0, 205)
	for i := 0; i < 205; i++ {
		rows = append(rows, models.Config{Key: fmt.Sprintf("k%03d", i), Value: "v"})
	}
	repo := &pagingConfigRepo{
		envConfigs: map[string][]models.Config{"dev": rows},
		pagesByEnv: map[string]int{},
	}
	res, err := NewService(repo).CompareEnvironments(context.Background(), "t-1", "dev", "prod")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.TotalCount != 205 {
		t.Fatalf("TotalCount = %d, want 205: keys past the first page were dropped", res.TotalCount)
	}
	if got := repo.pagesByEnv["dev"]; got != 2 {
		t.Fatalf("repo.List was called %d times for dev, want 2", got)
	}
}

// failingConfigRepo surfaces a repository outage on the very first read.
type failingConfigRepo struct {
	RepositoryInterface
	err error
}

func (r *failingConfigRepo) List(context.Context, string, repository.ConfigFilter) ([]models.Config, int, error) {
	return nil, 0, r.err
}

func TestCompareEnvironments_ReportsRepositoryErrors(t *testing.T) {
	svc := NewService(&failingConfigRepo{err: errors.New("db down")})
	if _, err := svc.CompareEnvironments(context.Background(), "t-1", "dev", "prod"); err == nil {
		t.Fatal("expected the repository error to surface, got nil")
	}
}
