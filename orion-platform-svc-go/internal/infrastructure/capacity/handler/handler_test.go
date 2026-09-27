package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/infrastructure/capacity/models"

	"github.com/gin-gonic/gin"
)

// ListPools, ListForecasts and ListReports used to read `page` and `page_size`
// with a bare strconv.Atoi and derive `(page-1)*ps` inline. page=-5, page=0
// and page=abc each reached Postgres as a negative OFFSET, which is an error
// instead of a page, so a GET returned a 500. page=abc was the worst: one
// mistyped character, Atoi returning 0 and throwing its error away. Nothing
// capped the size, so page_size=100000 went straight into LIMIT.
//
// The cases below deliberately avoid page_size=20: if a handler silently
// dropped its query string, every case would fall back to the default and only
// the two cases expecting the default would fail. page_size=25, 30, 40 and
// -5 are the markers that make an input-dropping handler visible.

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

type fakeService struct {
	pools     []models.ResourcePool
	forecasts []models.CapacityForecast
	reports   []models.CapacityReport
	listErr   error
	tenantID  string
	poolOff   int
	poolLimit int
	fcOff     int
	fcLimit   int
	repOff    int
	repLimit  int
	poolCalls int
	fcCalls   int
	repCalls  int
}

var _ Service = (*fakeService)(nil)

func (f *fakeService) CreatePool(ctx context.Context, tenantID string, req *models.CreatePoolRequest) (*models.ResourcePool, error) {
	return &models.ResourcePool{ID: "pool-1", Name: req.Name}, nil
}
func (f *fakeService) ListPools(ctx context.Context, tenantID string, offset, limit int) ([]models.ResourcePool, error) {
	f.poolCalls++
	f.tenantID, f.poolOff, f.poolLimit = tenantID, offset, limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.pools, nil
}
func (f *fakeService) GetPool(ctx context.Context, tenantID, id string) (*models.ResourcePool, error) {
	return &models.ResourcePool{ID: id}, nil
}
func (f *fakeService) UpdatePool(ctx context.Context, tenantID, id string, req *models.CreatePoolRequest) (*models.ResourcePool, error) {
	return &models.ResourcePool{ID: id}, nil
}
func (f *fakeService) ListForecasts(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityForecast, error) {
	f.fcCalls++
	f.fcOff, f.fcLimit = offset, limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.forecasts, nil
}
func (f *fakeService) CreatePolicy(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.ScalingPolicy, error) {
	return &models.ScalingPolicy{}, nil
}
func (f *fakeService) ListPolicies(ctx context.Context, tenantID string) ([]models.ScalingPolicy, error) {
	return nil, nil
}
func (f *fakeService) Delete(ctx context.Context, tenantID, id string) error   { return nil }
func (f *fakeService) Count(ctx context.Context, tenantID string) (int, error) { return 1, nil }
func (f *fakeService) RecordMetric(ctx context.Context, tenantID string, req *models.RecordMetricRequest) (*models.CapacityMetric, error) {
	return &models.CapacityMetric{}, nil
}
func (f *fakeService) ListMetrics(ctx context.Context, tenantID string, f2 *models.MetricFilter) ([]models.CapacityMetric, error) {
	return nil, nil
}
func (f *fakeService) GenerateForecast(ctx context.Context, tenantID string) ([]models.CapacityForecast, error) {
	return nil, nil
}
func (f *fakeService) ListAlerts(ctx context.Context, tenantID string, f2 *models.AlertFilter) ([]models.CapacityAlert, error) {
	return nil, nil
}
func (f *fakeService) DeleteAlert(ctx context.Context, id string) error { return nil }
func (f *fakeService) GenerateReport(ctx context.Context, tenantID, title string) (*models.CapacityReport, error) {
	return &models.CapacityReport{ID: "rep-1", Title: title}, nil
}
func (f *fakeService) GetReport(ctx context.Context, tenantID, id string) (*models.CapacityReport, error) {
	return &models.CapacityReport{ID: id}, nil
}
func (f *fakeService) AnalyzeBottlenecks(ctx context.Context, tenantID string) ([]models.Bottleneck, error) {
	return nil, nil
}

