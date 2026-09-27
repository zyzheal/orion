package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/visor/models"
	"orion/platform-svc-go/internal/visor/service"

	"github.com/gin-gonic/gin"
)

// ListDashboards, ListHosts and ListAlerts used to read `page` and `page_size`
// with a bare strconv.Atoi and derive `(page-1)*ps` inline. page=-5, page=0
// and page=abc each reached Postgres as a negative OFFSET, which is an error
// instead of a page, so a GET returned a 500. page=abc was the worst: one
// mistyped character, Atoi returning 0 and throwing its error away. Nothing
// capped the size, so page_size=100000 went straight into LIMIT.
//
// The sharpest of the three was ListAlerts: it divides total by ps to build
// total_pages, so ?page_size=0 did not even 500 - it divided by zero and
// panicked.
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
	dashboards []models.Dashboard
	hosts      []models.MonitorHost
	alerts     []models.AlertInstance
	alertTotal int
	listErr    error
	tenantID   string
	dbOff      int
	dbLimit    int
	hoOff      int
	hoLimit    int
	alOff      int
	alLimit    int
	status     string
	severity   string
}

var _ Service = (*fakeService)(nil)

func (f *fakeService) CreateDashboard(ctx context.Context, tenantID string, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
	return &models.Dashboard{ID: "d-1", Name: req.Name}, nil
}
func (f *fakeService) ListDashboards(ctx context.Context, tenantID string, offset, limit int) ([]models.Dashboard, error) {
	f.tenantID, f.dbOff, f.dbLimit = tenantID, offset, limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.dashboards, nil
}
func (f *fakeService) GetDashboard(ctx context.Context, tenantID, id string) (*models.Dashboard, error) {
	return &models.Dashboard{ID: id}, nil
}
func (f *fakeService) UpdateDashboard(ctx context.Context, tenantID, id string, req *models.UpdateDashboardRequest) (*models.Dashboard, error) {
	return &models.Dashboard{ID: id}, nil
}
func (f *fakeService) DeleteDashboard(ctx context.Context, tenantID, id string) error { return nil }
func (f *fakeService) CountDashboards(ctx context.Context, tenantID string) (int, error) {
	return 1, nil
}

func (f *fakeService) CreateHost(ctx context.Context, tenantID string, req *models.CreateHostRequest) (*models.MonitorHost, error) {
	return &models.MonitorHost{ID: "h-1", Name: req.Name}, nil
}
func (f *fakeService) ListHosts(ctx context.Context, tenantID string, offset, limit int) ([]models.MonitorHost, error) {
	f.hoOff, f.hoLimit = offset, limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.hosts, nil
}
func (f *fakeService) GetHost(ctx context.Context, tenantID, id string) (*models.MonitorHost, error) {
	return &models.MonitorHost{ID: id}, nil
}
func (f *fakeService) UpdateHost(ctx context.Context, tenantID, id string, req *models.UpdateHostRequest) (*models.MonitorHost, error) {
	return &models.MonitorHost{ID: id}, nil
}
func (f *fakeService) DeleteHost(ctx context.Context, tenantID, id string) error    { return nil }
func (f *fakeService) CountHosts(ctx context.Context, tenantID string) (int, error) { return 1, nil }
func (f *fakeService) GetHostStatusSummary(ctx context.Context, tenantID string) (map[string]int, error) {
	return map[string]int{}, nil
}
func (f *fakeService) Heartbeat(ctx context.Context, tenantID, hostID string) error { return nil }

func (f *fakeService) CreateAlertRule(ctx context.Context, tenantID string, req *models.CreateAlertRuleRequest) (*models.AlertRule, error) {
	return &models.AlertRule{ID: "r-1"}, nil
}
func (f *fakeService) ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	return nil, nil
}
func (f *fakeService) GetAlertRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	return &models.AlertRule{ID: id}, nil
}
func (f *fakeService) UpdateAlertRule(ctx context.Context, tenantID, id string, req *models.UpdateAlertRuleRequest) (*models.AlertRule, error) {
	return &models.AlertRule{ID: id}, nil
}
func (f *fakeService) DeleteAlertRule(ctx context.Context, tenantID, id string) error { return nil }
func (f *fakeService) ToggleAlertRule(ctx context.Context, tenantID, id string, enabled bool) (*models.AlertRule, error) {
	return &models.AlertRule{ID: id}, nil
}

func (f *fakeService) ListAlerts(ctx context.Context, tenantID, status, severity string, offset, limit int) ([]models.AlertInstance, int, error) {
	f.alOff, f.alLimit = offset, limit
	f.status, f.severity = status, severity
	if f.listErr != nil {
		return nil, 0, f.listErr
	}
	return f.alerts, f.alertTotal, nil
}
func (f *fakeService) GetAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error) {
	return &models.AlertInstance{ID: id}, nil
}
func (f *fakeService) AcknowledgeAlert(ctx context.Context, tenantID, id, userID string) (*models.AlertInstance, error) {
	return &models.AlertInstance{ID: id}, nil
}
func (f *fakeService) ResolveAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error) {
	return &models.AlertInstance{ID: id}, nil
}
func (f *fakeService) GetAlertStats(ctx context.Context, tenantID string) (*models.AlertStats, error) {
	return &models.AlertStats{}, nil
}

