package service

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/build-env/models"
)

// Service tests use a recording fake so every argument the service passes to the
// repository is inspectable. The defects these used to hide were all in the
// layer between the handler and the query: the updates map was built and then
// thrown away, strconv.Atoi rejected every UUID-shaped config and log id, and
// cache events recorded with no pipeline or build could never be attributed.

const testTenant = "11111111-1111-1111-1111-111111111111"

type fakeRepo struct {
	// update map
	lastBuild     *models.Build
	buildUpdates  map[string]interface{}
	imageUpdates  map[string]interface{}
	configUpdates map[string]interface{}

	// ids
	buildID     string
	imageID     string
	configID    string
	logID       string
	cacheID     string
	eventType   string
	pipelineID  *string
	buildArg    *string
	latency     *float64
	pipelineArg string

	// tenant as seen by each call
	lastTenant string
	// how many times any method was reached
	calls int

	updateBuildFn func(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

func (f *fakeRepo) seen(t string) {
	f.lastTenant = t
	f.calls++
}

func newFake() *fakeRepo {
	return &fakeRepo{updateBuildFn: (&fakeRepo{}).defaultUpdateBuild}
}

func newSvc(repo *fakeRepo) *Service { return NewService(repo) }

func strp(v string) *string     { return &v }
func floatp(v float64) *float64 { return &v }

func (f *fakeRepo) CreateBuild(ctx context.Context, m *models.Build) error {
	f.seen(m.TenantID)
	f.lastBuild = m
	return nil
}
func (f *fakeRepo) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	f.seen(tenantID)
	f.buildID = id
	return &models.Build{ID: id, TenantID: tenantID}, nil
}
func (f *fakeRepo) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	f.seen(tenantID)
	return []models.Build{{TenantID: tenantID}}, nil
}
func (f *fakeRepo) UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	fn := f.updateBuildFn
	if fn == nil {
		return f.defaultUpdateBuild(ctx, tenantID, id, updates)
	}
	return fn(ctx, tenantID, id, updates)
}

func (f *fakeRepo) defaultUpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	f.seen(tenantID)
	f.buildID = id
	f.buildUpdates = updates
	return nil
}
func (f *fakeRepo) DeleteBuild(ctx context.Context, tenantID, id string) error {
	f.seen(tenantID)
	f.buildID = id
	return nil
}
func (f *fakeRepo) CreateBuildImage(ctx context.Context, m *models.BuildImage) error {
	f.seen(m.TenantID)
	return nil
}
func (f *fakeRepo) GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error) {
	f.seen(tenantID)
	f.imageID = id
	return &models.BuildImage{ID: id, TenantID: tenantID}, nil
}
func (f *fakeRepo) ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error) {
	f.seen(tenantID)
	return []models.BuildImage{{TenantID: tenantID}}, nil
}
func (f *fakeRepo) UpdateBuildImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	f.seen(tenantID)
	f.imageID = id
	f.imageUpdates = updates
	return nil
}
func (f *fakeRepo) DeleteBuildImage(ctx context.Context, tenantID, id string) error {
	f.seen(tenantID)
	f.imageID = id
	return nil
}
func (f *fakeRepo) CreateCacheConfig(ctx context.Context, tenantID string, name string, level string, status string, cacheDir string, ttlHours int) (*models.BuildCacheConfig, error) {
	f.seen(tenantID)
	return &models.BuildCacheConfig{TenantID: tenantID, Name: name, Level: level, Status: status}, nil
}
func (f *fakeRepo) GetCacheConfig(ctx context.Context, tenantID, id string) (*models.BuildCacheConfig, error) {
	f.seen(tenantID)
	f.configID = id
	return &models.BuildCacheConfig{ID: id, TenantID: tenantID}, nil
}
func (f *fakeRepo) ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error) {
	f.seen(tenantID)
	return []models.BuildCacheConfig{{TenantID: tenantID}}, nil
}
func (f *fakeRepo) UpdateCacheConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.BuildCacheConfig, error) {
	f.seen(tenantID)
	f.configID = id
	f.configUpdates = updates
	return &models.BuildCacheConfig{ID: id, TenantID: tenantID}, nil
}
func (f *fakeRepo) DeleteCacheConfig(ctx context.Context, tenantID, id string) error {
	f.seen(tenantID)
	f.configID = id
	return nil
}
func (f *fakeRepo) GetBuildLog(ctx context.Context, tenantID, id string) (*models.BuildLog, error) {
	f.seen(tenantID)
	f.logID = id
	return &models.BuildLog{ID: id, TenantID: tenantID}, nil
}
func (f *fakeRepo) ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	f.seen(tenantID)
	return []models.BuildLog{{TenantID: tenantID}}, nil
}
func (f *fakeRepo) GetCacheDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error) {
	f.seen(tenantID)
	return &models.CacheDashboard{}, nil
}
func (f *fakeRepo) GetCacheMetrics(ctx context.Context, tenantID, cacheID string) (*models.CacheMetrics, error) {
	f.seen(tenantID)
	f.cacheID = cacheID
	return &models.CacheMetrics{CacheID: cacheID}, nil
}
func (f *fakeRepo) AssessCacheHealth(ctx context.Context, tenantID, cacheID string) (*models.CacheHealth, error) {
	f.seen(tenantID)
	f.cacheID = cacheID
	return &models.CacheHealth{CacheID: cacheID}, nil
}
func (f *fakeRepo) RecordCacheEvent(ctx context.Context, tenantID, cacheID, eventType string, pipelineID, buildID *string, latencySavedMs *float64) error {
	f.seen(tenantID)
	f.cacheID = cacheID
	f.eventType = eventType
	f.pipelineID = pipelineID
	f.buildArg = buildID
	f.latency = latencySavedMs
	return nil
}
func (f *fakeRepo) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error) {
	f.seen(tenantID)
	f.pipelineArg = pipelineID
	return &models.CachePerformanceImpact{PipelineID: pipelineID}, nil
}

