package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/build-env/models"
)

// Repository tests drive the real repository over sqlmock so they pin the
// exact SQL text, the argument order and the column mapping. That is where
// every build-env defect lived:
//
//   - the three update methods built an updates map and then discarded it, so
//     PUT changed nothing and still answered 200;
//   - no write checked RowsAffected, so DELETE / PUT answered success for a
//     guessed UUID or a UUID that belonged to another tenant;
//   - the four reads ran SELECT * against tables that migrations 016, 571 and
//     572 had grown columns in, and sqlx's strict mapper turned every row into
//     "missing destination name X" — all eight read endpoints returned 500;
//   - the cache monitor ran aggregates with no FROM clause, ignoring both of
//     its parameters, and AssessCacheHealth returned Healthy: true regardless
//     of whether the cache had ever been probed.

var (
	tenant     = "11111111-1111-1111-1111-111111111111"
	buildID    = "33333333-3333-3333-3333-333333333333"
	imageID    = "44444444-4444-4444-4444-444444444444"
	configID   = "55555555-5555-5555-5555-555555555555"
	logID      = "66666666-6666-6666-6666-666666666666"
	cacheID    = "cache-remote-1"
	pipelineID = "pipeline-9"
)

// normalize collapses whitespace so an expected statement can be written on one
// line even though the repository formats some of them across several.
func normalize(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normalize(expected) == normalize(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s",
			normalize(expected), normalize(actual))
	})))
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

const (
	getBuildSQL           = "SELECT " + buildCols + " FROM builds WHERE id=$1 AND tenant_id=$2"
	listBuildsSQL         = "SELECT " + buildCols + " FROM builds WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	getImageSQL           = "SELECT " + imageCols + " FROM build_images WHERE id=$1 AND tenant_id=$2"
	listImagesSQL         = "SELECT " + imageCols + " FROM build_images WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	getConfigSQL          = "SELECT " + configCols + " FROM build_cache_configs WHERE id=$1 AND tenant_id=$2"
	listConfigSQL         = "SELECT " + configCols + " FROM build_cache_configs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	listConfigFilteredSQL = "SELECT " + configCols + " FROM build_cache_configs WHERE tenant_id=$1 AND level=$2 AND status=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5"
	getLogSQL             = "SELECT " + logCols + " FROM build_logs WHERE id=$1 AND tenant_id=$2"
	listLogSQL            = "SELECT " + logCols + " FROM build_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	deleteBuildSQL        = "DELETE FROM builds WHERE id=$1 AND tenant_id=$2"
	deleteConfigSQL       = "DELETE FROM build_cache_configs WHERE id=$1 AND tenant_id=$2"
)

const (
	updateBuildSQL     = "UPDATE builds SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4"
	updateBuildOneSQL  = "UPDATE builds SET name=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3"
	updateConfigOneSQL = "UPDATE build_cache_configs SET level=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3"
)

const updateImageSQL = "UPDATE build_images SET base_image=$1, image_tag=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4"

const updateConfigSQL = "UPDATE build_cache_configs SET level=$1, ttl_hours=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4"

const createBuildSQL = "INSERT INTO builds (id, tenant_id, name, status, pipeline_id, product_line_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"

const createImageSQL = "INSERT INTO build_images (id, tenant_id, name, image_tag, base_image, dockerfile, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"

const createConfigSQL = "INSERT INTO build_cache_configs (tenant_id, name, level, status, cache_dir, ttl_hours, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING " + configCols

const recordEventSQL = "INSERT INTO cache_events (tenant_id, cache_id, pipeline_id, build_id, event_type, latency_saved_ms, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())"

const metricsSQL = "SELECT " + hitCount + " AS hits, COUNT(*) FILTER (WHERE event_type = 'miss') AS misses, CASE WHEN " + probesCount + " = 0 THEN 0 ELSE 1.0 * " + hitCount + " / " + probesCount + " END AS hit_rate, AVG(latency_saved_ms) FILTER (WHERE event_type = 'hit') AS avg_latency_ms FROM cache_events WHERE tenant_id=$1 AND cache_id=$2"

