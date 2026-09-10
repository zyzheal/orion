package service_test

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/middleware-ops/models"
	"orion/platform-svc-go/internal/middleware-ops/service"
)

// fakeRepo is an in-memory RepositoryInterface for the derived-stat methods.
type fakeRepo struct {
	records []models.Record
	nextID  int
}

func (f *fakeRepo) seed(rs ...models.Record) {
	f.records = append(f.records, rs...)
}

func (f *fakeRepo) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	f.nextID++
	now := time.Now().UTC()
	rec := models.Record{
		ID:        "rec-" + string(rune('a'+f.nextID-1)),
		TenantID:  tenantID,
		Name:      req.Name,
		Status:    req.Status,
		Metadata:  req.Config,
		CreatedAt: now,
		UpdatedAt: now,
	}
	f.records = append(f.records, rec)
	return &rec, nil
}

func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error {
	for i, r := range f.records {
		if r.ID == id {
			f.records = append(f.records[:i], f.records[i+1:]...)
			return nil
		}
	}
	return nil
}

func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	for _, r := range f.records {
		if r.ID == id && r.TenantID == tenantID {
			return &r, nil
		}
	}
	return nil, nil
}

func (f *fakeRepo) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var out []models.Record
	for _, r := range f.records {
		if r.TenantID == tenantID {
			out = append(out, r)
		}
	}
	return out, nil
}

func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	for i := range f.records {
		if f.records[i].ID == id {
			f.records[i].Name = req.Name
			return &f.records[i], nil
		}
	}
	return nil, nil
}

var _ service.RepositoryInterface = (*fakeRepo)(nil)

func TestGetStats_DerivedFromRecords(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{ID: "r1", TenantID: "t1", Name: "gateway", Status: models.StatusActive, CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r2", TenantID: "t1", Name: "queue", Status: "degraded", CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r3", TenantID: "t1", Name: "", CreatedAt: now, UpdatedAt: now},
	)
	svc := service.NewService(repo)

	stats, err := svc.GetStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats["total"] != 3 {
		t.Errorf("total = %v, want 3", stats["total"])
	}
	// The empty-status record counts as active via the statusOf default.
	if stats["active"] != 2 {
		t.Errorf("active = %v, want 2", stats["active"])
	}
	if stats["inactive"] != 1 {
		t.Errorf("inactive = %v, want 1", stats["inactive"])
	}
	byStatus, ok := stats["byStatus"].(map[string]int)
	if !ok {
		t.Fatalf("byStatus type = %T", stats["byStatus"])
	}
	if byStatus["active"] != 2 || byStatus["degraded"] != 1 {
		t.Errorf("byStatus = %v", byStatus)
	}
	names, _ := stats["names"].([]string)
	if len(names) != 2 || names[0] != "gateway" || names[1] != "queue" {
		t.Errorf("names = %v, want [gateway queue]", names)
	}
}

func TestGetStats_Empty(t *testing.T) {
	svc := service.NewService(&fakeRepo{})
	stats, err := svc.GetStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats["total"] != 0 {
		t.Errorf("total = %v, want 0", stats["total"])
	}
	byStatus, ok := stats["byStatus"].(map[string]int)
	if !ok || len(byStatus) != 0 {
		t.Errorf("byStatus = %v, want non-nil empty map", byStatus)
	}
}

func TestGetConfig_AggregatesMetadata(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{
			ID: "r1", TenantID: "t1", Name: "gateway",
			Metadata:  map[string]interface{}{"replicas": 3},
			CreatedAt: now, UpdatedAt: now.Add(-2 * time.Hour),
		},
		models.Record{
			ID: "r2", TenantID: "t1", Name: "queue",
			CreatedAt: now, UpdatedAt: now.Add(-time.Hour),
		},
	)
	svc := service.NewService(repo)

	cfg, err := svc.GetConfig(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if cfg["count"] != 1 {
		t.Errorf("count = %v, want 1 (only metadata-bearing records)", cfg["count"])
	}
	entries, ok := cfg["entries"].(map[string]interface{})
	if !ok {
		t.Fatalf("entries type = %T", cfg["entries"])
	}
	gw, ok := entries["gateway"].(map[string]interface{})
	if !ok || gw["replicas"] != 3 {
		t.Errorf("entries[gateway] = %v, want replicas=3", entries["gateway"])
	}
	if _, ok := entries["queue"]; ok {
		t.Error("entries should not contain queue (no metadata)")
	}
	if cfg["updated"] == "" {
		t.Error("updated should be set from the most recent record")
	}
	if cfg["source"] != "middleware_ops_records" {
		t.Errorf("source = %v", cfg["source"])
	}
}