// --- Empty update bodies are rejected before they reach the database ---

func TestUpdateBuildRejectsAnEmptyBodyWithoutCallingTheRepository(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	_, err := svc.UpdateBuild(context.Background(), testTenant, "b-1", models.UpdateBuildRequest{})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("UpdateBuild(empty) error = %v, want sentinel.BadRequest", err)
	}
	if f.calls != 0 {
		t.Fatalf("UpdateBuild(empty) reached the repository %d times; it must be a 400, not an update of updated_at", f.calls)
	}
}

func TestUpdateBuildImageRejectsAnEmptyBody(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	_, err := svc.UpdateBuildImage(context.Background(), testTenant, "i-1", models.UpdateBuildImageRequest{})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("UpdateBuildImage(empty) error = %v, want sentinel.BadRequest", err)
	}
	if f.calls != 0 {
		t.Fatalf("UpdateBuildImage(empty) reached the repository %d times", f.calls)
	}
}

func TestUpdateCacheConfigRejectsAnEmptyBody(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	_, err := svc.UpdateCacheConfig(context.Background(), testTenant, "c-1", models.UpdateBuildCacheConfigRequest{})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("UpdateCacheConfig(empty) error = %v, want sentinel.BadRequest", err)
	}
	if f.calls != 0 {
		t.Fatalf("UpdateCacheConfig(empty) reached the repository %d times", f.calls)
	}
}

func TestUpdateBuildImageSendsOnlyTheFieldsThatWereSet(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	if _, err := svc.UpdateBuildImage(context.Background(), testTenant, "i-1", models.UpdateBuildImageRequest{
		ImageTag: strp("v2"),
	}); err != nil {
		t.Fatalf("UpdateBuildImage() error = %v", err)
	}
	want := map[string]interface{}{"image_tag": "v2"}
	if !reflect.DeepEqual(f.imageUpdates, want) {
		t.Fatalf("UpdateBuildImage() sent %v, want only the fields the caller set", f.imageUpdates)
	}
	if f.imageID != "i-1" {
		t.Fatalf("UpdateBuildImage() targeted %q", f.imageID)
	}
}

func TestUpdateCacheConfigSendsAllFiveFields(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	if _, err := svc.UpdateCacheConfig(context.Background(), testTenant, "c-1", models.UpdateBuildCacheConfigRequest{
		Name:     strp("n2"),
		Level:    strp("remote"),
		Status:   strp("inactive"),
		CacheDir: strp("/cache2"),
		TTLHours: intp(48),
	}); err != nil {
		t.Fatalf("UpdateCacheConfig() error = %v", err)
	}
	want := map[string]interface{}{
		"name": "n2", "level": "remote", "status": "inactive", "cache_dir": "/cache2", "ttl_hours": 48,
	}
	if !reflect.DeepEqual(f.configUpdates, want) {
		t.Fatalf("UpdateCacheConfig() sent %v, want %v", f.configUpdates, want)
	}
}

func intp(v int) *int { return &v }

// --- UUID-shaped ids pass through unconverted ---

