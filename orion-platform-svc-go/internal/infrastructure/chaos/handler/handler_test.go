package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/chaos/models"
	"orion/platform-svc-go/internal/infrastructure/chaos/service"

	"github.com/gin-gonic/gin"
)

// ListExperiments used to read `page` and `page_size` with bare strconv.Atoi and
// hand them to a service that derived the offset before clamping its inputs. Two
// defects sat in that ordering at once:
//
//   - `?page=0`, `?page=-5` and even `?page=abc` reached Postgres as a negative
//     OFFSET, which is an error instead of a page, so a GET returned 500.
//   - the page_size cap applied after the derivation, so `page=3&page_size=1000`
//     returned rows 2001-2100 while every reader of the URL expected rows
//     201-300.
//
// Both now live in the handler, with the cap applied before the offset is
// derived; the service forwards offset and limit untouched.
//
// The cases below deliberately avoid page_size=20: if the handler silently
// dropped its query string, the recorded limit would fall back to 20 and a case
// whose expectation was already 20 would pass for the wrong reason. `25`, `30`,
// `40`, `-5` and `250` are the markers that make an input-dropping handler
// visible.

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

// fakeService records the pagination pair the handler computed, so an assertion
// can never drift from what the service actually received.
type fakeService struct {
	experiments []models.ChaosExperiment
	lastOffset  int
	lastLimit   int
	listCalls   int
	listErr     error
}

var _ Service = (*fakeService)(nil)

func newFakeService() *fakeService {
	now := time.Now()
	return &fakeService{
		experiments: []models.ChaosExperiment{
			{ID: "chaos-1", TenantID: "tenant-1", Name: "n1", Status: models.ExpDraft, CreatedAt: now, UpdatedAt: now},
			{ID: "chaos-2", TenantID: "tenant-1", Name: "n2", Status: models.ExpActive, CreatedAt: now, UpdatedAt: now},
		},
	}
}

func (f *fakeService) CreateExperiment(ctx context.Context, tenantID string, input *models.CreateExperimentInput) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{ID: "chaos-new", TenantID: tenantID, Name: input.Name, Status: models.ExpDraft}, nil
}

func (f *fakeService) GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	if id == "missing" {
		return nil, errors.New("experiment missing not found")
	}
	return &f.experiments[0], nil
}

func (f *fakeService) ListExperiments(ctx context.Context, tenantID string, offset, limit int) ([]models.ChaosExperiment, error) {
	f.listCalls++
	f.lastOffset = offset
	f.lastLimit = limit
	return f.experiments, f.listErr
}

func (f *fakeService) UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus) error {
	return nil
}

func (f *fakeService) DeleteExperiment(ctx context.Context, tenantID, id string) error {
	return nil
}

// ctx returns the context and its recorder together so a test can never assert on
// a different recorder than the one the handler wrote to.
func ctx(method, path string, params gin.Params, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	if params != nil {
		c.Params = params
	}
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
		c.Request = httptest.NewRequest(method, path, reader)
		c.Request.Header.Set("Content-Type", "application/json")
		return c, w
	}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func listCtx(query string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/experiments"
	// The query is joined with '?' rather than concatenated: concatenation folds
	// the query string into the path, c.Query returns empty for every case, the
	// handler falls back to its defaults, and eight of the ten cases would pass
	// for the wrong reason.
	if query != "" {
		path += "?" + query
	}
	return ctx(http.MethodGet, path, nil, "")
}

func newTestHandler() *Handler { return NewHandler(newFakeService()) }

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

