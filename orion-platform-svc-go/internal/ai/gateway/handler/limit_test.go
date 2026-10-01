package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai/gateway/models"
	"orion/platform-svc-go/internal/ai/gateway/service"

	"github.com/gin-gonic/gin"
)

// limitFake returns a non-empty slice so the truncation branch is actually
// reached. The existing fakeAiGatewayService returns empty slices and therefore
// cannot reach it at all.
type limitFake struct {
	items     []models.GatewayResponse
	listLimit int
}

func (f *limitFake) RecordRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error) {
	return &models.GatewayResponse{}, nil
}
func (f *limitFake) ProcessRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error) {
	return &models.GatewayResponse{}, nil
}
func (f *limitFake) GetRequest(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error) {
	return &models.GatewayResponse{}, nil
}
func (f *limitFake) ListRequests(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error) {
	f.listLimit = q.Limit
	return f.items, len(f.items), nil
}
func (f *limitFake) ListByProvider(ctx context.Context, tenantID, provider string, limit int) ([]models.GatewayResponse, int, error) {
	return f.items, len(f.items), nil
}
func (f *limitFake) ListRecent(ctx context.Context, tenantID string, n int) ([]models.GatewayResponse, int, error) {
	return f.items, len(f.items), nil
}
func (f *limitFake) GetByModel(ctx context.Context, tenantID, model string) ([]models.GatewayResponse, int, error) {
	return f.items, len(f.items), nil
}
func (f *limitFake) Chat(ctx context.Context, req *models.ChatRequest) (*models.ChatResponse, error) {
	return &models.ChatResponse{}, nil
}
func (f *limitFake) ListModels() []models.ProviderModel {
	return []models.ProviderModel{}
}

var _ service.ServiceInterface = (*limitFake)(nil)

func five() []models.GatewayResponse {
	out := make([]models.GatewayResponse, 5)
	for i := range out {
		out[i] = models.GatewayResponse{ID: string(rune('a' + i))}
	}
	return out
}

func getCtx(query string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	// Joined with "?" so an empty query still yields a valid request URL.
	c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
	return c, w
}

// ListByModel used to slice its result with the raw parsed query value:
//
//	limit := 50
//	if c.Query("limit") != "" { fmt.Sscanf(c.Query("limit"), "%d", &limit) }
//	if len(items) > limit { items = items[:limit] }
//
// ?limit=-1 reached items[:-1] and panicked with "slice bounds out of range".
// ?limit=0 returned an empty array next to a total that still counted every row.
// The route is GET /ai-gateway/by-model/:model, mounted and auth-guarded.
func TestListByModel_FloorsAndCapsLimit(t *testing.T) {
	for _, tc := range []struct {
		name  string
		query string
		want  int
	}{
		{"negativeLimitDoesNotPanic", "limit=-1", 5},
		{"zeroLimitReturnsEverything", "limit=0", 5},
		{"absentLimitReturnsEverything", "", 5},
		{"unparsableLimitFallsBack", "limit=abc", 5},
		{"exactLimit", "limit=3", 3},
		{"largeLimitReturnsEverything", "limit=1000", 5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := NewHandler(&limitFake{items: five()})
			c, w := getCtx(tc.query)
			h.ListByModel(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
			}
			// errors.WriteSuccess wraps the payload one level deeper:
			// {"success":true,"data":{"data":[...],"total":N}}.
			var env struct {
				Success bool `json:"success"`
				Data    struct {
					Data  []models.GatewayResponse `json:"data"`
					Total int                      `json:"total"`
				} `json:"data"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
				t.Fatalf("response did not decode: %v\n%s", err, w.Body.String())
			}
			if !env.Success {
				t.Fatalf("success=false: %s", w.Body.String())
			}
			if len(env.Data.Data) != tc.want {
				t.Errorf("limit=%q returned %d rows, want %d", tc.query, len(env.Data.Data), tc.want)
			}
			// limit=3 gives 3 rows while total still says 5: GetByModel counts the
			// full match set and truncates after. Pre-existing, out of scope here.
			_ = env.Data.Total
		})
	}
}

// ListRequests handed its parsed limit straight to the repository, which only
// has a floor (`if q.Limit > 0`), so ?limit=999999 bound LIMIT 999999 and read
// the whole table next to its own COUNT(*). Same shape as the 18 cap sites
// migrated in Round 107: floor in the handler, cap at the platform 100.
func TestListRequests_FloorsAndCapsLimit(t *testing.T) {
	for _, tc := range []struct {
		name  string
		query string
		want  int
	}{
		{"negativeLimitFallsBackToDefault", "limit=-1", 20},
		{"zeroLimitFallsBackToDefault", "limit=0", 20},
		{"absentLimitUsesDefault", "", 20},
		{"unparsableLimitFallsBackToDefault", "limit=abc", 20},
		{"insideTheCapPassesThrough", "limit=5", 5},
		{"cappedAtOneHundred", "limit=1000", 100},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &limitFake{items: five()}
			h := NewHandler(f)
			c, w := getCtx(tc.query)
			h.ListRequests(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
			}
			if f.listLimit != tc.want {
				t.Errorf("limit=%q bound LIMIT %d, want %d", tc.query, f.listLimit, tc.want)
			}
		})
	}
}