func TestUUIDShapedIDsAreNotParedToIntegers(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)
	id := "55555555-5555-5555-5555-555555555555"

	if _, err := svc.GetCacheConfig(context.Background(), testTenant, id); err != nil {
		t.Fatalf("GetCacheConfig() error = %v", err)
	}
	if f.configID != id {
		t.Fatalf("GetCacheConfig() passed %q to the repository, want %q unchanged (strconv.Atoi rejected every real uuid)", f.configID, id)
	}
	if _, err := svc.UpdateCacheConfig(context.Background(), testTenant, id, models.UpdateBuildCacheConfigRequest{Level: strp("remote")}); err != nil {
		t.Fatalf("UpdateCacheConfig() error = %v", err)
	}
	if f.configID != id {
		t.Fatalf("UpdateCacheConfig() passed %q, want %q", f.configID, id)
	}
	if err := svc.DeleteCacheConfig(context.Background(), testTenant, id); err != nil {
		t.Fatalf("DeleteCacheConfig() error = %v", err)
	}
	if f.configID != id {
		t.Fatalf("DeleteCacheConfig() passed %q, want %q", f.configID, id)
	}
	if _, err := svc.GetBuildLog(context.Background(), testTenant, id); err != nil {
		t.Fatalf("GetBuildLog() error = %v", err)
	}
	if f.logID != id {
		t.Fatalf("GetBuildLog() passed %q, want %q", f.logID, id)
	}
	if _, err := svc.GetBuild(context.Background(), testTenant, id); err != nil {
		t.Fatalf("GetBuild() error = %v", err)
	}
	if f.buildID != id {
		t.Fatalf("GetBuild() passed %q, want %q", f.buildID, id)
	}
}

// --- Defaults ---

func TestCreateBuildDefaultsStatusToQueued(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)
	if _, err := svc.CreateBuild(context.Background(), testTenant, models.CreateBuildRequest{Name: "b"}); err != nil {
		t.Fatalf("CreateBuild() error = %v", err)
	}
	if f.lastTenant != testTenant {
		t.Fatalf("CreateBuild() passed tenant %q", f.lastTenant)
	}
	if f.lastBuild.Status != "queued" {
		t.Fatalf("CreateBuild() left status %q, want the queued default (an empty status is not a valid build state)", f.lastBuild.Status)
	}
}

func TestCreateBuildKeepsAnExplicitStatus(t *testing.T) {
	// The default must not overwrite a status the caller supplied.
	f := &fakeRepo{}
	svc := newSvc(f)
	if _, err := svc.CreateBuild(context.Background(), testTenant, models.CreateBuildRequest{Name: "b", Status: "running"}); err != nil {
		t.Fatalf("CreateBuild() error = %v", err)
	}
	if f.lastBuild.Status != "running" {
		t.Fatalf("CreateBuild() overwrote the caller's status with %q", f.lastBuild.Status)
	}
}

func TestCreateCacheConfigDefaultsStatusToActive(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)
	got, err := svc.CreateCacheConfig(context.Background(), testTenant, models.CreateBuildCacheConfigRequest{Name: "c"})
	if err != nil {
		t.Fatalf("CreateCacheConfig() error = %v", err)
	}
	if f.lastTenant != testTenant {
		t.Fatalf("CreateCacheConfig() passed tenant %q", f.lastTenant)
	}
	if got.Status != "active" {
		t.Fatalf("CreateCacheConfig() defaulted status to %q, want active", got.Status)
	}
}

func TestCreateCacheConfigKeepsAnExplicitStatus(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)
	got, err := svc.CreateCacheConfig(context.Background(), testTenant, models.CreateBuildCacheConfigRequest{Name: "c", Status: "inactive"})
	if err != nil {
		t.Fatalf("CreateCacheConfig() error = %v", err)
	}
	if got.Status != "inactive" {
		t.Fatalf("CreateCacheConfig() overwrote the caller's status with %q", got.Status)
	}
}

// --- Cache event validation and forwarding ---

func TestRecordCacheEventRejectsAnUnknownType(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	err := svc.RecordCacheEvent(context.Background(), testTenant, models.RecordCacheEventRequest{
		CacheID: "cache-1", EventType: "probe",
	})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("RecordCacheEvent(probe) error = %v, want sentinel.BadRequest", err)
	}
	if f.calls != 0 {
		t.Fatalf("RecordCacheEvent(probe) inserted into a table whose aggregates ignore it: %d call(s)", f.calls)
	}
}

