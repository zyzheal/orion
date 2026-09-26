package handler

import (
	"database/sql/driver"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/alert-adapter/repository"
	"orion/platform-svc-go/internal/alert-adapter/service"
)

// ListAdapters used to read `page` and `page_size`, then call
//
//	h.svc.ListAdapters(ctx, tenantID)
//
// dropping both, and reply with
//
//	RespondPaginated(c, items, (page-1)*ps, ps, len(items))
//
// which wrote the client's own values into the response envelope. The factory
// underneath hardcoded `offset 0, limit 100`, so the catalog endpoint always
// returned the tenant's whole adapter list no matter what page the client asked
// for, while reporting `offset=980` for `?page=50&page_size=20`. RespondPaginated
// only assembles gin.H fields and performs no division, so there was no panic
// and no 500 — the mismatch was invisible to every caller.
//
// The tests below pin the arguments actually bound into
// `OFFSET $2 LIMIT $3` on alert_adapters, which is the only evidence that the
// client's page reached the database.
func pageRouter(t *testing.T, table string, wantArgs ...driver.Value) *gin.Engine {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectQuery("FROM " + table + " WHERE").
		WithArgs(wantArgs...).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("pagination did not reach the database as intended: %v", err)
		}
	})

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Next()
	})
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	h := NewHandler(service.NewAdapterService(service.NewFactory(repo, nil), repo))
	r.GET("/alert-adapters", h.ListAdapters)
	r.GET("/alert-adapters/:id/events", h.ListEvents)
	return r
}

func doGet(t *testing.T, r *gin.Engine, path string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("%s: expected 200, got %d body=%s", path, w.Code, w.Body.String())
	}
	return w
}

func TestListAdapters_NegativePageIsClamped(t *testing.T) {
	doGet(t, pageRouter(t, "alert_adapters", "tenant-1", 0, 20), "/alert-adapters?page=-40&page_size=20")
}

func TestListAdapters_ZeroPageIsClamped(t *testing.T) {
	// Page 0 is one before the first page, and it read harmlessly in a log line
	// while still sending a negative OFFSET to the database.
	doGet(t, pageRouter(t, "alert_adapters", "tenant-1", 0, 25), "/alert-adapters?page=0&page_size=25")
}

func TestListAdapters_NegativePageSizeIsClamped(t *testing.T) {
	doGet(t, pageRouter(t, "alert_adapters", "tenant-1", 20, 20), "/alert-adapters?page=2&page_size=-5")
}

func TestListAdapters_UnparsablePaginationUsesDefaults(t *testing.T) {
	doGet(t, pageRouter(t, "alert_adapters", "tenant-1", 0, 20), "/alert-adapters?page=abc&page_size=junk")
}

func TestListAdapters_AbsentPaginationUsesDefaults(t *testing.T) {
	doGet(t, pageRouter(t, "alert_adapters", "tenant-1", 0, 20), "/alert-adapters")
}

// The regression this test exists for. Before the fix the factory hardcoded
// offset 0 / limit 100, so this request bound (tenant-1, 0, 100) while the
// envelope reported offset 50.
func TestListAdapters_ValidPageReachesTheDatabase(t *testing.T) {
	w := doGet(t, pageRouter(t, "alert_adapters", "tenant-1", 50, 25), "/alert-adapters?page=3&page_size=25")
	// The envelope must report the same offset the query used, not the client's.
	if !strings.Contains(w.Body.String(), `"offset":50`) || !strings.Contains(w.Body.String(), `"limit":25`) {
		t.Fatalf("envelope offset/limit must match the bound values, got %s", w.Body.String())
	}
}

func TestListEvents_NegativePageIsClamped(t *testing.T) {
	doGet(t, pageRouter(t, "alert_events", "e-1", "tenant-1", 0, 20), "/alert-adapters/e-1/events?page=-40&page_size=20")
}

func TestListEvents_NegativePageSizeIsClamped(t *testing.T) {
	doGet(t, pageRouter(t, "alert_events", "e-1", "tenant-1", 20, 20), "/alert-adapters/e-1/events?page=2&page_size=-5")
}

func TestListEvents_UnparsablePaginationUsesDefaults(t *testing.T) {
	doGet(t, pageRouter(t, "alert_events", "e-1", "tenant-1", 0, 20), "/alert-adapters/e-1/events?page=abc&page_size=junk")
}

func TestListEvents_ValidPageReachesTheDatabase(t *testing.T) {
	doGet(t, pageRouter(t, "alert_events", "e-1", "tenant-1", 50, 25), "/alert-adapters/e-1/events?page=3&page_size=25")
}
