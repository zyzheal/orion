package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode"

	"orion/platform-svc-go/internal/infrastructure/digital-twin/repository"
	"orion/platform-svc-go/internal/infrastructure/digital-twin/service"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

func newTestDB(t *testing.T) (sqlmock.Sqlmock, *service.Service) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(
		func(expected, actual string) error {
			collapse := func(s string) string {
				var b strings.Builder
				seen := false
				for _, r := range s {
					if unicode.IsSpace(r) {
						if !seen {
							b.WriteByte(' ')
						}
						seen = true
					} else {
						b.WriteRune(r)
						seen = false
					}
				}
				return strings.TrimSpace(b.String())
			}
			if collapse(expected) != collapse(actual) {
				return &queryMismatch{got: actual}
			}
			return nil
		})))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	return mock, service.NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock")))
}

type queryMismatch struct{ got string }

func (e *queryMismatch) Error() string { return "sql does not match: " + e.got }

// paginationCases is the shared table every migrated list handler in this
// series runs. Cases with sane input are no-ops against the old bare-Atoi
// code on purpose; they pin the common path so a future edit cannot break it.
func paginationCases() []struct {
	name      string
	query     string
	wantOff   int
	wantLimit int
} {
	return []struct {
		name      string
		query     string
		wantOff   int
		wantLimit int
	}{
		{"pageOneIsOffsetZero", "?page=1&page_size=25", 0, 25},
		{"happyThreeByTwenty", "?page=3&page_size=20", 40, 20},
		{"happyTwoByTwentyFive", "?page=2&page_size=25", 25, 25},
		{"absentUsesDefaults", "", 0, 20},
		{"negativePageIsClamped", "?page=-5", 0, 20},
		{"zeroPageIsClamped", "?page=0&page_size=25", 0, 25},
		{"unparsablePageUsesDefault", "?page=abc&page_size=25", 0, 25},
		{"negativePageSizeIsClamped", "?page_size=-5", 0, 20},
		{"unparsablePageSizeUsesDefault", "?page=2&page_size=abc", 20, 20},
		{"pageSizeCapAppliesBeforeDeriving", "?page=3&page_size=250", 200, 100},
	}
}

func listCtx(t *testing.T, query string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/twins"+query, nil)
	c.Set("tenant_id", "tenant-1")
	return c, w
}

func TestList_PaginationReachesTheDatabase(t *testing.T) {
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			mock, svc := newTestDB(t)
			mock.ExpectQuery("SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
				WithArgs("tenant-1", tc.wantOff, tc.wantLimit).
				WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "environment", "services", "sync_interval", "data_retention_days", "status", "health_score", "service_states", "entity_type", "state", "config", "last_synced", "created_at", "updated_at"}))
			c, w := listCtx(t, tc.query)
			NewHandler(svc).List(c)
			if w.Code != http.StatusOK {
				t.Errorf("status = %d, want 200", w.Code)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("unmet expectations: %v", err)
			}
		})
	}
}

// The envelope must be the page itself, not a wrapper around it. A bare slice
// means there is no total field to drift, so the only honest assertion is the
// shape of `data`.
func TestList_EnvelopeIsThePage(t *testing.T) {
	mock, svc := newTestDB(t)
	now := time.Now()
	rows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "environment", "services", "sync_interval", "data_retention_days", "status", "health_score", "service_states", "entity_type", "state", "config", "last_synced", "created_at", "updated_at"})
	rows.AddRow("t-1", "tenant-1", "n1", "dev", []byte("{}"), 60, 30, "active", 100, []byte("{}"), "k8s", []byte("{}"), []byte("{}"), nil, now, now)
	mock.ExpectQuery("SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(rows)
	c, w := listCtx(t, "?page=1&page_size=20")
	NewHandler(svc).List(c)
	body := w.Body.String()
	if !strings.Contains(body, `"success":true`) {
		t.Errorf("body missing success=true: %s", body)
	}
	if !strings.Contains(body, `"data":[`) {
		t.Errorf("body did not put the page directly in data: %s", body)
	}
	if strings.Contains(body, `"total"`) {
		t.Errorf("body must not invent a total: %s", body)
	}
}

// The repository returns a nil slice for an empty table; without the guard the
// client would see `data: null` instead of `data: []`.
func TestList_NormalisesNilToAnEmptySlice(t *testing.T) {
	mock, svc := newTestDB(t)
	mock.ExpectQuery("SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	c, w := listCtx(t, "?page=1")
	NewHandler(svc).List(c)
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("expected data:[] for an empty table, got: %s", w.Body.String())
	}
}

// The module is namespaced in the router: twinH owns /api/v1/twins, so
// this handler registers under the bare prefix. Asserting the real prefix
// keeps a future prefix change from going unnoticed.
func TestRegisterRoutes_MountsEveryDocumentedRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	_, svc := newTestDB(t)
	NewHandler(svc).RegisterRoutes(engine.Group("/api/v1"))
	want := map[string]bool{
		http.MethodPost + " /api/v1/twins": false,
	}
	for _, rt := range engine.Routes() {
		want[rt.Method+" "+rt.Path] = true
	}
	for r, seen := range want {
		if !seen {
			t.Errorf("route %s not registered", r)
		}
	}
}