func TestRecordCacheEventAcceptsTheThreeRecordedKinds(t *testing.T) {
	svc := newSvc(&fakeRepo{})
	for _, kind := range []string{models.EventTypeHit, models.EventTypeMiss, models.EventTypeEvict} {
		if err := svc.RecordCacheEvent(context.Background(), testTenant, models.RecordCacheEventRequest{
			CacheID: "cache-1", EventType: kind,
		}); err != nil {
			t.Fatalf("RecordCacheEvent(%s) error = %v", kind, err)
		}
	}
}

func TestRecordCacheEventForwardsTheAttribution(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)
	req := models.RecordCacheEventRequest{
		CacheID:        "cache-1",
		EventType:      models.EventTypeHit,
		PipelineID:     strp("pipeline-9"),
		BuildID:        strp("build-42"),
		LatencySavedMs: floatp(128.5),
	}

	if err := svc.RecordCacheEvent(context.Background(), testTenant, req); err != nil {
		t.Fatalf("RecordCacheEvent() error = %v", err)
	}
	if f.cacheID != "cache-1" || f.eventType != models.EventTypeHit {
		t.Fatalf("RecordCacheEvent() forwarded cache=%q type=%q", f.cacheID, f.eventType)
	}
	if f.pipelineID == nil || *f.pipelineID != "pipeline-9" {
		t.Fatalf("RecordCacheEvent() dropped pipeline_id: %v", f.pipelineID)
	}
	if f.buildArg == nil || *f.buildArg != "build-42" {
		t.Fatalf("RecordCacheEvent() dropped build_id: %v", f.buildArg)
	}
	if f.latency == nil || *f.latency != 128.5 {
		t.Fatalf("RecordCacheEvent() dropped latency_saved_ms: %v", f.latency)
	}
}

func TestRecordCacheEventWithoutAttributionPassesNil(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	if err := svc.RecordCacheEvent(context.Background(), testTenant, models.RecordCacheEventRequest{
		CacheID: "cache-1", EventType: models.EventTypeEvict,
	}); err != nil {
		t.Fatalf("RecordCacheEvent() error = %v", err)
	}
	if f.pipelineID != nil || f.buildArg != nil || f.latency != nil {
		t.Fatalf("RecordCacheEvent() invented attribution: %v %v %v", f.pipelineID, f.buildArg, f.latency)
	}
}

// --- The tenant reaches every pass-through call ---

func TestTenantReachesEveryCall(t *testing.T) {
	ctx := context.Background()
	id := "33333333-3333-3333-3333-333333333333"

	cases := []struct {
		name string
		call func(svc *Service)
	}{
		{"GetBuild", func(s *Service) { _, _ = s.GetBuild(ctx, testTenant, id) }},
		{"ListBuilds", func(s *Service) { _, _ = s.ListBuilds(ctx, testTenant, 25, 10) }},
		{"UpdateBuild", func(s *Service) {
			_, _ = s.UpdateBuild(ctx, testTenant, id, models.UpdateBuildRequest{Name: strp("n2")})
		}},
		{"DeleteBuild", func(s *Service) { _ = s.DeleteBuild(ctx, testTenant, id) }},
		{"CreateBuildImage", func(s *Service) {
			_, _ = s.CreateBuildImage(ctx, testTenant, models.CreateBuildImageRequest{Name: "i"})
		}},
		{"GetBuildImage", func(s *Service) { _, _ = s.GetBuildImage(ctx, testTenant, id) }},
		{"ListBuildImages", func(s *Service) { _, _ = s.ListBuildImages(ctx, testTenant, 25, 10) }},
		{"UpdateBuildImage", func(s *Service) {
			_, _ = s.UpdateBuildImage(ctx, testTenant, id, models.UpdateBuildImageRequest{Name: strp("n2")})
		}},
		{"DeleteBuildImage", func(s *Service) { _ = s.DeleteBuildImage(ctx, testTenant, id) }},
		{"CreateCacheConfig", func(s *Service) {
			_, _ = s.CreateCacheConfig(ctx, testTenant, models.CreateBuildCacheConfigRequest{Name: "c"})
		}},
		{"GetCacheConfig", func(s *Service) { _, _ = s.GetCacheConfig(ctx, testTenant, id) }},
		{"ListCacheConfigs", func(s *Service) { _, _ = s.ListCacheConfigs(ctx, testTenant, "remote", "active", 25, 10) }},
		{"UpdateCacheConfig", func(s *Service) {
			_, _ = s.UpdateCacheConfig(ctx, testTenant, id, models.UpdateBuildCacheConfigRequest{Name: strp("n2")})
		}},
		{"DeleteCacheConfig", func(s *Service) { _ = s.DeleteCacheConfig(ctx, testTenant, id) }},
		{"GetBuildLog", func(s *Service) { _, _ = s.GetBuildLog(ctx, testTenant, id) }},
		{"ListBuildLogs", func(s *Service) { _, _ = s.ListBuildLogs(ctx, testTenant, 25, 10) }},
		{"GetDashboard", func(s *Service) { _, _ = s.GetDashboard(ctx, testTenant) }},
		{"GetCacheMetrics", func(s *Service) { _, _ = s.GetCacheMetrics(ctx, testTenant, "cache-1") }},
		{"AssessCacheHealth", func(s *Service) { _, _ = s.AssessCacheHealth(ctx, testTenant, "cache-1") }},
		{"AnalyzePerformanceImpact", func(s *Service) { _, _ = s.AnalyzePerformanceImpact(ctx, testTenant, "pipeline-9") }},
		{"RecordCacheEvent", func(s *Service) {
			_ = s.RecordCacheEvent(ctx, testTenant, models.RecordCacheEventRequest{
				CacheID: "cache-1", EventType: models.EventTypeHit,
			})
		}},
		{"CreateBuild", func(s *Service) {
			_, _ = s.CreateBuild(ctx, testTenant, models.CreateBuildRequest{Name: "b"})
		}},
	}

	for _, tc := range cases {
		f := &fakeRepo{}
		svc := newSvc(f)
		tc.call(svc)
		if f.lastTenant != testTenant {
			t.Fatalf("%s: the repository saw tenant %q, want %q — a dropped tenant silently widens the query",
				tc.name, f.lastTenant, testTenant)
		}
	}
}