const healthSQL = "SELECT " + probesCount + " AS probes, CASE WHEN " + probesCount + " = 0 THEN 0 ELSE 1.0 * " + hitCount + " / " + probesCount + " END AS hit_rate, MAX(created_at) FILTER (WHERE event_type IN ('hit', 'miss')) AS last_probe FROM cache_events WHERE tenant_id=$1 AND cache_id=$2"

const impactSQL = "SELECT COALESCE(SUM(latency_saved_ms) FILTER (WHERE event_type = 'hit'), 0) AS time_saved_ms, COUNT(DISTINCT build_id) FILTER (WHERE event_type = 'hit') AS builds_with_cache, COUNT(DISTINCT build_id) AS total_builds FROM cache_events WHERE tenant_id = $1 AND pipeline_id = $2"

const dashboardSQL = "WITH probes AS ( SELECT " + probesCount + " AS n, " + hitCount + " AS hits FROM cache_events WHERE tenant_id = $1 ) SELECT COUNT(*) AS total_configs, COUNT(*) FILTER (WHERE bc.status = 'active') AS active_configs, CASE WHEN p.n = 0 THEN NULL ELSE 1.0 * p.hits / p.n END AS cache_hit_rate, (SELECT AVG(ce.latency_saved_ms) FROM cache_events ce WHERE ce.tenant_id = $1 AND ce.event_type = 'hit') AS avg_latency_ms FROM build_cache_configs bc CROSS JOIN probes p WHERE bc.tenant_id = $1"

// --- setClause ---

func TestSetClauseSortsColumnsAndBindsValues(t *testing.T) {
	set, args, n := setClause(map[string]interface{}{
		"status": "success", "name": "n-2", "pipeline_id": "p-1",
	}, buildUpdatable)

	if n != 3 {
		t.Fatalf("setClause() columns = %d, want 3", n)
	}
	want := "name=$1, pipeline_id=$2, status=$3, updated_at=NOW()"
	if set != want {
		t.Fatalf("setClause() set = %q, want %q (columns must be sorted so the statement is stable)", set, want)
	}
	wantArgs := []interface{}{"n-2", "p-1", "success"}
	if len(args) != len(wantArgs) {
		t.Fatalf("setClause() args = %v, want %v", args, wantArgs)
	}
	for i := range wantArgs {
		if args[i] != wantArgs[i] {
			t.Fatalf("setClause() arg %d = %v, want %v (the column order and the value order must agree)", i, args[i], wantArgs[i])
		}
	}
}

func TestSetClauseDropsColumnsOutsideTheWhitelist(t *testing.T) {
	set, _, n := setClause(map[string]interface{}{
		"name":            "n-2",
		"updated_at":      time.Now(),
		"id":              "other",
		"tenant_id":       "other",
		"ttl_hours; DROP": "1",
	}, buildUpdatable)

	if n != 1 || set != "name=$1, updated_at=NOW()" {
		t.Fatalf("setClause() = %q / %d, want only the whitelisted name column", set, n)
	}
}

func TestSetClauseEmptyMapIsZeroColumns(t *testing.T) {
	set, args, n := setClause(map[string]interface{}{}, buildUpdatable)
	if n != 0 || set != "" || args != nil {
		t.Fatalf("setClause(empty) = %q / %v / %d, want empty", set, args, n)
	}
}

// --- Update: the map is not discarded, and it is tenant scoped ---

