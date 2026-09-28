package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/governance/governance/models"

	"github.com/gin-gonic/gin"
)

// fakeService records the window it was asked for so a test can assert what the
// handler sent down, not what it sent back.
type fakeService struct {
	tasks       []models.Policy
	tenantID    string
	lastOffset  int
	lastLimit   int
	listErr     error
	emptyResult bool
}

var _ Service = (*fakeService)(nil)

func (f *fakeService) Create(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.Policy, error) {
	return &models.Policy{ID: "p-1", TenantID: tenantID, Name: req.Name}, nil
}

func (f *fakeService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Policy, error) {
	f.tenantID = tenantID
	f.lastOffset = offset
	f.lastLimit = limit
	if f.listErr != nil {
		return nil, f.listErr
	}
	if f.emptyResult {
		return nil, nil
	}
	return f.tasks, nil
}

func (f *fakeService) GetByID(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	return &models.Policy{ID: id, TenantID: tenantID}, nil
}

func (f *fakeService) Delete(ctx context.Context, tenantID, id string) error { return nil }

func (f *fakeService) Count(ctx context.Context, tenantID string) (int, error) { return 3, nil }

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

func listCtx(t *testing.T, query string, svc Service) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/governance/policies"+query, nil)
	c.Set("tenant_id", "tenant-1")
	return c, w
}

func TestList_PaginationReachesTheService(t *testing.T) {
	for _, tc := range paginationCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			svc := &fakeService{tasks: []models.Policy{{ID: "p-1"}}}
			c, w := listCtx(t, tc.query, svc)
			NewHandler(svc).List(c)
			if svc.lastOffset != tc.wantOff {
				t.Errorf("offset = %d, want %d", svc.lastOffset, tc.wantOff)
			}
			if svc.lastLimit != tc.wantLimit {
				t.Errorf("limit = %d, want %d", svc.lastLimit, tc.wantLimit)
			}
			if w.Code != http.StatusOK {
				t.Errorf("status = %d, want 200", w.Code)
			}
		})
	}
}

func TestList_PassesTheTenantThrough(t *testing.T) {
	svc := &fakeService{}
	c, _ := listCtx(t, "?page=2&page_size=10", svc)
	NewHandler(svc).List(c)
	if svc.tenantID != "tenant-1" {
		t.Errorf("tenantID = %q, want %q", svc.tenantID, "tenant-1")
	}
}

// The envelope must be the page itself, not a wrapper around it. A bare slice
// means there is no total field to drift, so the only honest assertion is the
// shape of `data`.
func TestList_EnvelopeIsThePage(t *testing.T) {
	svc := &fakeService{tasks: []models.Policy{{ID: "p-1", Name: "n1"}}}
	c, w := listCtx(t, "?page=1&page_size=20", svc)
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

func TestList_RespondsErrorWhenTheServiceFails(t *testing.T) {
	svc := &fakeService{listErr: errors.New("boom")}
	c, w := listCtx(t, "?page=1", svc)
	NewHandler(svc).List(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
}

// The repository returns a nil slice for an empty table; without the guard the
// client would see `data: null` instead of `data: []`.
func TestList_NormalisesNilToAnEmptySlice(t *testing.T) {
	svc := &fakeService{emptyResult: true}
	c, w := listCtx(t, "?page=1", svc)
	NewHandler(svc).List(c)
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("expected data:[] for an empty table, got: %s", w.Body.String())
	}
}

// The module is namespaced in the router: policyH owns /api/v1/policies, so
// this handler registers under /governance. Asserting the real prefix keeps a
// future prefix change from going unnoticed.
func TestRegisterRoutes_MountsEveryDocumentedRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	NewHandler(&fakeService{}).RegisterRoutes(engine.Group("/api/v1/governance"))
	want := map[string]bool{
		http.MethodPost + " /api/v1/governance/policies":       false,
		http.MethodGet + " /api/v1/governance/policies":        false,
		http.MethodGet + " /api/v1/governance/policies/:id":    false,
		http.MethodDelete + " /api/v1/governance/policies/:id": false,
		http.MethodGet + " /api/v1/governance/policies/count":  false,
	}
	for _, rt := range engine.Routes() {
		want[rt.Method+" "+rt.Path] = true
	}
	for r, seen := range want {
		if !seen {
			t.Errorf("route %s not registered", r)
		}
	}
	if len(engine.Routes()) != len(want) {
		t.Errorf("route count = %d, want %d", len(engine.Routes()), len(want))
	}
}