func TestGetMetrics_AgeSeries(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{ID: "r1", TenantID: "t1", Name: "a", Status: models.StatusActive, CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
		models.Record{ID: "r2", TenantID: "t1", Name: "b", Status: models.StatusActive, CreatedAt: now.Add(-4 * time.Hour), UpdatedAt: now},
		models.Record{ID: "r3", TenantID: "t1", Name: "c", Status: "down", CreatedAt: now.Add(-6 * time.Hour), UpdatedAt: now},
	)
	svc := service.NewService(repo)

	metrics, err := svc.GetMetrics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if metrics["total"] != 3 || metrics["active"] != 2 || metrics["inactive"] != 1 {
		t.Errorf("counts = total %v active %v inactive %v", metrics["total"], metrics["active"], metrics["inactive"])
	}
	avg, ok := metrics["avgAgeSeconds"].(float64)
	if !ok || avg <= 0 {
		t.Errorf("avgAgeSeconds = %v, want > 0", metrics["avgAgeSeconds"])
	}
	if metrics["oldestCreated"] == "" || metrics["latestCreated"] == "" {
		t.Errorf("timestamps missing: oldest=%v latest=%v", metrics["oldestCreated"], metrics["latestCreated"])
	}
}

func TestGetMetrics_ZeroAgeWhenCreatedAtZero(t *testing.T) {
	repo := &fakeRepo{}
	repo.seed(models.Record{ID: "r1", TenantID: "t1", Name: "a", Status: models.StatusActive})
	svc := service.NewService(repo)

	metrics, err := svc.GetMetrics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if avg, _ := metrics["avgAgeSeconds"].(float64); avg != 0 {
		t.Errorf("avgAgeSeconds = %v, want 0 when no timestamps", avg)
	}
	if metrics["oldestCreated"] != "" {
		t.Errorf("oldestCreated = %v, want empty", metrics["oldestCreated"])
	}
}

func TestForecast_LinearProjection(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{ID: "r1", TenantID: "t1", Name: "a", Status: models.StatusActive, CreatedAt: now.Add(-48 * time.Hour), UpdatedAt: now},
		models.Record{ID: "r2", TenantID: "t1", Name: "b", Status: models.StatusActive, CreatedAt: now.Add(-24 * time.Hour), UpdatedAt: now},
		models.Record{ID: "r3", TenantID: "t1", Name: "c", Status: models.StatusActive, CreatedAt: now.Add(-1 * time.Hour), UpdatedAt: now},
	)
	svc := service.NewService(repo)

	fc, err := svc.Forecast(context.Background(), "t1")
	if err != nil {
		t.Fatalf("Forecast: %v", err)
	}
	if fc["current"] != 3 || fc["active"] != 3 {
		t.Errorf("current=%v active=%v", fc["current"], fc["active"])
	}
	rate, ok := fc["perDay"].(float64)
	if !ok || rate <= 0 {
		t.Errorf("perDay = %v, want > 0 for 3 records over ~48h", fc["perDay"])
	}
	proj, ok := fc["projected"].(int)
	if !ok || proj < 3 {
		t.Errorf("projected = %v, want >= current", fc["projected"])
	}
	if fc["windowHours"] != 24 {
		t.Errorf("windowHours = %v", fc["windowHours"])
	}
	share, _ := fc["activeShare"].(float64)
	if share != 1.0 {
		t.Errorf("activeShare = %v, want 1.0", share)
	}
}

