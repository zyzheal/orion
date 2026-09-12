package service_test

import (
	"context"
	"strings"
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

// Update used to persist only the name, so no test could distinguish a real
// write from a dropped one. Status and metadata are the two fields this round's
// fixes depend on, so they have to land.
func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	for i := range f.records {
		if f.records[i].ID == id {
			f.records[i].Name = req.Name
			f.records[i].Status = req.Status
			f.records[i].Metadata = req.Config
			f.records[i].UpdatedAt = time.Now().UTC()
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

// ---------------------------------------------------------------------------
// Round 17: the routed write endpoints used to discard their input.
// ---------------------------------------------------------------------------

func TestUpdateConfig_WritesNewKeys(t *testing.T) {
	repo := &fakeRepo{}
	svc := service.NewService(repo)

	msg, err := svc.UpdateConfig(context.Background(), "t1", map[string]interface{}{
		"gateway": map[string]interface{}{"replicas": 3, "timeout": 30},
	})
	if err != nil {
		t.Fatalf("UpdateConfig: %v", err)
	}
	if msg != "config updated (1 created, 0 updated)" {
		t.Errorf("message = %q, want config updated (1 created, 0 updated)", msg)
	}
	if len(repo.records) != 1 {
		t.Fatalf("records = %d, want 1: the config must be persisted", len(repo.records))
	}
	rec := repo.records[0]
	if rec.Name != "gateway" {
		t.Errorf("name = %q, want gateway", rec.Name)
	}
	if rec.Status != models.StatusActive {
		t.Errorf("status = %q, want %q", rec.Status, models.StatusActive)
	}
	if rec.Metadata["replicas"] != 3 || rec.Metadata["timeout"] != 30 {
		t.Errorf("metadata = %v, want the submitted config", rec.Metadata)
	}
}

func TestUpdateConfig_UpdatesExistingKeyWithoutInserting(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(models.Record{
		ID: "r1", TenantID: "t1", Name: "gateway", Status: models.StatusActive,
		Metadata: map[string]interface{}{"replicas": 1}, CreatedAt: now, UpdatedAt: now,
	})
	svc := service.NewService(repo)

	msg, err := svc.UpdateConfig(context.Background(), "t1", map[string]interface{}{
		"gateway": map[string]interface{}{"replicas": 9},
	})
	if err != nil {
		t.Fatalf("UpdateConfig: %v", err)
	}
	if msg != "config updated (0 created, 1 updated)" {
		t.Errorf("message = %q, want config updated (0 created, 1 updated)", msg)
	}
	if len(repo.records) != 1 {
		t.Fatalf("records = %d, want 1: an existing key must not be re-inserted", len(repo.records))
	}
	if got := repo.records[0].Metadata["replicas"]; got != 9 {
		t.Errorf("replicas = %v, want 9", got)
	}
}

func TestUpdateConfig_RoundTripsThroughGetConfig(t *testing.T) {
	repo := &fakeRepo{}
	svc := service.NewService(repo)
	submitted := map[string]interface{}{
		"gateway": map[string]interface{}{"replicas": 3},
		"queue":   map[string]interface{}{"workers": 2},
	}
	if _, err := svc.UpdateConfig(context.Background(), "t1", submitted); err != nil {
		t.Fatalf("UpdateConfig: %v", err)
	}

	cfg, err := svc.GetConfig(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if cfg["count"] != 2 {
		t.Errorf("count = %v, want 2", cfg["count"])
	}
	entries, ok := cfg["entries"].(map[string]interface{})
	if !ok {
		t.Fatalf("entries type = %T", cfg["entries"])
	}
	gw, ok := entries["gateway"].(map[string]interface{})
	if !ok || gw["replicas"] != 3 {
		t.Errorf("entries[gateway] = %v, want replicas=3", entries["gateway"])
	}
	q, ok := entries["queue"].(map[string]interface{})
	if !ok || q["workers"] != 2 {
		t.Errorf("entries[queue] = %v, want workers=2", entries["queue"])
	}
}

func TestUpdateConfig_RejectsNonObjectValuesWithoutWriting(t *testing.T) {
	repo := &fakeRepo{}
	svc := service.NewService(repo)

	_, err := svc.UpdateConfig(context.Background(), "t1", map[string]interface{}{"limit": 100})
	if err == nil {
		t.Fatal("UpdateConfig must reject a scalar value, not silently reshape it")
	}
	if !strings.Contains(err.Error(), "must be an object") {
		t.Errorf("error = %v, want it to name the offending shape", err)
	}
	if len(repo.records) != 0 {
		t.Errorf("records = %d, want 0: validation must not leave a partial write", len(repo.records))
	}
}

func TestUpdateConfig_RejectsEmptyMap(t *testing.T) {
	repo := &fakeRepo{}
	svc := service.NewService(repo)
	if _, err := svc.UpdateConfig(context.Background(), "t1", map[string]interface{}{}); err == nil {
		t.Fatal("UpdateConfig must reject an empty config")
	}
	if len(repo.records) != 0 {
		t.Errorf("records = %d, want 0", len(repo.records))
	}
}

func TestGetStatus_DerivesFromRecords(t *testing.T) {
	cases := []struct {
		name string
		recs []models.Record
		want string
	}{
		{"empty tenant is idle", nil, "idle"},
		{"all active is running", []models.Record{
			{TenantID: "t1", Name: "a", Status: models.StatusActive},
		}, "running"},
		{"all inactive is stopped", []models.Record{
			{TenantID: "t1", Name: "a", Status: "down"},
			{TenantID: "t1", Name: "b", Status: "paused"},
		}, "stopped"},
		{"mixed is degraded", []models.Record{
			{TenantID: "t1", Name: "a", Status: models.StatusActive},
			{TenantID: "t1", Name: "b", Status: "down"},
		}, "degraded"},
		{"blank status counts as active", []models.Record{
			{TenantID: "t1", Name: "a", Status: ""},
		}, "running"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepo{}
			repo.seed(tc.recs...)
			svc := service.NewService(repo)
			got, err := svc.GetStatus(context.Background(), "t1")
			if err != nil {
				t.Fatalf("GetStatus: %v", err)
			}
			if got != tc.want {
				t.Errorf("GetStatus = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestGetStatusMiddleware_FollowsTheDerivedStatus(t *testing.T) {
	svc := service.NewService(&fakeRepo{})
	got, err := svc.GetStatusMiddleware(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetStatusMiddleware: %v", err)
	}
	if got != "idle" {
		t.Errorf("GetStatusMiddleware = %q, want idle for an empty tenant, not an unconditional healthy", got)
	}
}

func TestRestart_StampsTheRecordItWasAimedAt(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(models.Record{
		ID: "r1", TenantID: "t1", Name: "gateway", Status: models.StatusActive,
		Metadata: map[string]interface{}{"replicas": 3}, CreatedAt: now, UpdatedAt: now,
	})
	svc := service.NewService(repo)

	msg, err := svc.Restart(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("Restart: %v", err)
	}
	if !strings.Contains(msg, "restart requested at ") {
		t.Errorf("message = %q, want a timestamped restart confirmation", msg)
	}
	meta := repo.records[0].Metadata
	if _, ok := meta["lastRestartRequestedAt"]; !ok {
		t.Fatalf("metadata = %v, want a lastRestartRequestedAt stamp", meta)
	}
	if meta["replicas"] != 3 {
		t.Errorf("replicas = %v, want 3: existing metadata must be preserved", meta["replicas"])
	}
	if repo.records[0].Name != "gateway" || repo.records[0].Status != models.StatusActive {
		t.Errorf("name/status = %q/%q, want gateway/%s", repo.records[0].Name, repo.records[0].Status, models.StatusActive)
	}
}

func TestConfigure_StampsTheRecordItWasAimedAt(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(models.Record{ID: "r1", TenantID: "t1", Name: "queue", Status: models.StatusActive, CreatedAt: now, UpdatedAt: now})
	svc := service.NewService(repo)

	msg, err := svc.Configure(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("Configure: %v", err)
	}
	if !strings.Contains(msg, "configured at ") {
		t.Errorf("message = %q, want a timestamped configuration confirmation", msg)
	}
	if _, ok := repo.records[0].Metadata["lastConfiguredAt"]; !ok {
		t.Fatalf("metadata = %v, want a lastConfiguredAt stamp", repo.records[0].Metadata)
	}
}

func TestRestart_FailsOnUnknownRecord(t *testing.T) {
	svc := service.NewService(&fakeRepo{})
	if _, err := svc.Restart(context.Background(), "t1", "ghost"); err == nil {
		t.Fatal("Restart on an unknown record must fail, not report success")
	}
	if _, err := svc.Configure(context.Background(), "t1", "ghost"); err == nil {
		t.Fatal("Configure on an unknown record must fail, not report success")
	}
}

func TestEnablePlugin_PersistsActive(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(models.Record{
		ID: "r1", TenantID: "t1", Name: "tracing", Status: models.StatusDisabled,
		Metadata: map[string]interface{}{"endpoint": "otel"}, CreatedAt: now, UpdatedAt: now,
	})
	svc := service.NewService(repo)

	msg, err := svc.EnablePlugin(context.Background(), "t1", "tracing")
	if err != nil {
		t.Fatalf("EnablePlugin: %v", err)
	}
	if msg != "enabled" {
		t.Errorf("message = %q, want enabled", msg)
	}
	if repo.records[0].Status != models.StatusActive {
		t.Errorf("status = %q, want %q", repo.records[0].Status, models.StatusActive)
	}
	if repo.records[0].Metadata["endpoint"] != "otel" {
		t.Errorf("metadata = %v, want the plugin config preserved", repo.records[0].Metadata)
	}

	if _, err := svc.DisablePlugin(context.Background(), "t1", "tracing"); err != nil {
		t.Fatalf("DisablePlugin: %v", err)
	}
	if repo.records[0].Status != models.StatusDisabled {
		t.Errorf("status = %q, want %q", repo.records[0].Status, models.StatusDisabled)
	}

	// A repeat of the already-applied transition reports cleanly and writes nothing.
	if msg, err := svc.EnablePlugin(context.Background(), "t1", "tracing"); err != nil {
		t.Fatalf("EnablePlugin: %v", err)
	} else if msg != "enabled" {
		t.Errorf("message = %q, want enabled", msg)
	}
	if msg, err := svc.EnablePlugin(context.Background(), "t1", "tracing"); err != nil {
		t.Fatalf("EnablePlugin: %v", err)
	} else if msg != "enabled already" {
		t.Errorf("message = %q, want enabled already", msg)
	}
}

func TestGetPlugin_ReturnsTheRecordItFound(t *testing.T) {
	repo := &fakeRepo{}
	now := time.Now().UTC()
	repo.seed(models.Record{
		ID: "r1", TenantID: "t1", Name: "tracing", Status: models.StatusActive,
		Metadata: map[string]interface{}{"endpoint": "otel"}, CreatedAt: now, UpdatedAt: now,
	})
	svc := service.NewService(repo)

	p, err := svc.GetPlugin(context.Background(), "t1", "tracing")
	if err != nil {
		t.Fatalf("GetPlugin: %v", err)
	}
	if p["name"] != "tracing" || p["status"] != models.StatusActive {
		t.Errorf("name/status = %v/%v", p["name"], p["status"])
	}
	md, ok := p["metadata"].(map[string]interface{})
	if !ok || md["endpoint"] != "otel" {
		t.Errorf("metadata = %v, want the record's metadata, not just its name", p["metadata"])
	}
	if p["updated"] == "" {
		t.Error("updated should be set from the record's UpdatedAt")
	}
}

func TestPluginLookupsFailForUnknownNames(t *testing.T) {
	svc := service.NewService(&fakeRepo{})
	ctx := context.Background()
	if _, err := svc.GetPlugin(ctx, "t1", "ghost"); err == nil {
		t.Error("GetPlugin on an unknown name must fail")
	}
	if _, err := svc.EnablePlugin(ctx, "t1", "ghost"); err == nil {
		t.Error("EnablePlugin on an unknown name must fail")
	}
	if _, err := svc.DisablePlugin(ctx, "t1", "ghost"); err == nil {
		t.Error("DisablePlugin on an unknown name must fail")
	}
}
