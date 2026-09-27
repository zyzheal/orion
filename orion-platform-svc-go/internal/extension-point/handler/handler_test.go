package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"orion/platform-svc-go/internal/extension-point/models"

	"github.com/gin-gonic/gin"
)

// Both list endpoints used to read `page` and `page_size` with a bare
// strconv.Atoi and derive `(page-1)*ps` twice - once for the service call and
// once for the envelope. `?page=-5`, `?page=0` and `?page=abc` each reached
// Postgres as a negative OFFSET, which is an error instead of a page, so a GET
// returned a 500. `?page=abc` was the worst of them: one mistyped character,
// Atoi returning 0 and throwing its error away.
//
// The cases below deliberately avoid page_size=20. If the handler silently
// dropped its query string, every case would fall back to the default and only
// the two cases expecting the default would fail - which means eight of nine
// would pass for the wrong reason. page_size=25, 30, 40 and -5 are the markers
// that make an input-dropping handler visible.

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

type fakeService struct {
	exts       []models.ExtensionSummary
	startups   []models.StartupTask
	extTotal   int
	startTotal int
	extErr     error
	startErr   error

	extCategory, extStatus string
	extOffset, extLimit    int
	extCalls               int

	startStatus             string
	startOffset, startLimit int
	startCalls              int
}

var _ Service = (*fakeService)(nil)

func (f *fakeService) ListExtensions(ctx context.Context, category, status string, offset, limit int) ([]models.ExtensionSummary, int, error) {
	f.extCalls++
	f.extCategory, f.extStatus, f.extOffset, f.extLimit = category, status, offset, limit
	if f.extErr != nil {
		return nil, 0, f.extErr
	}
	return f.exts, f.extTotal, nil
}

func (f *fakeService) ListStartupTasks(ctx context.Context, status string, offset, limit int) ([]models.StartupTask, int, error) {
	f.startCalls++
	f.startStatus, f.startOffset, f.startLimit = status, offset, limit
	if f.startErr != nil {
		return nil, 0, f.startErr
	}
	return f.startups, f.startTotal, nil
}

func (f *fakeService) GetExtension(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	return &models.ExtensionSummary{Name: name}, nil
}
func (f *fakeService) Register(ctx context.Context, req *models.CreateExtensionRequest) (*models.ExtensionSummary, error) {
	return &models.ExtensionSummary{Name: req.Name}, nil
}
func (f *fakeService) UpdateExtension(ctx context.Context, name string, req *models.UpdateExtensionRequest) (*models.ExtensionSummary, error) {
	return &models.ExtensionSummary{Name: name}, nil
}
func (f *fakeService) InitializeExtension(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	return &models.ExtensionSummary{Name: name, Status: "initialized"}, nil
}
func (f *fakeService) ShutdownExtension(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	return &models.ExtensionSummary{Name: name, Status: "disabled"}, nil
}
func (f *fakeService) GetExtensionStatus(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	return &models.ExtensionSummary{Name: name}, nil
}
func (f *fakeService) CreateStartup(ctx context.Context, names []string) ([]models.StartupTask, error) {
	return nil, nil
}
func (f *fakeService) GetStartupStatus(ctx context.Context, name string) (*models.StartupTask, error) {
	return &models.StartupTask{ID: "t1", Name: name}, nil
}
func (f *fakeService) ListBuiltinPoints(ctx context.Context, category string) ([]models.BuiltinPointMeta, error) {
	return nil, nil
}

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
	f := &fakeService{
		exts:       []models.ExtensionSummary{{Name: "ext-a"}},
		startups:   []models.StartupTask{{ID: "t1", Name: "init:ext-a"}},
		extTotal:   1,
		startTotal: 1,
	}
	return NewHandler(f), f
}

