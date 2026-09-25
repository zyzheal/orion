package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/cmdb-collector/repository"
	"orion/platform-svc-go/internal/cmdb-collector/service"
)

// looseRouter mounts both collector handlers behind a regexp SQL matcher so the
// pagination tests do not have to pin the full query text.
func looseRouter(t *testing.T, tenantID string) (sqlmock.Sqlmock, *gin.Engine) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	e := gin.New()
	e.Use(func(c *gin.Context) {
		if tenantID != "" {
			c.Set("tenant_id", tenantID)
		}
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	NewHandler(service.NewService(repo, nil, nil)).RegisterRoutes(e.Group("/api/v1"))
	NewFactoryHandler(service.NewAdapterFactory(repo, nil, nil)).RegisterRoutes(e.Group("/api/cmdb"))
	return mock, e
}

// emptyRows satisfies any SELECT scan with zero rows: the handlers only need a
// successful query to reach the Page calculation.
func emptyRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id"})
}

// TestListCollections_ZeroLimitIsClamped — `?limit=0` reached the Page
// calculation as offset/limit + 1 and panicked with "integer divide by zero",
// which gin.Recovery turned into a 500. It also meant LIMIT 0 for the query
// itself, so even without the panic the caller got an empty page.
func TestListCollections_ZeroLimitIsClamped(t *testing.T) {
	mock, e := looseRouter(t, "tenant-1")
	mock.ExpectQuery("FROM cmdb_collections").WillReturnRows(emptyRows())
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request("GET", "/api/v1/collector/collections?limit=0", ""))
	assertClampedPage(t, w)
}

func TestListDevices_ZeroLimitIsClamped(t *testing.T) {
	mock, e := looseRouter(t, "tenant-1")
	mock.ExpectQuery("FROM cmdb_devices").WillReturnRows(emptyRows())
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request("GET", "/api/v1/collector/devices?limit=0", ""))
	assertClampedPage(t, w)
}

func TestListJobs_ZeroLimitIsClamped(t *testing.T) {
	mock, e := looseRouter(t, "tenant-1")
	mock.ExpectQuery("FROM cmdb_discovery_jobs").WillReturnRows(emptyRows())
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request("GET", "/api/cmdb/discoveries?limit=0", ""))
	assertClampedPage(t, w)
}

func TestListAssets_ZeroLimitIsClamped(t *testing.T) {
	mock, e := looseRouter(t, "tenant-1")
	mock.ExpectQuery("FROM cmdb_assets").WillReturnRows(emptyRows())
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request("GET", "/api/cmdb/assets?limit=0", ""))
	assertClampedPage(t, w)
}

// A valid limit must pass through untouched: the clamp is a floor, not a cap.
func TestListDevices_ValidLimitUnchanged(t *testing.T) {
	mock, e := looseRouter(t, "tenant-1")
	mock.ExpectQuery("FROM cmdb_devices").WillReturnRows(emptyRows())
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request("GET", "/api/v1/collector/devices?limit=7&offset=14", ""))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"pageSize":7`) || !strings.Contains(w.Body.String(), `"page":3`) {
		t.Fatalf("expected page 3 of size 7, got %s", w.Body.String())
	}
}

func assertClampedPage(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"pageSize":20`) || !strings.Contains(w.Body.String(), `"page":1`) {
		t.Fatalf("expected the default page, got %s", w.Body.String())
	}
}

// argCheckedRouter is looseRouter with the bound arguments pinned: without the
// clamp, ?offset=-40 reaches the database as OFFSET -40, which Postgres
// rejects with an error instead of data. Each unfiltered list binds exactly
// (tenantID, offset, limit), so the expectation is the same for all five.
func argCheckedRouter(t *testing.T, table string) *gin.Engine {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectQuery("FROM "+table).
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(emptyRows())

	e := gin.New()
	e.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	NewHandler(service.NewService(repo, nil, nil)).RegisterRoutes(e.Group("/api/v1"))
	NewFactoryHandler(service.NewAdapterFactory(repo, nil, nil)).RegisterRoutes(e.Group("/api/cmdb"))
	return e
}

// A negative offset is clamped to 0. Without the clamp it reaches Postgres as a
// negative OFFSET, which is rejected with an error instead of data, and
// offset/limit + 1 puts 0 or a negative number in the response's page field.
func TestListCollections_NegativeOffsetIsClamped(t *testing.T) {
	w := httptest.NewRecorder()
	argCheckedRouter(t, "cmdb_collections").ServeHTTP(w, request("GET", "/api/v1/collector/collections?offset=-40", ""))
	assertClampedPage(t, w)
}

func TestListDevices_NegativeOffsetIsClamped(t *testing.T) {
	w := httptest.NewRecorder()
	argCheckedRouter(t, "cmdb_devices").ServeHTTP(w, request("GET", "/api/v1/collector/devices?offset=-40", ""))
	assertClampedPage(t, w)
}

func TestListJobs_NegativeOffsetIsClamped(t *testing.T) {
	w := httptest.NewRecorder()
	argCheckedRouter(t, "cmdb_discovery_jobs").ServeHTTP(w, request("GET", "/api/cmdb/discoveries?offset=-40", ""))
	assertClampedPage(t, w)
}

func TestListAssets_NegativeOffsetIsClamped(t *testing.T) {
	w := httptest.NewRecorder()
	argCheckedRouter(t, "cmdb_assets").ServeHTTP(w, request("GET", "/api/cmdb/assets?offset=-40", ""))
	assertClampedPage(t, w)
}

// ListAdapters has no page field in its response, so here the clamp shows up
// only in the argument that gets bound.
func TestListAdapters_NegativeOffsetIsClamped(t *testing.T) {
	w := httptest.NewRecorder()
	argCheckedRouter(t, "cmdb_adapters").ServeHTTP(w, request("GET", "/api/cmdb/adapters?offset=-40", ""))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
}