func (f *fakeService) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityReport, error) {
	f.repCalls++
	f.repOff, f.repLimit = offset, limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.reports, nil
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
		pools:     []models.ResourcePool{{ID: "pool-1", Name: "n1"}},
		forecasts: []models.CapacityForecast{{ID: "fc-1"}},
		reports:   []models.CapacityReport{{ID: "rep-1"}},
	}
	return NewHandler(f), f
}

func TestListPools_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/capacity/pools", tc.query)
			h.ListPools(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.poolOff != tc.wantOff || f.poolLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.poolOff, f.poolLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

func TestListForecasts_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/capacity/forecasts", tc.query)
			h.ListForecasts(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.fcOff != tc.wantOff || f.fcLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.fcOff, f.fcLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

func TestListReports_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/capacity/reports", tc.query)
			h.ListReports(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.repOff != tc.wantOff || f.repLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.repOff, f.repLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

// These handlers pass the tenant through to the service, unlike extension-point.
func TestListPools_PassesTheTenantThrough(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/capacity/pools", "page=2&page_size=25")
	h.ListPools(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if f.tenantID != "tenant-1" {
		t.Errorf("tenant = %q, want tenant-1", f.tenantID)
	}
	if f.poolOff != 25 || f.poolLimit != 25 {
		t.Errorf("offset=%d limit=%d, want 25 25", f.poolOff, f.poolLimit)
	}
}

// The envelope is a bare slice: it carries no offset, limit or total, so there
// is no window in the response to drift from the query.
func TestListPools_EnvelopeIsThePage(t *testing.T) {
	h, _ := newTestHandler()
	c, w := listCtx("/capacity/pools", "page=3&page_size=25")
	h.ListPools(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}

	var env struct {
		Success bool                  `json:"success"`
		Data    []models.ResourcePool `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, w.Body.String())
	}
	if !env.Success || len(env.Data) != 1 || env.Data[0].ID != "pool-1" {
		t.Fatalf("envelope = %s", w.Body.String())
	}
}

// A service failure is a 500, not a panic and not an empty page.
func TestListPools_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.listErr = errBoom
	c, w := listCtx("/capacity/pools", "page=2&page_size=25")
	h.ListPools(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

func TestListForecasts_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.listErr = errBoom
	c, w := listCtx("/capacity/forecasts", "page=2&page_size=25")
	h.ListForecasts(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

// nil must serialise as [] and not null. The repository declares
// `var items []models.ResourcePool`, so an empty table comes back as nil.
func TestListPools_NormalisesNilToAnEmptySlice(t *testing.T) {
	h, f := newTestHandler()
	f.pools = nil
	c, w := listCtx("/capacity/pools", "page=1&page_size=25")

	h.ListPools(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("nil serialised as %s, want \"data\":[]", w.Body.String())
	}
}

func TestListForecasts_NormalisesNilToAnEmptySlice(t *testing.T) {
	h, f := newTestHandler()
	f.forecasts = nil
	c, w := listCtx("/capacity/forecasts", "page=1&page_size=25")

	h.ListForecasts(c)
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("nil serialised as %s, want \"data\":[]", w.Body.String())
	}
}

// The seventeen routes the module mounts. A missing registration is a 404 that
// only shows up in production.
func TestRegisterRoutes_MountsEveryDocumentedRoute(t *testing.T) {
	h := NewHandler(&fakeService{})
	engine := gin.New()
	h.RegisterRoutes(engine.Group("/api/v1"))

	want := map[string]bool{
		"POST /api/v1/capacity/pools":              true,
		"GET /api/v1/capacity/pools":               true,
		"GET /api/v1/capacity/pools/:id":           true,
		"PUT /api/v1/capacity/pools/:id":           true,
		"DELETE /api/v1/capacity/pools/:id":        true,
		"GET /api/v1/capacity/pools-count":         true,
		"POST /api/v1/capacity/metrics":            true,
		"GET /api/v1/capacity/metrics":             true,
		"POST /api/v1/capacity/forecasts/generate": true,
		"GET /api/v1/capacity/forecasts":           true,
		"DELETE /api/v1/capacity/alerts/:id":       true,
		"POST /api/v1/capacity/reports/generate":   true,
		"GET /api/v1/capacity/reports":             true,
		"GET /api/v1/capacity/reports/:id":         true,
		"GET /api/v1/capacity/bottlenecks":         true,
		"POST /api/v1/capacity/policies":           true,
		"GET /api/v1/capacity/policies":            true,
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