// TestListExperiments_PaginationReachesTheService pins what the handler computes
// for each input shape, against the same fake the handler called.
func TestListExperiments_PaginationReachesTheService(t *testing.T) {
	h := newTestHandler()
	fake := h.svc.(*fakeService)

	for _, tc := range paginationCases() {
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx(tc.query)
			h.ListExperiments(c)
			if w.Code != http.StatusOK {
				t.Fatalf("query %q: status %d, body %s", tc.query, w.Code, w.Body.String())
			}
			if fake.lastOffset != tc.wantOff || fake.lastLimit != tc.wantLimit {
				t.Errorf("query %q: service got offset=%d limit=%d, want offset=%d limit=%d",
					tc.query, fake.lastOffset, fake.lastLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

// No combination of page and page_size may produce a negative offset. A negative
// OFFSET is rejected by Postgres with an error instead of data, which turned
// these GETs into 500s before the floor moved into the handler.
func TestListExperiments_NoInputYieldsANegativeOffset(t *testing.T) {
	h := newTestHandler()
	fake := h.svc.(*fakeService)

	for _, tc := range []struct{ name, query string }{
		{"negativePage", "page=-40&page_size=20"},
		{"negativeOnePage", "page=-1&page_size=20"},
		{"zeroPage", "page=0&page_size=20"},
		{"unparsablePage", "page=abc&page_size=20"},
		{"absentPage", "page_size=20"},
		{"negativePageSizeWithPageTwo", "page=2&page_size=-5"},
		{"zeroPageSizeWithPageThree", "page=3&page_size=0"},
		{"unparsablePageSize", "page=3&page_size=abc"},
		{"bothAdversarial", "page=-9&page_size=-9"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx(tc.query)
			h.ListExperiments(c)
			if w.Code != http.StatusOK {
				t.Fatalf("query %q: status %d, body %s", tc.query, w.Code, w.Body.String())
			}
			if fake.lastOffset < 0 {
				t.Errorf("query %q: offset %d is negative, Postgres would reject it as a 500", tc.query, fake.lastOffset)
			}
			if fake.lastLimit < 1 {
				t.Errorf("query %q: limit %d, want >= 1", tc.query, fake.lastLimit)
			}
		})
	}
}

// The page_size cap must apply before the offset is derived. Deriving first made
// a large page_size move the offset but not the limit, so the endpoint returned a
// different window than the URL asked for, with no error at all.
func TestListExperiments_CapAppliesBeforeDeriving(t *testing.T) {
	h := newTestHandler()
	fake := h.svc.(*fakeService)

	for _, tc := range []struct {
		name      string
		query     string
		wantOff   int
		wantLimit int
	}{
		{"pageThreeSizeTwoFifty", "page=3&page_size=250", 200, 100},
		{"pageFiveSizeTwoHundred", "page=5&page_size=200", 400, 100},
		{"pageTwoSizeOneThousand", "page=2&page_size=1000", 100, 100},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, w := listCtx(tc.query)
			h.ListExperiments(c)
			if w.Code != http.StatusOK {
				t.Fatalf("query %q: status %d", tc.query, w.Code)
			}
			if fake.lastOffset != tc.wantOff || fake.lastLimit != tc.wantLimit {
				t.Errorf("query %q: got offset=%d limit=%d, want offset=%d limit=%d",
					tc.query, fake.lastOffset, fake.lastLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

// A nil result must serialise as an empty array rather than null, so a client that
// iterates the page never hits a type error on an empty table.
func TestListExperiments_NormalisesNilToAnEmptySlice(t *testing.T) {
	h := NewHandler(&fakeService{})
	c, w := listCtx("page=1&page_size=20")
	h.ListExperiments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if strings.Contains(w.Body.String(), `"data":null`) {
		t.Errorf("data serialised as null for a nil result: %s", w.Body.String())
	}
}

func TestListExperiments_RespondsErrorWhenTheServiceFails(t *testing.T) {
	fake := newFakeService()
	fake.listErr = errors.New("boom")
	h := NewHandler(fake)
	c, w := listCtx("page=1&page_size=20")
	h.ListExperiments(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("status %d, want 500 for a service error", w.Code)
	}
}

func TestRegisterRoutes_MountsTheFiveExperimentRoutes(t *testing.T) {
	h := newTestHandler()
	engine := gin.New()
	engine.Use(func(c *gin.Context) { c.Set("tenant_id", "tenant-1"); c.Next() })
	engine.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })
	h.RegisterRoutes(engine.Group("/infra/chaos"))

	seen := map[string]bool{}
	for _, r := range engine.Routes() {
		seen[r.Method+" "+r.Path] = true
	}
	want := []string{
		"POST /infra/chaos/experiments",
		"GET /infra/chaos/experiments",
		"GET /infra/chaos/experiments/:id",
		"POST /infra/chaos/experiments/:id/status",
		"DELETE /infra/chaos/experiments/:id",
	}
	for _, w := range want {
		if !seen[w] {
			t.Errorf("route %q not mounted", w)
		}
	}
	if got := len(seen) - 1; got != len(want) {
		// minus the /health route added above so the engine has at least one route
		t.Errorf("mounted %d routes, want %d", got, len(want))
	}
}

// The interface change touched all five service methods. A smoke pass over each
// handler catches one that panics on a happy-path request, which the compile-time
// assertion cannot see.
func TestOtherHandlers_RespondOnHappyPath(t *testing.T) {
	h := newTestHandler()
	createBody := `{"name":"n1","scope":{"tenant_id":"tenant-1","environment":"prod"},"faults":[{"type":"network_latency","target":"svc","duration_ms":100}]}`

	c, w := ctx(http.MethodPost, "/experiments", nil, createBody)
	h.CreateExperiment(c)
	if w.Code != http.StatusCreated {
		t.Errorf("CreateExperiment: status %d, body %s", w.Code, w.Body.String())
	}

	c, w = ctx(http.MethodGet, "/experiments/chaos-1", gin.Params{{Key: "id", Value: "chaos-1"}}, "")
	h.GetExperiment(c)
	if w.Code != http.StatusOK {
		t.Errorf("GetExperiment: status %d, body %s", w.Code, w.Body.String())
	}

	c, w = ctx(http.MethodGet, "/experiments/missing", gin.Params{{Key: "id", Value: "missing"}}, "")
	h.GetExperiment(c)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("GetExperiment(missing): status %d, want 500 for a non-sentinel error", w.Code)
	}

	c, w = ctx(http.MethodPost, "/experiments/chaos-1/status", gin.Params{{Key: "id", Value: "chaos-1"}}, `{"status":"active"}`)
	h.UpdateStatus(c)
	if w.Code != http.StatusOK {
		t.Errorf("UpdateStatus: status %d, body %s", w.Code, w.Body.String())
	}

	c, w = ctx(http.MethodDelete, "/experiments/chaos-1", gin.Params{{Key: "id", Value: "chaos-1"}}, "")
	h.DeleteExperiment(c)
	if w.Code != http.StatusOK {
		t.Errorf("DeleteExperiment: status %d, body %s", w.Code, w.Body.String())
	}
}

// mapError must keep the two sentinels distinct: ErrExperimentNotFound is a 404,
// ErrInvalidStatus is a 409, everything else is a 500.
func TestMapError_KeepsTheSentinelsDistinct(t *testing.T) {
	cases := []struct {
		err  error
		want int
	}{
		{service.ErrExperimentNotFound, http.StatusNotFound},
		{service.ErrInvalidStatus, http.StatusConflict},
		{errors.New("something else"), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		c, w := ctx(http.MethodGet, "/experiments", nil, "")
		mapError(c, tc.err)
		if w.Code != tc.want {
			t.Errorf("%v: status %d, want %d", tc.err, w.Code, tc.want)
		}
	}
}