// --- Update re-reads the row it wrote ---

func TestUpdateBuildReturnsTheRowThatWasWritten(t *testing.T) {
	f := &fakeRepo{}
	svc := newSvc(f)

	got, err := svc.UpdateBuild(context.Background(), testTenant, "b-1", models.UpdateBuildRequest{Status: strp("success")})
	if err != nil {
		t.Fatalf("UpdateBuild() error = %v", err)
	}
	if got.ID != "b-1" || got.TenantID != testTenant {
		t.Fatalf("UpdateBuild() = %+v, want the re-read row", got)
	}
	if f.buildUpdates == nil || f.buildUpdates["status"] != "success" {
		t.Fatalf("UpdateBuild() sent %v, want status=success", f.buildUpdates)
	}
	if f.calls != 2 {
		t.Fatalf("UpdateBuild() made %d repository calls, want an update then a re-read", f.calls)
	}
}

func TestUpdateBuildSurfacesTheWriteErrorAndSkipsTheReread(t *testing.T) {
	// An update that did not land must not be followed by a read that reports the
	// stale row as if the write had succeeded.
	f := newFake()
	f.updateBuildFn = func(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
		f.seen(tenantID)
		return errors.New("boom")
	}
	svc := newSvc(f)

	if _, err := svc.UpdateBuild(context.Background(), testTenant, "b-1", models.UpdateBuildRequest{Status: strp("success")}); err == nil {
		t.Fatalf("UpdateBuild() should have surfaced the repository error")
	}
	if f.calls != 1 {
		t.Fatalf("UpdateBuild() made %d repository calls after a failed write, want 1 (no re-read of the stale row)", f.calls)
	}
}

func TestUpdateBuildWrapsNotFoundSoTheHandlerCan404(t *testing.T) {
	f := newFake()
	f.updateBuildFn = func(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
		return fmt.Errorf("build not found: %w", sentinel.NotFound)
	}
	svc := newSvc(f)

	if _, err := svc.UpdateBuild(context.Background(), testTenant, "b-1", models.UpdateBuildRequest{Status: strp("success")}); !IsNotFound(err) {
		t.Fatalf("UpdateBuild() = %v, want an error IsNotFound can match", err)
	}
}

// --- Error mapping ---

func TestIsNotFoundMatchesOnlyNotFound(t *testing.T) {
	if !IsNotFound(fmt.Errorf("build %s not found: %w", "b-1", sentinel.NotFound)) {
		t.Fatalf("IsNotFound() must match a wrapped sentinel.NotFound")
	}
	if IsNotFound(errors.New("something else")) {
		t.Fatalf("IsNotFound() matched an unrelated error")
	}
	if IsNotFound(nil) {
		t.Fatalf("IsNotFound(nil) = true")
	}
}

func TestServiceSatisfiesTheHandlerContract(t *testing.T) {
	var _ ServiceInterface = (*Service)(nil)
	var _ RepositoryInterface = (*fakeRepo)(nil)
}