func (f *fakeService) RecordMetric(ctx context.Context, tenantID string, req *models.RecordMetricRequest) error {
	return nil
}
func (f *fakeService) QueryMetricSeries(ctx context.Context, tenantID, metricName string, start, end time.Time, maxPoints int) ([]models.MetricDataPoint, error) {
	return nil, nil
}
func (f *fakeService) GetLatestMetricValue(ctx context.Context, tenantID, metricName string) (*float64, error) {
	return nil, nil
}
func (f *fakeService) GetMetricSummary(ctx context.Context, tenantID, metricName string, windowMs int64) (*service.MetricAggregation, error) {
	return nil, nil
}
func (f *fakeService) DetectAnomalies(ctx context.Context, tenantID, metricName string, windowMs int64, threshold float64) ([]service.AnomalyResult, error) {
	return nil, nil
}

func (f *fakeService) EvaluateRules(ctx context.Context, tenantID string) ([]models.AlertInstance, error) {
	return nil, nil
}

func (f *fakeService) CreateChannel(ctx context.Context, tenantID string, req *models.CreateChannelRequest) (*models.NotificationChannel, error) {
	return &models.NotificationChannel{ID: "ch-1"}, nil
}
func (f *fakeService) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	return nil, nil
}
func (f *fakeService) ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error {
	return nil
}
func (f *fakeService) DeleteChannel(ctx context.Context, tenantID, id string) error { return nil }

func (f *fakeService) ListNotificationHistory(ctx context.Context, tenantID, alertID string, limit int) ([]models.NotificationHistory, error) {
	return nil, nil
}
func (f *fakeService) SendNotification(ctx context.Context, tenantID, alertID string, channelIDs []string) ([]models.NotificationHistory, error) {
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
		dashboards: []models.Dashboard{{ID: "d-1", Name: "n1"}},
		hosts:      []models.MonitorHost{{ID: "h-1", Name: "n1"}},
		alerts:     []models.AlertInstance{{ID: "a-1"}},
		alertTotal: 17,
	}
	return NewHandler(f), f
}