func TestUpdateBuildBindsWhitelistedColumnsAndTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(updateBuildSQL).
		WithArgs("n-2", "success", buildID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateBuild(context.Background(), tenant, buildID,
		map[string]interface{}{"name": "n-2", "status": "success"})
	if err != nil {
		t.Fatalf("UpdateBuild() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateBuildEmptyMapIsBadRequest(t *testing.T) {
	repo, mock := newMock(t)
	err := repo.UpdateBuild(context.Background(), tenant, buildID, map[string]interface{}{})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("UpdateBuild(empty) error = %v, want sentinel.BadRequest", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a rejected update must not touch the database: %v", err)
	}
}

func TestUpdateBuildZeroRowsIsNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(updateBuildOneSQL).
		WithArgs("n-2", buildID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.UpdateBuild(context.Background(), tenant, buildID, map[string]interface{}{"name": "n-2"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("UpdateBuild() on a missing row = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateBuildImageBindsWhitelistedColumnsAndTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(updateImageSQL).
		WithArgs("alpine:3.20", "v2.1", imageID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateBuildImage(context.Background(), tenant, imageID, map[string]interface{}{
		"image_tag": "v2.1", "base_image": "alpine:3.20",
	})
	if err != nil {
		t.Fatalf("UpdateBuildImage() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateCacheConfigBindsColumnsAndRereadsTheRow(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(updateConfigSQL).
		WithArgs("remote", 48, configID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(getConfigSQL).
		WithArgs(configID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "level", "status", "cache_dir", "ttl_hours", "created_at", "updated_at"}).
			AddRow(configID, tenant, "c", "remote", "active", "/cache", 48, time.Now(), time.Now()))

	got, err := repo.UpdateCacheConfig(context.Background(), tenant, configID, map[string]interface{}{
		"ttl_hours": 48, "level": "remote",
	})
	if err != nil {
		t.Fatalf("UpdateCacheConfig() error = %v", err)
	}
	if got.Level != "remote" || got.TTLHours != 48 {
		t.Fatalf("UpdateCacheConfig() = %+v, want the row that was written", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateCacheConfigDoesNotRereadAfterAFailedWrite(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(updateConfigOneSQL).
		WithArgs("remote", configID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 0))

	_, err := repo.UpdateCacheConfig(context.Background(), tenant, configID, map[string]interface{}{"level": "remote"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("UpdateCacheConfig() = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a write that touched nothing must not be followed by a read: %v", err)
	}
}

// --- Delete: zero rows is not success ---

func TestDeleteBuildZeroRowsIsNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(deleteBuildSQL).
		WithArgs(buildID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.DeleteBuild(context.Background(), tenant, buildID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("DeleteBuild() on a missing or foreign row = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestDeleteCacheConfigOneRowSucceeds(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(deleteConfigSQL).
		WithArgs(configID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.DeleteCacheConfig(context.Background(), tenant, configID); err != nil {
		t.Fatalf("DeleteCacheConfig() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// --- Reads: explicit column lists and not-found mapping ---

func TestGetBuildSelectsEveryMappedColumn(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getBuildSQL).
		WithArgs(buildID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "status", "pipeline_id", "product_line_id", "created_at", "updated_at"}).
			AddRow(buildID, tenant, "b", "success", "p-1", "pl-1", time.Now(), time.Now()))

	got, err := repo.GetBuild(context.Background(), tenant, buildID)
	if err != nil {
		t.Fatalf("GetBuild() error = %v", err)
	}
	if got.ID != buildID || got.TenantID != tenant || got.Name != "b" || got.Status != "success" ||
		got.PipelineID != "p-1" || got.ProductLineID != "pl-1" {
		t.Fatalf("GetBuild() = %+v, want every selected column mapped", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetBuildMapsErrNoRowsToNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getBuildSQL).
		WithArgs(buildID, tenant).
		WillReturnError(sql.ErrNoRows)

	_, err := repo.GetBuild(context.Background(), tenant, buildID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("GetBuild() = %v, want sentinel.NotFound (the handler's 404 branch keys on it)", err)
	}
}

func TestListBuildsBindsTenantLimitAndOffset(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listBuildsSQL).
		WithArgs(tenant, 25, 10).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "status", "pipeline_id", "product_line_id", "created_at", "updated_at"}).
			AddRow(buildID, tenant, "b", "queued", "p-1", "pl-1", time.Now(), time.Now()))

	items, err := repo.ListBuilds(context.Background(), tenant, 25, 10)
	if err != nil {
		t.Fatalf("ListBuilds() error = %v", err)
	}
	if len(items) != 1 || items[0].TenantID != tenant {
		t.Fatalf("ListBuilds() = %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListBuildsClampsLimitAndOffset(t *testing.T) {
	repo, mock := newMock(t)
	// limit <= 0 falls back to the default and a negative offset to zero: the
	// caller passes query strings, so 0 and -1 are not parse errors.
	mock.ExpectQuery(listBuildsSQL).
		WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "status", "pipeline_id", "product_line_id", "created_at", "updated_at"}))

	if items, err := repo.ListBuilds(context.Background(), tenant, 0, -3); err != nil || len(items) != 0 {
		t.Fatalf("ListBuilds() = %+v, %v", items, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetBuildImageSelectsEveryMappedColumn(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getImageSQL).
		WithArgs(imageID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "image_tag", "base_image", "dockerfile", "created_at", "updated_at"}).
			AddRow(imageID, tenant, "i", "v1", "alpine:3", "Dockerfile", time.Now(), time.Now()))

	got, err := repo.GetBuildImage(context.Background(), tenant, imageID)
	if err != nil {
		t.Fatalf("GetBuildImage() error = %v", err)
	}
	if got.ImageTag != "v1" || got.BaseImage != "alpine:3" || got.Dockerfile != "Dockerfile" {
		t.Fatalf("GetBuildImage() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListBuildImagesBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listImagesSQL).WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "image_tag", "base_image", "dockerfile", "created_at", "updated_at"}))

	if _, err := repo.ListBuildImages(context.Background(), tenant, 50, 0); err != nil {
		t.Fatalf("ListBuildImages() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetBuildLogSelectsEveryMappedColumn(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getLogSQL).
		WithArgs(logID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "build_id", "log_data", "created_at"}).
			AddRow(logID, tenant, buildID, "hello", time.Now()))

	got, err := repo.GetBuildLog(context.Background(), tenant, logID)
	if err != nil {
		t.Fatalf("GetBuildLog() error = %v", err)
	}
	if got.BuildID != buildID || got.LogData != "hello" {
		t.Fatalf("GetBuildLog() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListBuildLogsBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listLogSQL).WithArgs(tenant, 10, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "build_id", "log_data", "created_at"}))

	if _, err := repo.ListBuildLogs(context.Background(), tenant, 10, 0); err != nil {
		t.Fatalf("ListBuildLogs() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// --- Writes ---

func TestCreateBuildBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createBuildSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "b", "queued", "p-1", "pl-1",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	m := &models.Build{TenantID: tenant, Name: "b", Status: "queued", PipelineID: "p-1", ProductLineID: "pl-1"}
	if err := repo.CreateBuild(context.Background(), m); err != nil {
		t.Fatalf("CreateBuild() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateBuildImageBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createImageSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "i", "v1", "alpine:3", "Dockerfile",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	img := &models.BuildImage{TenantID: tenant, Name: "i", ImageTag: "v1", BaseImage: "alpine:3", Dockerfile: "Dockerfile"}
	if err := repo.CreateBuildImage(context.Background(), img); err != nil {
		t.Fatalf("CreateBuildImage() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateCacheConfigReturnsTheInsertedRow(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(createConfigSQL).
		WithArgs(tenant, "c", "local", "active", "/cache", 24).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "level", "status", "cache_dir", "ttl_hours", "created_at", "updated_at"}).
			AddRow(configID, tenant, "c", "local", "active", "/cache", 24, time.Now(), time.Now()))

	got, err := repo.CreateCacheConfig(context.Background(), tenant, "c", "local", "active", "/cache", 24)
	if err != nil {
		t.Fatalf("CreateCacheConfig() error = %v", err)
	}
	if got.ID != configID || got.TTLHours != 24 {
		t.Fatalf("CreateCacheConfig() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListCacheConfigsAppliesTheOptionalFilters(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listConfigFilteredSQL).
		WithArgs(tenant, "remote", "active", 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "level", "status", "cache_dir", "ttl_hours", "created_at", "updated_at"}))

	if _, err := repo.ListCacheConfigs(context.Background(), tenant, "remote", "active", 20, 0); err != nil {
		t.Fatalf("ListCacheConfigs() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListCacheConfigsWithoutFiltersUsesTheBaseClause(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listConfigSQL).
		WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "level", "status", "cache_dir", "ttl_hours", "created_at", "updated_at"}))

	if _, err := repo.ListCacheConfigs(context.Background(), tenant, "", "", 50, 0); err != nil {
		t.Fatalf("ListCacheConfigs() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetCacheConfigMapsErrNoRowsToNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getConfigSQL).WithArgs(configID, tenant).WillReturnError(sql.ErrNoRows)

	_, err := repo.GetCacheConfig(context.Background(), tenant, configID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("GetCacheConfig() = %v, want sentinel.NotFound", err)
	}
}

// --- Cache monitor ---

func TestGetCacheDashboardReportsNullTelemetryWithNoProbes(t *testing.T) {
	repo, mock := newMock(t)
	// Two caches configured, no events recorded: the counts are defined, the two
	// telemetry fields are not, so both come back NULL and must surface as nil
	// rather than 0.0 — 0.0 would read as a slow, empty cache.
	mock.ExpectQuery(dashboardSQL).
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"total_configs", "active_configs", "cache_hit_rate", "avg_latency_ms"}).
			AddRow(2, 1, nil, nil))

	got, err := repo.GetCacheDashboard(context.Background(), tenant)
	if err != nil {
		t.Fatalf("GetCacheDashboard() error = %v", err)
	}
	if got.TotalConfigs != 2 || got.ActiveConfigs != 1 {
		t.Fatalf("GetCacheDashboard() = %+v", got)
	}
	if got.CacheHitRate != nil || got.AvgLatencyMs != nil {
		t.Fatalf("GetCacheDashboard() with no probes = %+v, want both telemetry fields nil", got)
	}
}

func TestGetCacheDashboardReportsTelemetryWhenThereAreProbes(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(dashboardSQL).
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"total_configs", "active_configs", "cache_hit_rate", "avg_latency_ms"}).
			AddRow(2, 2, 0.75, 120.5))

	got, err := repo.GetCacheDashboard(context.Background(), tenant)
	if err != nil {
		t.Fatalf("GetCacheDashboard() error = %v", err)
	}
	if got.CacheHitRate == nil || *got.CacheHitRate != 0.75 {
		t.Fatalf("GetCacheDashboard() hit rate = %v, want 0.75", got.CacheHitRate)
	}
	if got.AvgLatencyMs == nil || *got.AvgLatencyMs != 120.5 {
		t.Fatalf("GetCacheDashboard() avg latency = %v, want 120.5", got.AvgLatencyMs)
	}
}

func TestGetCacheMetricsBindsTenantAndCache(t *testing.T) {
	repo, mock := newMock(t)
	// The previous statement had no FROM clause at all, so neither argument was
	// bound and every cache reported 0 hits. The query below must bind both.
	mock.ExpectQuery(metricsSQL).
		WithArgs(tenant, cacheID).
		WillReturnRows(sqlmock.NewRows([]string{"hits", "misses", "hit_rate", "avg_latency_ms"}).
			AddRow(9, 1, 0.9, 340.0))

	got, err := repo.GetCacheMetrics(context.Background(), tenant, cacheID)
	if err != nil {
		t.Fatalf("GetCacheMetrics() error = %v", err)
	}
	if got.CacheID != cacheID || got.Hits != 9 || got.Misses != 1 || got.HitRate != 0.9 {
		t.Fatalf("GetCacheMetrics() = %+v", got)
	}
	if got.AvgLatencyMs == nil || *got.AvgLatencyMs != 340.0 {
		t.Fatalf("GetCacheMetrics() avg latency = %v, want 340", got.AvgLatencyMs)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetCacheMetricsWithoutAHitLeavesLatencyNull(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(metricsSQL).
		WithArgs(tenant, cacheID).
		WillReturnRows(sqlmock.NewRows([]string{"hits", "misses", "hit_rate", "avg_latency_ms"}).
			AddRow(0, 5, 0.0, nil))

	got, err := repo.GetCacheMetrics(context.Background(), tenant, cacheID)
	if err != nil {
		t.Fatalf("GetCacheMetrics() error = %v", err)
	}
	if got.Hits != 0 || got.Misses != 5 || got.HitRate != 0.0 {
		t.Fatalf("GetCacheMetrics() = %+v", got)
	}
	if got.AvgLatencyMs != nil {
		t.Fatalf("GetCacheMetrics() avg latency = %v, want nil with no hit recorded", got.AvgLatencyMs)
	}
}

func TestAssessCacheHealthWithNoEventsIsUnhealthy(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(healthSQL).
		WithArgs(tenant, cacheID).
		WillReturnRows(sqlmock.NewRows([]string{"probes", "hit_rate", "last_probe"}).
			AddRow(0, 0.0, nil))

	got, err := repo.AssessCacheHealth(context.Background(), tenant, cacheID)
	if err != nil {
		t.Fatalf("AssessCacheHealth() error = %v", err)
	}
	if got.Healthy {
		t.Fatalf("AssessCacheHealth() with no probe traffic reported healthy: %+v", got)
	}
	if !strings.Contains(got.Reason, "no cache events") {
		t.Fatalf("AssessCacheHealth() reason = %q, want the no-data reason", got.Reason)
	}
	if got.CacheID != cacheID || got.LastCheck.IsZero() {
		t.Fatalf("AssessCacheHealth() = %+v", got)
	}
}

func TestAssessCacheHealthBelowThresholdIsUnhealthy(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(healthSQL).
		WithArgs(tenant, cacheID).
		WillReturnRows(sqlmock.NewRows([]string{"probes", "hit_rate", "last_probe"}).
			AddRow(10, 0.30, time.Now().UTC()))

	got, err := repo.AssessCacheHealth(context.Background(), tenant, cacheID)
	if err != nil {
		t.Fatalf("AssessCacheHealth() error = %v", err)
	}
	if got.Healthy {
		t.Fatalf("AssessCacheHealth() at a 30%% hit rate reported healthy: %+v", got)
	}
	if !strings.Contains(got.Reason, "below the") {
		t.Fatalf("AssessCacheHealth() reason = %q, want the threshold reason", got.Reason)
	}
}

func TestAssessCacheHealthStaleIsUnhealthy(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(healthSQL).
		WithArgs(tenant, cacheID).
		WillReturnRows(sqlmock.NewRows([]string{"probes", "hit_rate", "last_probe"}).
			AddRow(20, 0.90, time.Now().UTC().Add(-8*24*time.Hour)))

	got, err := repo.AssessCacheHealth(context.Background(), tenant, cacheID)
	if err != nil {
		t.Fatalf("AssessCacheHealth() error = %v", err)
	}
	if got.Healthy {
		t.Fatalf("AssessCacheHealth() with an 8-day-old last probe reported healthy: %+v", got)
	}
	if !strings.Contains(got.Reason, "outside the") {
		t.Fatalf("AssessCacheHealth() reason = %q, want the staleness reason", got.Reason)
	}
}

func TestAssessCacheHealthMeetingTheThresholdIsHealthy(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(healthSQL).
		WithArgs(tenant, cacheID).
		WillReturnRows(sqlmock.NewRows([]string{"probes", "hit_rate", "last_probe"}).
			AddRow(20, 0.90, time.Now().UTC()))

	got, err := repo.AssessCacheHealth(context.Background(), tenant, cacheID)
	if err != nil {
		t.Fatalf("AssessCacheHealth() error = %v", err)
	}
	if !got.Healthy {
		t.Fatalf("AssessCacheHealth() = %+v, want healthy", got)
	}
}

func TestRecordCacheEventBindsAttribution(t *testing.T) {
	repo, mock := newMock(t)
	pl, bd, lat := "pipeline-9", "build-42", 128.5
	mock.ExpectExec(recordEventSQL).
		WithArgs(tenant, cacheID, pl, bd, "hit", lat).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.RecordCacheEvent(context.Background(), tenant, cacheID, "hit", &pl, &bd, &lat); err != nil {
		t.Fatalf("RecordCacheEvent() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRecordCacheEventOmitsOptionalAttribution(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(recordEventSQL).
		WithArgs(tenant, cacheID, nil, nil, "evict", nil).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.RecordCacheEvent(context.Background(), tenant, cacheID, "evict", nil, nil, nil); err != nil {
		t.Fatalf("RecordCacheEvent() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAnalyzePerformanceImpactBindsPipeline(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(impactSQL).
		WithArgs(tenant, pipelineID).
		WillReturnRows(sqlmock.NewRows([]string{"time_saved_ms", "builds_with_cache", "total_builds"}).
			AddRow(1200.5, 3, 5))

	got, err := repo.AnalyzePerformanceImpact(context.Background(), tenant, pipelineID)
	if err != nil {
		t.Fatalf("AnalyzePerformanceImpact() error = %v", err)
	}
	if got.PipelineID != pipelineID || got.TimeSavedMs != 1200.5 ||
		got.BuildsWithCache != 3 || got.TotalBuilds != 5 {
		t.Fatalf("AnalyzePerformanceImpact() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAnalyzePerformanceImpactWithNoEventsIsZero(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(impactSQL).
		WithArgs(tenant, pipelineID).
		WillReturnRows(sqlmock.NewRows([]string{"time_saved_ms", "builds_with_cache", "total_builds"}).
			AddRow(0.0, 0, 0))

	got, err := repo.AnalyzePerformanceImpact(context.Background(), tenant, pipelineID)
	if err != nil {
		t.Fatalf("AnalyzePerformanceImpact() error = %v", err)
	}
	if got.TimeSavedMs != 0 || got.BuildsWithCache != 0 || got.TotalBuilds != 0 {
		t.Fatalf("AnalyzePerformanceImpact() = %+v, want zeros", got)
	}
}

// --- Thresholds are the health contract ---

func TestHealthThresholdConstants(t *testing.T) {
	if healthThresholdHitRate != 0.50 {
		t.Fatalf("healthThresholdHitRate = %v, want 0.50", healthThresholdHitRate)
	}
	if healthStaleAfter != 7*24*time.Hour {
		t.Fatalf("healthStaleAfter = %v, want 7 days", healthStaleAfter)
	}
}

// --- SQL hygiene across every statement the module renders ---

func TestNoStatementUsesSelectStar(t *testing.T) {
	// Every read must list its columns: a SELECT * against builds, build_images,
	// build_cache_configs or build_logs fails on any database migrated past 016.
	for _, cols := range []string{buildCols, imageCols, configCols, logCols} {
		if strings.Contains(cols, "*") {
			t.Fatalf("column list %q must not use a wildcard", cols)
		}
	}
	// ...and none of them may reference a column 571/572 added that the models do
	// not map, because that would break databases migrated partway.
	for _, cols := range []string{buildCols, imageCols, configCols, logCols} {
		for _, forbidden := range []string{"deleted_at", "created_by", "updated_by"} {
			if strings.Contains(cols, forbidden) {
				t.Fatalf("column list %q references %s, which the models do not map", cols, forbidden)
			}
		}
	}
}

func TestEveryMonitorQueryReadsCacheEventsScopedByTenant(t *testing.T) {
	// The cache monitor used to ignore both of its parameters. Every statement it
	// renders must read cache_events and carry a tenant_id predicate.
	for name, sqlText := range map[string]string{
		"metrics":   metricsSQL,
		"health":    healthSQL,
		"impact":    impactSQL,
		"dashboard": dashboardSQL,
	} {
		if !strings.Contains(sqlText, "cache_events") {
			t.Fatalf("%s query does not read cache_events", name)
		}
		if !strings.Contains(sqlText, "tenant_id") {
			t.Fatalf("%s query is not tenant scoped", name)
		}
	}
}
