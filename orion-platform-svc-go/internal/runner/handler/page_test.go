package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/runner/models"
)

// fakeService records the offset and limit each list handler passes down, so
// tests can assert the integers derived from page and page_size are the ones the
// handler believes it sent. runner's service passes them through untouched and
// its repository binds them straight into OFFSET / LIMIT, so these assertions are
// the only guard on the path: before the clamp, `page=-1` reached Postgres as
// OFFSET -20, which is an error instead of data and turned a GET into a 500.
type fakeService struct {
	lastTenant string
	lastStatus string
	lastAgent  string
	lastOffset int
	lastLimit  int
}

var _ Service = (*fakeService)(nil)

func (f *fakeService) AgentHealth(context.Context) (string, error) { return "ok", nil }
func (f *fakeService) RegisterAgent(_ context.Context, tenantID string, _ *models.CreateAgentRequest) (*models.RunnerAgent, error) {
	f.lastTenant = tenantID
	return &models.RunnerAgent{AgentID: "agent-1", TenantID: tenantID}, nil
}
func (f *fakeService) GetAgent(_ context.Context, tenantID, agentID string) (*models.AgentInfo, error) {
	f.lastTenant = tenantID
	return &models.AgentInfo{AgentID: agentID}, nil
}
func (f *fakeService) ListAgents(_ context.Context, tenantID string, offset, limit int) ([]models.RunnerAgent, error) {
	f.lastTenant = tenantID
	f.lastOffset, f.lastLimit = offset, limit
	return []models.RunnerAgent{}, nil
}
func (f *fakeService) UpdateAgent(_ context.Context, tenantID, agentID string, _ *models.UpdateAgentRequest) (*models.RunnerAgent, error) {
	f.lastTenant = tenantID
	return &models.RunnerAgent{AgentID: agentID, TenantID: tenantID}, nil
}
func (f *fakeService) DeleteAgent(_ context.Context, tenantID, _ string) error {
	f.lastTenant = tenantID
	return nil
}
func (f *fakeService) AgentHeartbeat(_ context.Context, tenantID, _ string, _ *models.HeartbeatRequest) error {
	f.lastTenant = tenantID
	return nil
}
func (f *fakeService) CountAgents(_ context.Context, tenantID string) (int, error) {
	f.lastTenant = tenantID
	return 7, nil
}
func (f *fakeService) CreateJob(_ context.Context, tenantID string, _ *models.CreateJobRequest) (*models.RunnerJob, error) {
	f.lastTenant = tenantID
	return &models.RunnerJob{JobID: "job-1", TenantID: tenantID}, nil
}
func (f *fakeService) GetJob(_ context.Context, tenantID, jobID string) (*models.RunnerJob, error) {
	f.lastTenant = tenantID
	return &models.RunnerJob{JobID: jobID, TenantID: tenantID}, nil
}
func (f *fakeService) ListJobs(_ context.Context, tenantID, status string, offset, limit int) ([]models.RunnerJob, error) {
	f.lastTenant, f.lastStatus = tenantID, status
	f.lastOffset, f.lastLimit = offset, limit
	return []models.RunnerJob{}, nil
}
func (f *fakeService) ListJobsByAgent(_ context.Context, tenantID, agentID string, offset, limit int) ([]models.RunnerJob, error) {
	f.lastTenant, f.lastAgent = tenantID, agentID
	f.lastOffset, f.lastLimit = offset, limit
	return []models.RunnerJob{}, nil
}
func (f *fakeService) TransitionJob(_ context.Context, tenantID, jobID string, _ *models.UpdateJobStatusRequest) (*models.RunnerJob, error) {
	f.lastTenant = tenantID
	return &models.RunnerJob{JobID: jobID, TenantID: tenantID}, nil
}
func (f *fakeService) DeleteJob(_ context.Context, tenantID, _ string) error {
	f.lastTenant = tenantID
	return nil
}
func (f *fakeService) ReportJobResult(context.Context, string) (*models.JobResult, error) {
	return &models.JobResult{JobID: "job-1"}, nil
}
func (f *fakeService) CountJobs(_ context.Context, tenantID string) (int, error) {
	f.lastTenant = tenantID
	return 7, nil
}

// listCtx builds a GET request for the given path and query string, with a
// tenant and an agentId path param, which covers all three list handlers.
func listCtx(path, query string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{{Key: "agentId", Value: "agent-1"}}
	c.Request = httptest.NewRequest(http.MethodGet, path+query, strings.NewReader(""))
	return c, w
}