func TestListDashboards_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/dashboards", tc.query)
			h.ListDashboards(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.dbOff != tc.wantOff || f.dbLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.dbOff, f.dbLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

func TestListHosts_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/hosts", tc.query)
			h.ListHosts(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.hoOff != tc.wantOff || f.hoLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.hoOff, f.hoLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

func TestListAlerts_PaginationReachesTheService(t *testing.T) {
	h, f := newTestHandler()
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx("/alerts", tc.query)
			h.ListAlerts(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d", w.Code)
			}
			if f.alOff != tc.wantOff || f.alLimit != tc.wantLimit {
				t.Errorf("service got offset=%d limit=%d, want offset=%d limit=%d",
					f.alOff, f.alLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

func TestListAlerts_PassesTheFiltersThrough(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/alerts", "page=2&page_size=25&status=firing&severity=critical")
	h.ListAlerts(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if f.status != "firing" || f.severity != "critical" {
		t.Errorf("filters = %q %q, want firing critical", f.status, f.severity)
	}
	if f.alOff != 25 || f.alLimit != 25 {
		t.Errorf("offset=%d limit=%d, want 25 25", f.alOff, f.alLimit)
	}
}

// ListAlerts is the only one of the three with a paginated envelope, so it is
// the only one that has to report the window it fetched. The cap must reach the
// envelope too: with total=250 and page_size=250 the query fetches the first
// 100 rows but an uncapped envelope would report page_size 250 and one page.
func TestListAlerts_EnvelopeReportsTheCappedWindow(t *testing.T) {
	h, f := newTestHandler()
	f.alertTotal = 250
	c, w := listCtx("/alerts", "page=1&page_size=250")
	h.ListAlerts(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}

	var env struct {
		Success bool `json:"success"`
		Data    struct {
			Total      int `json:"total"`
			Page       int `json:"page"`
			PageSize   int `json:"page_size"`
			TotalPages int `json:"total_pages"`
			Items      []struct {
				ID string `json:"id"`
			} `json:"data"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, w.Body.String())
	}
	if !env.Success {
		t.Fatalf("envelope = %s", w.Body.String())
	}
	if env.Data.PageSize != 100 {
		t.Errorf("page_size = %d, want 100 (the cap)", env.Data.PageSize)
	}
	if env.Data.TotalPages != 3 {
		t.Errorf("total_pages = %d, want 3 (250 rows at a limit of 100)", env.Data.TotalPages)
	}
	if env.Data.Page != 1 || env.Data.Total != 250 {
		t.Errorf("page = %d total = %d, want 1 250", env.Data.Page, env.Data.Total)
	}
}

// page_size=0 used to divide by zero here and panic the request.
func TestListAlerts_ZeroPageSizeDoesNotPanic(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/alerts", "page=3&page_size=0")

	h.ListAlerts(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200\n%s", w.Code, w.Body.String())
	}
	if f.alOff != 40 || f.alLimit != 20 {
		t.Errorf("offset=%d limit=%d, want 40 20", f.alOff, f.alLimit)
	}
}

// A service failure is a 500, not a panic and not an empty page.
// tenant_id is the only isolation axis this module has, so a handler that drops
// it turns every list endpoint into a cross-tenant read.
func TestListDashboards_PassesTheTenantThrough(t *testing.T) {
	h, f := newTestHandler()
	c, w := listCtx("/dashboards", "page=1&page_size=25")
	h.ListDashboards(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if f.tenantID != "tenant-1" {
		t.Errorf("tenant = %q, want tenant-1", f.tenantID)
	}
}

func TestListHosts_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.listErr = errBoom
	c, w := listCtx("/hosts", "page=2&page_size=25")
	h.ListHosts(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

func TestListDashboards_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.listErr = errBoom
	c, w := listCtx("/dashboards", "page=2&page_size=25")
	h.ListDashboards(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

func TestListAlerts_RespondsErrorWhenTheServiceFails(t *testing.T) {
	h, f := newTestHandler()
	f.listErr = errBoom
	c, w := listCtx("/alerts", "page=2&page_size=25")
	h.ListAlerts(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500\n%s", w.Code, w.Body.String())
	}
}

// nil must serialise as [] and not null. The repository declares
// `var items []models.Dashboard`, so an empty table comes back as nil.
func TestListDashboards_NormalisesNilToAnEmptySlice(t *testing.T) {
	h, f := newTestHandler()
	f.dashboards = nil
	c, w := listCtx("/dashboards", "page=1&page_size=25")

	h.ListDashboards(c)
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("nil serialised as %s, want \"data\":[]", w.Body.String())
	}
}

func TestListAlerts_NormalisesNilToAnEmptySlice(t *testing.T) {
	h, f := newTestHandler()
	f.alerts = nil
	c, w := listCtx("/alerts", "page=1&page_size=25")

	h.ListAlerts(c)
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("nil serialised as %s, want \"data\":[]", w.Body.String())
	}
}

// The 36 routes the module mounts. A missing registration is a 404 that only
// shows up in production.
func TestRegisterRoutes_MountsEveryDocumentedRoute(t *testing.T) {
	h := NewHandler(&fakeService{})
	engine := gin.New()
	h.RegisterRoutes(engine.Group("/api/v1"))

	want := map[string]bool{
		"POST /api/v1/dashboards":                        true,
		"GET /api/v1/dashboards":                         true,
		"GET /api/v1/dashboards/count":                   true,
		"GET /api/v1/dashboards/:id":                     true,
		"PUT /api/v1/dashboards/:id":                     true,
		"DELETE /api/v1/dashboards/:id":                  true,
		"POST /api/v1/hosts":                             true,
		"GET /api/v1/hosts":                              true,
		"GET /api/v1/hosts/count":                        true,
		"GET /api/v1/hosts/status":                       true,
		"GET /api/v1/hosts/:id":                          true,
		"PUT /api/v1/hosts/:id":                          true,
		"DELETE /api/v1/hosts/:id":                       true,
		"POST /api/v1/hosts/:id/heartbeat":               true,
		"POST /api/v1/alert-rules":                       true,
		"GET /api/v1/alert-rules":                        true,
		"GET /api/v1/alert-rules/:id":                    true,
		"PUT /api/v1/alert-rules/:id":                    true,
		"DELETE /api/v1/alert-rules/:id":                 true,
		"PATCH /api/v1/alert-rules/:id/toggle":           true,
		"GET /api/v1/alerts":                             true,
		"GET /api/v1/alerts/stats":                       true,
		"GET /api/v1/alerts/:id":                         true,
		"POST /api/v1/alerts/:id/acknowledge":            true,
		"POST /api/v1/alerts/:id/resolve":                true,
		"GET /api/v1/metrics/:id/series":                 true,
		"GET /api/v1/metrics/:id/latest":                 true,
		"GET /api/v1/metrics/:id/summary":                true,
		"GET /api/v1/metrics/:id/anomalies":              true,
		"POST /api/v1/evaluate-rules":                    true,
		"POST /api/v1/notification-channels":             true,
		"GET /api/v1/notification-channels":              true,
		"PATCH /api/v1/notification-channels/:id/toggle": true,
		"DELETE /api/v1/notification-channels/:id":       true,
		"GET /api/v1/notification-history":               true,
		"POST /api/v1/alerts/:id/notify":                 true,
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
