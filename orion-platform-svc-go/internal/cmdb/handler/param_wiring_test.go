package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/cmdb/models"
)

// recordingCmdbSvc promotes every method of fakeHandlerService and records the
// ci id that GetByCIByID saw. handler_test.go cannot catch a param-name
// mismatch: it drives the handler with c.Params it sets by hand, which bypasses
// the route template entirely.
type recordingCmdbSvc struct {
	*fakeHandlerService
	gotCIID   string
	gotTenant *string
}

func (r *recordingCmdbSvc) GetByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error) {
	r.gotCIID, r.gotTenant = ciID, tenantID
	return &models.CI{}, nil
}

func TestCMDB_ByIDRouteParamReachesTheHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := &recordingCmdbSvc{}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	NewHandler(rec).RegisterRoutes(r.Group("/api/v1"))

	// GetCIByID takes the tenant from ?tenantId rather than c.GetString("tenant_id"):
	// /api/v1 mounts auth.OptionalAuth, so an unauthenticated caller has no tenant
	// in the context at all and the query is the only source. That scoping choice is
	// separate from the param name and is left as it stands; ?tenantId below
	// documents the contract the route actually has.
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/cmdb/cis/by-id/ci-42?tenantId=tenant-1", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET /cmdb/cis/by-id/ci-42 -> %d (%s), want 200", w.Code, w.Body.String())
	}
	if rec.gotCIID != "ci-42" {
		t.Fatalf("GetByCIByID received ciID=%q, want %q: the route must spell the param :ciID so c.Param(\"ciID\") resolves", rec.gotCIID, "ci-42")
	}
	if rec.gotTenant == nil || *rec.gotTenant != "tenant-1" {
		t.Fatalf("tenant=%v, want tenant-1 from ?tenantId", rec.gotTenant)
	}
}
