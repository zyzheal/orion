package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/ai/intelligence/models"

	"github.com/gin-gonic/gin"
)

// List used to read `page` and `page_size` with a bare strconv.Atoi and derive
// `(page-1)*ps` inline. page=-5, page=0 and page=abc each reached Postgres as a
// negative OFFSET - an error instead of a page - so a GET returned a 500.
// page=abc was the worst of them: one mistyped character, Atoi returning 0 and
// throwing its error away. Nothing capped the size, so page_size=100000 went
// straight into LIMIT.
//
// The cases below deliberately avoid page_size=20: if a handler silently dropped
// its query string, every case would fall back to the default and only the two
// cases expecting the default would fail. page_size=25, 30, 40 and -5 are the
// markers that make an input-dropping handler visible.

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

type fakeService struct {
	tasks      []models.IntelligenceTask
	listErr    error
	tenantID   string
	lastOffset int
	lastLimit  int
}

var _ Service = (*fakeService)(nil)

func (f *fakeService) Create(ctx context.Context, tenantID string, req *models.CreateIntelligenceTaskRequest) (*models.IntelligenceTask, error) {
	return &models.IntelligenceTask{ID: "t-1", Name: req.Name}, nil
}
func (f *fakeService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.IntelligenceTask, error) {
	f.tenantID, f.lastOffset, f.lastLimit = tenantID, offset, limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.tasks, nil
}
func (f *fakeService) GetByID(ctx context.Context, tenantID, id string) (*models.IntelligenceTask, error) {
	return &models.IntelligenceTask{ID: id}, nil
}
func (f *fakeService) Delete(ctx context.Context, tenantID, id string) error   { return nil }
func (f *fakeService) Count(ctx context.Context, tenantID string) (int, error) { return 1, nil }

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
		{"negativePageIsClamped", "page=-40&page_size=25", 0, 25},
		{"zeroPageIsClamped", "page=0&page_size=30", 0, 30},
		{"negativePageSizeIsClamped", "page=2&page_size=-5", 20, 20},
		{"zeroPageSizeFallsBack", "page=3&page_size=0", 40, 20},
		{"unparsableUsesDefaults", "page=abc&page_size=", 0, 20},
		{"absentUsesDefaults", "", 0, 20},
		{"validPageReachesTheService", "page=3&page_size=25", 50, 25},
		{"pageOneIsOffsetZero", "page=1&page_size=40", 0, 40},
		{"largePageIsPreserved", "page=40&page_size=20", 780, 20},
		{"pageSizeCapAppliesBeforeDeriving", "page=3&page_size=250", 200, 100},
	}
}

// listCtx seeds one list request. The query is joined with '?' rather than
// concatenated: concatenation folds the query into the path, c.Query returns
// empty for every case, and eight of the ten would pass for the wrong reason.
func listCtx(path, query string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	url := path
	if query != "" {
		url = path + "?" + query
	}
	c.Request = httptest.NewRequest(http.MethodGet, url, nil)
	return c, w
}

func newTestHandler() (*Handler, *fakeService) {
	f := &fakeService{tasks: []models.IntelligenceTask{{ID: "t-1", Name: "n1"}}}
	return NewHandler(f), f
}

func TestList_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/tasks", tc.query)
			h.List(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.lastOffset != tc.wantOff || f.lastLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.lastOffset, f.lastLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

// tenant_id is the only isolation axis this module has, so a handler that drops
// it turns the list endpoint into a cross-tenant read.
func TestList_PassesTheTenantThrough(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/tasks", "page=1&page_size=25")
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if f.tenantID != "tenant-1" {
		t.Errorf("tenant = %q, want tenant-1", f.tenantID)
	}
}

// The envelope is a bare slice, so the whole contract is "the data IS the page".
func TestList_EnvelopeIsThePage(t *testing.T) {
	h, _ := newTestHandler()
	c, w := listCtx("/tasks", "page=2&page_size=25")
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}

	var env struct {
		Success bool `json:"success"`
		Data    []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, w.Body.String())
	}
	if !env.Success {
		t.Fatalf("envelope = %s", w.Body.String())
	}
	if len(env.Data) != 1 || env.Data[0].ID != "t-1" {
		t.Errorf("data = %s, want one task t-1", w.Body.String())
	}
}

func TestList_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.listErr = errBoom
	c, w := listCtx("/tasks", "page=2&page_size=25")
	h.List(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

// nil must serialise as [] and not null. The repository declares
// `var items []models.IntelligenceTask`, so an empty table comes back as nil.
func TestList_NormalisesNilToAnEmptySlice(t *testing.T) {
	h, f := newTestHandler()
	f.tasks = nil
	c, w := listCtx("/tasks", "page=1&page_size=25")

	h.List(c)
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("nil serialised as %s, want \"data\":[]", w.Body.String())
	}
}

// The 5 routes the module mounts. A missing registration is a 404 that only
// shows up in production.
func TestRegisterRoutes_MountsEveryDocumentedRoute(t *testing.T) {
	h := NewHandler(&fakeService{})
	engine := gin.New()
	h.RegisterRoutes(engine.Group("/api/v1"))

	want := map[string]bool{
		"POST /api/v1/tasks":       true,
		"GET /api/v1/tasks":        true,
		"GET /api/v1/tasks/:id":    true,
		"DELETE /api/v1/tasks/:id": true,
		"GET /api/v1/tasks/count":  true,
	}

	got := map[string]bool{}
	for _, r := range engine.Routes() {
		got[r.Method+" "+r.Path] = true
	}
	if len(got) != len(want) {
		t.Fatalf("mounted %d routes, want %d: %v", len(got), len(want), got)
	}
	for route := range want {
		if !got[route] {
			t.Errorf("route %s not mounted", route)
		}
	}
}

var errBoom = newBoom("boom")

type boom struct{ msg string }

func newBoom(msg string) error { return &boom{msg} }
func (b *boom) Error() string  { return b.msg }
