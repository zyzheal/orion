package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/skill/models"

	"github.com/gin-gonic/gin"
)

// These three handlers used to read `page` and `limit` with bare strconv.Atoi
// and pass them into a service whose interface already advertised both names.
// The service silently dropped them and the repository had no LIMIT / OFFSET at
// all, so every value that was not the default returned the whole table. A
// reader of either the handler or the interface concluded pagination was wired.
//
// The pagination package is the only floor on the path now: a negative page
// used to reach Postgres as a negative OFFSET, which is an error instead of a
// page, and turned a GET into a 500.
//
// The cases below deliberately avoid limit=20: if the handler silently dropped
// its query string, the recorded limit would fall back to 20 and the case would
// only fail when 20 was not the expected value. `limit=25`, `limit=30`,
// `limit=40` and `limit=-5` are the markers that make an input-dropping
// handler visible.

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
		{"negativePageIsClamped", "page=-40&limit=25", 0, 25},
		{"zeroPageIsClamped", "page=0&limit=30", 0, 30},
		{"negativeLimitIsClamped", "page=2&limit=-5", 20, 20},
		{"zeroLimitFallsBack", "page=3&limit=0", 40, 20},
		{"unparsableUsesDefaults", "page=abc&limit=", 0, 20},
		{"absentUsesDefaults", "", 0, 20},
		{"validPageReachesTheRepository", "page=3&limit=25", 50, 25},
		{"pageOneIsOffsetZero", "page=1&limit=40", 0, 40},
		{"largePageIsPreserved", "page=40&limit=20", 780, 20},
	}
}

// listCtx seeds the one route param all three handlers read. The query is joined
// with '?' rather than concatenated: concatenation folds the query string into
// the path, c.Query returns empty for every case, the handlers fall back to
// their defaults, and seven of the nine cases pass for the wrong reason.
func listCtx(path, query string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{{Key: "skillId", Value: "skill-1"}}
	url := path
	if query != "" {
		url = path + "?" + query
	}
	c.Request = httptest.NewRequest(http.MethodGet, url, nil)
	return c, w
}

// newPaginationHandler wires the mock the test will read, so the recorded pair
// is the pair the handler actually computed.
func newPaginationHandler() (*Handler, *mockRepo) {
	mock := seedRepo(7)
	return newHandlerWith(mock), mock
}

// runPaginationCase pins one case against one handler and reports what the mock
// actually received, so the recorded pair cannot drift from the computed pair.
func runPaginationCase(t *testing.T, name, path string, h func(*gin.Context), query string, wantOff, wantLimit int, mock *mockRepo) {
	t.Helper()
	t.Run(name, func(t *testing.T) {
		c, w := listCtx(path, query)
		h(c)
		if w.Code != http.StatusOK {
			t.Fatalf("%s %s: status %d", path, query, w.Code)
		}
		if mock.lastOffset != wantOff || mock.lastLimit != wantLimit {
			t.Errorf("%s %s: repository got offset=%d limit=%d, want offset=%d limit=%d",
				path, query, mock.lastOffset, mock.lastLimit, wantOff, wantLimit)
		}
	})
}

// seedRepo fills one tenant with n skills, executions and audit logs so that a
// paginated fetch is visibly shorter than the tenant total.
func seedRepo(n int) *mockRepo {
	m := newMockRepo()
	now := time.Now()
	for i := 0; i < n; i++ {
		id := "skill-" + string(rune('a'+i))
		m.skills[id] = &models.Skill{ID: id, TenantID: "tenant-1", Name: id, CreatedAt: now}
		m.executions = append(m.executions, models.SkillExecution{ID: "exec-" + id, SkillID: id, TenantID: "tenant-1", Status: "completed"})
		m.auditLogs = append(m.auditLogs, models.SkillAuditLog{ID: i + 1, SkillID: id, TenantID: "tenant-1", Action: "create"})
	}
	return m
}

func TestListSkills_PaginationReachesTheRepository(t *testing.T) {
	h, mock := newPaginationHandler()
	for _, tc := range paginationCases() {
		runPaginationCase(t, tc.name, "/skill", h.ListSkills, tc.query, tc.wantOff, tc.wantLimit, mock)
	}
}

func TestListExecutions_PaginationReachesTheRepository(t *testing.T) {
	h, mock := newPaginationHandler()
	for _, tc := range paginationCases() {
		runPaginationCase(t, tc.name, "/skill/skill-1/executions", h.ListExecutions, tc.query, tc.wantOff, tc.wantLimit, mock)
	}
}

func TestGetAuditLogs_PaginationReachesTheRepository(t *testing.T) {
	h, mock := newPaginationHandler()
	for _, tc := range paginationCases() {
		runPaginationCase(t, tc.name, "/skill/skill-1/audit-logs", h.GetAuditLogs, tc.query, tc.wantOff, tc.wantLimit, mock)
	}
}

// The envelope carries `total`, so it must be the tenant total behind the same
// predicate, not the length of the page that was just fetched. Before the
// repository honoured LIMIT, `len(items)` was the whole table and looked right;
// after it honours LIMIT, `len(items)` is a page length and lies.
func TestListSkills_EnvelopeTotalIsTheTenantTotal(t *testing.T) {
	h, mock := newPaginationHandler()
	c, w := listCtx("/skill", "page=2&limit=3")

	h.ListSkills(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}

	var body struct {
		Data struct {
			Skills []models.Skill `json:"skills"`
			Total  int64          `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, w.Body.String())
	}
	if len(body.Data.Skills) != 3 {
		t.Errorf("page length = %d, want 3", len(body.Data.Skills))
	}
	if body.Data.Total != 7 {
		t.Errorf("total = %d, want 7 (page length would be %d)", body.Data.Total, len(body.Data.Skills))
	}
	if mock.lastCount != 7 {
		t.Errorf("CountSkills returned %d, want 7", mock.lastCount)
	}
}
