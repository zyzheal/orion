package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/security/repository"
	"orion/platform-svc-go/internal/security/service"
)

// ListScans, ListFindings, ListSBOMs, ListDependencyGraphs and
// ListPoisoningScans used to derive their pagination as
//
//	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
//	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
//	h.svc.List(ctx, tenantID, (page-1)*ps, ps)
//
// Page numbering is 1-based, so `?page=-40&page_size=20` derived OFFSET -800
// and `?page=0` derived OFFSET -20. Each of the five repositories binds both
// values straight into `OFFSET $2 LIMIT $3` with no clamp of its own, so
// Postgres rejected the negative OFFSET with an error instead of data and a GET
// answered 500. `?page_size=-5` did the same through a negative LIMIT, and
// `?page_size=0` asked for zero rows while still claiming to serve page 2. The
// handler was the only place on the path that could fix it.
//
// QueryMatcherRegexp lets the expectation be a substring and WithArgs pins the
// bound values, so the test fails on the integer actually handed to the
// database rather than on the response body.
func pageRouter(t *testing.T, table string, wantOffset, wantLimit int) *gin.Engine {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectQuery("FROM "+table+" WHERE").
		WithArgs("t1", wantOffset, wantLimit).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("offset/limit were not clamped before binding: %v", err)
		}
	})

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(withTenant("t1"))
	h := NewHandler(service.NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock"))))
	r.GET("/scans", h.ListScans)
	r.GET("/findings", h.ListFindings)
	r.GET("/sbom", h.ListSBOMs)
	r.GET("/dependency/list", h.ListDependencyGraphs)
	r.GET("/poisoning", h.ListPoisoningScans)
	return r
}

func doPageRequest(t *testing.T, r *gin.Engine, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("%s: expected 200, got %d body=%s", path, w.Code, w.Body.String())
	}
	return w
}

func TestListScans_NegativePageIsClamped(t *testing.T) {
	doPageRequest(t, pageRouter(t, "security_scans", 0, 20), "/scans?page=-40&page_size=20")
}

func TestListScans_ValidPagePassesThrough(t *testing.T) {
	// The clamp is a floor, not a cap: a valid page must reach the repository
	// unchanged.
	doPageRequest(t, pageRouter(t, "security_scans", 40, 20), "/scans?page=3&page_size=20")
}

func TestListFindings_NegativePageIsClamped(t *testing.T) {
	doPageRequest(t, pageRouter(t, "security_findings", 0, 20), "/findings?page=-40&page_size=20")
}

func TestListFindings_NegativePageSizeIsClamped(t *testing.T) {
	doPageRequest(t, pageRouter(t, "security_findings", 20, 20), "/findings?page=2&page_size=-5")
}

func TestListSBOMs_ZeroPageIsClamped(t *testing.T) {
	// Page 0 is one before the first page, and it was the value that read
	// harmlessly in a log line while still sending a negative OFFSET to the
	// database.
	doPageRequest(t, pageRouter(t, "supply_chain_sboms", 0, 25), "/sbom?page=0&page_size=25")
}

func TestListDependencyGraphs_NegativePageIsClamped(t *testing.T) {
	doPageRequest(t, pageRouter(t, "dependency_graphs", 0, 20), "/dependency/list?page=-40&page_size=20")
}

func TestListPoisoningScans_NegativePageSizeIsClamped(t *testing.T) {
	doPageRequest(t, pageRouter(t, "dependency_poisoning_scans", 0, 20), "/poisoning?page=1&page_size=-5")
}

func TestListPoisoningScans_UnparsablePaginationUsesDefaults(t *testing.T) {
	doPageRequest(t, pageRouter(t, "dependency_poisoning_scans", 0, 20), "/poisoning?page=abc&page_size=junk")
}

func TestListPoisoningScans_AbsentPaginationUsesDefaults(t *testing.T) {
	doPageRequest(t, pageRouter(t, "dependency_poisoning_scans", 0, 20), "/poisoning")
}