func TestListExtensions_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/api/v1/extension-points", tc.query)
			h.ListExtensions(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.extOffset != tc.wantOff || f.extLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.extOffset, f.extLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

func TestListStartupTasks_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/api/v1/startups", tc.query)
			h.ListStartupTasks(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.startOffset != tc.wantOff || f.startLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.startOffset, f.startLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

// The envelope repeats the same window as the query. Before the offset and
// limit were derived once, the handler computed `(page-1)*ps` twice - for the
// service and again for RespondPaginated - so an edit to one side had to be
// made twice or the envelope reported a window the query never fetched.
func TestListExtensions_EnvelopeMatchesTheQueryWindow(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/api/v1/extension-points", "page=3&page_size=25")

	h.ListExtensions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}

	var env struct {
		Success bool `json:"success"`
		Data    struct {
			Items  []models.ExtensionSummary `json:"data"`
			Offset int                       `json:"offset"`
			Limit  int                       `json:"limit"`
			Total  int                       `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, w.Body.String())
	}
	if !env.Success {
		t.Fatalf("success = false\n%s", w.Body.String())
	}
	if env.Data.Offset != 50 || env.Data.Limit != 25 {
		t.Errorf("envelope offset=%d limit=%d, want 50 25", env.Data.Offset, env.Data.Limit)
	}
	if env.Data.Offset != f.extOffset || env.Data.Limit != f.extLimit {
		t.Errorf("envelope (%d,%d) != service (%d,%d)",
			env.Data.Offset, env.Data.Limit, f.extOffset, f.extLimit)
	}
	if env.Data.Total != 1 {
		t.Errorf("total = %d, want 1", env.Data.Total)
	}
	if len(env.Data.Items) != 1 {
		t.Errorf("page length = %d, want 1", len(env.Data.Items))
	}
}

// The filters travel with the page, and are the reason the envelope total must
// be counted with the same predicate.
func TestListExtensions_PassesTheFiltersThrough(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/api/v1/extension-points", "page=2&page_size=25&category=api&status=disabled")

	h.ListExtensions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if f.extCategory != "api" || f.extStatus != "disabled" {
		t.Errorf("filters = (%q,%q), want (api,disabled)", f.extCategory, f.extStatus)
	}
	if f.extOffset != 25 || f.extLimit != 25 {
		t.Errorf("offset=%d limit=%d, want 25 25", f.extOffset, f.extLimit)
	}
}

func TestListStartupTasks_PassesTheFilterThrough(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/api/v1/startups", "page=2&page_size=30&status=running")

	h.ListStartupTasks(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if f.startStatus != "running" {
		t.Errorf("status = %q, want running", f.startStatus)
	}
	if f.startOffset != 30 || f.startLimit != 30 {
		t.Errorf("offset=%d limit=%d, want 30 30", f.startOffset, f.startLimit)
	}
}

// A service failure is a 500, not a panic and not an empty page.
func TestListExtensions_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.extErr = errBoom
	c, w := listCtx("/api/v1/extension-points", "page=2&page_size=25")

	h.ListExtensions(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

func TestListStartupTasks_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.startErr = errBoom
	c, w := listCtx("/api/v1/startups", "page=2&page_size=25")

	h.ListStartupTasks(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

// nil must serialise as [] and not null: a client iterating the page must not
// have to distinguish the two.
func TestListExtensions_NormalisesNilToAnEmptySlice(t *testing.T) {
	h, f := newTestHandler()
	f.exts = nil
	c, w := listCtx("/api/v1/extension-points", "page=1&page_size=25")

	h.ListExtensions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if got := w.Body.String(); !contains(got, `"data":[]`) {
		t.Errorf("nil serialised as %s, want \"data\":[]", got)
	}
}

func contains(hay, needle string) bool {
	for i := 0; i+len(needle) <= len(hay); i++ {
		if hay[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}

// The ten routes the module advertises. A missing registration is a 404 that
// only shows up in production.
func TestRegisterRoutes_MountsEveryDocumentedRoute(t *testing.T) {
	h := NewHandler(&fakeService{})
	engine := gin.New()
	h.RegisterRoutes(engine.Group("/api/v1"))

	want := map[string]string{
		"GET /api/v1/extension-points":                 "",
		"POST /api/v1/extension-points":                "",
		"GET /api/v1/extension-points/builtins":        "",
		"GET /api/v1/extension-points/health":          "",
		"GET /api/v1/extension-points/:name":           "",
		"PUT /api/v1/extension-points/:name":           "",
		"POST /api/v1/extension-points/:name/init":     "",
		"POST /api/v1/extension-points/:name/shutdown": "",
		"GET /api/v1/extension-points/:name/status":    "",
		"POST /api/v1/startups":                        "",
		"GET /api/v1/startups":                         "",
		"GET /api/v1/startups/:name/status":            "",
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