// paginationCases pins the offset and limit derived from page and page_size.
// Page numbering is 1-based, so page 1 is offset 0.
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
		{"negativePageIsClamped", "?page=-40&page_size=20", 0, 20},
		{"zeroPageIsClamped", "?page=0&page_size=25", 0, 25},
		{"negativePageSizeIsClamped", "?page=2&page_size=-5", 20, 20},
		{"zeroPageSizeFallsBack", "?page=2&page_size=0", 20, 20},
		{"unparsableUsesDefaults", "?page=abc&page_size=", 0, 20},
		{"absentUsesDefaults", "", 0, 20},
		{"validPageReachesTheService", "?page=3&page_size=25", 50, 25},
		{"pageOneIsOffsetZero", "?page=1&page_size=20", 0, 20},
		{"largePageIsPreserved", "?page=40&page_size=20", 780, 20},
	}
}

func checkPagination(t *testing.T, path string, f *fakeService, query string, wantOff, wantLimit int,
	call func(*gin.Context)) {
	t.Helper()
	c, w := listCtx(path, query)
	call(c)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200 (body: %s)", w.Code, w.Body.String())
	}
	if f.lastOffset != wantOff || f.lastLimit != wantLimit {
		t.Fatalf("query %q: got offset=%d limit=%d, want offset=%d limit=%d",
			query, f.lastOffset, f.lastLimit, wantOff, wantLimit)
	}
}

func TestListAgents_PaginationReachesTheService(t *testing.T) {
	for _, tc := range paginationCases() {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{}
			h := NewHandler(f)
			checkPagination(t, "/agents", f, tc.query, tc.wantOff, tc.wantLimit, h.ListAgents)
			if f.lastTenant != "tenant-1" {
				t.Fatalf("tenant not forwarded, got %q", f.lastTenant)
			}
		})
	}
}

func TestListJobs_PaginationReachesTheService(t *testing.T) {
	for _, tc := range paginationCases() {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{}
			h := NewHandler(f)
			checkPagination(t, "/jobs", f, tc.query, tc.wantOff, tc.wantLimit, h.ListJobs)
			if f.lastTenant != "tenant-1" {
				t.Fatalf("tenant not forwarded, got %q", f.lastTenant)
			}
		})
	}
	t.Run("statusIsForwarded", func(t *testing.T) {
		f := &fakeService{}
		h := NewHandler(f)
		checkPagination(t, "/jobs", f, "?page=2&page_size=10&status=running", 10, 10, h.ListJobs)
		if f.lastStatus != "running" {
			t.Fatalf("status = %q, want running", f.lastStatus)
		}
	})
}

func TestListJobsByAgent_PaginationReachesTheService(t *testing.T) {
	for _, tc := range paginationCases() {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{}
			h := NewHandler(f)
			checkPagination(t, "/jobs/agent/agent-1", f, tc.query, tc.wantOff, tc.wantLimit, h.ListJobsByAgent)
			if f.lastTenant != "tenant-1" {
				t.Fatalf("tenant not forwarded, got %q", f.lastTenant)
			}
			if f.lastAgent != "agent-1" {
				t.Fatalf("agentId not forwarded, got %q", f.lastAgent)
			}
		})
	}
}

// TestListAgents_EnvelopeMatchesTheQuery pins the response envelope against the
// same integers the handler sent to the service. runner derives the offset twice
// (once for the query, once for the envelope), so the two could have drifted
// apart; the envelope also carries the real tenant count, not len(items).
func TestListAgents_EnvelopeMatchesTheQuery(t *testing.T) {
	for _, tc := range []struct {
		name      string
		query     string
		wantOff   int
		wantLimit int
	}{
		{"validPage", "?page=3&page_size=25", 50, 25},
		{"negativePageIsClamped", "?page=-40&page_size=20", 0, 20},
		{"absentParams", "", 0, 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{}
			h := NewHandler(f)
			c, w := listCtx("/agents", tc.query)
			h.ListAgents(c)
			var body map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("response is not JSON: %v (body: %s)", err, w.Body.String())
			}
			inner, ok := body["data"].(map[string]interface{})
			if !ok {
				t.Fatalf("missing data envelope: %v", body)
			}
			if got, _ := inner["offset"].(float64); got != float64(tc.wantOff) {
				t.Fatalf("offset = %v, want %d", inner["offset"], tc.wantOff)
			}
			if got, _ := inner["limit"].(float64); got != float64(tc.wantLimit) {
				t.Fatalf("limit = %v, want %d", inner["limit"], tc.wantLimit)
			}
			if got, _ := inner["total"].(float64); got != float64(7) {
				t.Fatalf("total = %v, want 7 (the tenant count from CountAgents)", inner["total"])
			}
			if f.lastOffset != tc.wantOff {
				t.Fatalf("envelope says offset %v but the service received %d", tc.wantOff, f.lastOffset)
			}
		})
	}
}
