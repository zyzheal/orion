package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/workflow/workflow/repository"
	"orion/platform-svc-go/internal/workflow/workflow/service"
)

// List used to derive its pagination as
//
//	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
//	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
//	h.svc.ListDefinitions(ctx, tenantID, nil, (page-1)*ps, ps)
//
// Page numbering is 1-based, so `?page=-40&page_size=20` derived OFFSET -800
// and `?page=0` derived OFFSET -20. The repository binds both values straight
// into `OFFSET $2 LIMIT $3` with no clamp of its own, so Postgres rejected the
// negative OFFSET with an error instead of data and a GET answered 500.
// `?page_size=-5` did the same through a negative LIMIT, and `?page_size=0`
// asked for zero rows while still claiming to serve page 2. WithArgs pins the
// bound values, so the test fails on the integer actually handed to the
// database rather than on the response body.
func pageTestHandler(t *testing.T, wantOffset, wantLimit int) *Handler {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectQuery("FROM workflow_definitions WHERE").
		WithArgs("tenant-a", wantOffset, wantLimit).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("offset/limit were not clamped before binding: %v", err)
		}
	})
	return NewHandler(service.NewService(repository.NewRepository(sqlx.NewDb(db, "postgres"))))
}

func listCtx(path string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	c.Params = gin.Params{}
	c.Set("tenant_id", "tenant-a")
	return c, w
}

func doList(t *testing.T, h *Handler, path string) {
	t.Helper()
	c, w := listCtx(path)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("%s: expected 200, got %d body=%s", path, w.Code, w.Body.String())
	}
}

func TestList_NegativePageIsClamped(t *testing.T) {
	doList(t, pageTestHandler(t, 0, 20), "/workflows?page=-40&page_size=20")
}

func TestList_ZeroPageIsClamped(t *testing.T) {
	// Page 0 is one before the first page, and it was the value that read
	// harmlessly in a log line while still sending a negative OFFSET to the
	// database.
	doList(t, pageTestHandler(t, 0, 25), "/workflows?page=0&page_size=25")
}

func TestList_NegativePageSizeIsClamped(t *testing.T) {
	doList(t, pageTestHandler(t, 20, 20), "/workflows?page=2&page_size=-5")
}

func TestList_UnparsablePaginationUsesDefaults(t *testing.T) {
	doList(t, pageTestHandler(t, 0, 20), "/workflows?page=abc&page_size=junk")
}

func TestList_AbsentPaginationUsesDefaults(t *testing.T) {
	doList(t, pageTestHandler(t, 0, 20), "/workflows")
}

func TestList_ValidPagePassesThrough(t *testing.T) {
	// The clamp is a floor, not a cap: a valid page must reach the repository
	// unchanged.
	doList(t, pageTestHandler(t, 50, 25), "/workflows?page=3&page_size=25")
}