func TestForecast_EmptySet(t *testing.T) {
	svc := service.NewService(&fakeRepo{})
	fc, err := svc.Forecast(context.Background(), "t1")
	if err != nil {
		t.Fatalf("Forecast: %v", err)
	}
	if fc["current"] != 0 || fc["projected"] != 0 {
		t.Errorf("current=%v projected=%v, want 0", fc["current"], fc["projected"])
	}
	if rate, _ := fc["perDay"].(float64); rate != 0 {
		t.Errorf("perDay = %v, want 0 for empty window", rate)
	}
	if share, _ := fc["activeShare"].(float64); share != 0 {
		t.Errorf("activeShare = %v, want 0 (no div-by-zero)", share)
	}
}

func TestGetUtilization_ShareOfActive(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{ID: "r1", TenantID: "t1", Name: "a", Status: models.StatusActive, CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r2", TenantID: "t1", Name: "b", Status: "down", CreatedAt: now, UpdatedAt: now},
	)
	svc := service.NewService(repo)

	u, err := svc.GetUtilization(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetUtilization: %v", err)
	}
	if u["total"] != 2 || u["active"] != 1 || u["inactive"] != 1 {
		t.Errorf("counts = total %v active %v inactive %v", u["total"], u["active"], u["inactive"])
	}
	share, ok := u["utilization"].(float64)
	if !ok || share < 0.49 || share > 0.51 {
		t.Errorf("utilization = %v, want ~0.5", u["utilization"])
	}
}

func TestGetCoverage_UncoveredNames(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{ID: "r1", TenantID: "t1", Name: "gateway", Status: models.StatusActive, CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r2", TenantID: "t1", Name: "queue", Status: "paused", CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r3", TenantID: "t1", Name: "bus", Status: "paused", CreatedAt: now, UpdatedAt: now},
	)
	svc := service.NewService(repo)

	cov, err := svc.GetCoverage(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetCoverage: %v", err)
	}
	if cov["covered"] != 1 || cov["uncovered"] != 2 {
		t.Errorf("covered=%v uncovered=%v", cov["covered"], cov["uncovered"])
	}
	share, _ := cov["coverage"].(float64)
	if share < 0.32 || share > 0.34 {
		t.Errorf("coverage = %v, want ~0.33", share)
	}
	uncovered, _ := cov["uncoveredNames"].([]string)
	if len(uncovered) != 2 || uncovered[0] != "queue" || uncovered[1] != "bus" {
		t.Errorf("uncoveredNames = %v", uncovered)
	}
}

func TestGetCoverage_RoundsShareToFourDecimals(t *testing.T) {
	// 1 active of 3 must round to 0.3333 rather than 0.3333333333333333.
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(
		models.Record{ID: "r1", TenantID: "t1", Name: "a", Status: models.StatusActive, CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r2", TenantID: "t1", Name: "b", Status: "down", CreatedAt: now, UpdatedAt: now},
		models.Record{ID: "r3", TenantID: "t1", Name: "c", Status: "down", CreatedAt: now, UpdatedAt: now},
	)
	svc := service.NewService(repo)

	cov, err := svc.GetCoverage(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetCoverage: %v", err)
	}
	if cov["coverage"] != 0.3333 {
		t.Errorf("coverage = %v, want 0.3333", cov["coverage"])
	}
}

func TestDerivedMethods_SafeOnEmptyRepo(t *testing.T) {
	svc := service.NewService(&fakeRepo{})
	ctx := context.Background()
	if _, err := svc.GetStats(ctx, "t1"); err != nil {
		t.Fatalf("GetStats on empty repo: %v", err)
	}
	if _, err := svc.GetUtilization(ctx, "t1"); err != nil {
		t.Fatalf("GetUtilization on empty repo: %v", err)
	}
	if _, err := svc.GetCoverage(ctx, "t1"); err != nil {
		t.Fatalf("GetCoverage on empty repo: %v", err)
	}
	if _, err := svc.GetMetrics(ctx, "t1"); err != nil {
		t.Fatalf("GetMetrics on empty repo: %v", err)
	}
	if _, err := svc.Forecast(ctx, "t1"); err != nil {
		t.Fatalf("Forecast on empty repo: %v", err)
	}
	if _, err := svc.GetConfig(ctx, "t1"); err != nil {
		t.Fatalf("GetConfig on empty repo: %v", err)
	}
}
