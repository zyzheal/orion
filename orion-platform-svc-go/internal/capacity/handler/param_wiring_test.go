package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// recordingCapSvc promotes every method of fakeHandlerService and records the
// id ScaleResource received. The service forwards it straight to
// updateRecordStatus, so an empty id would have been a silent no-op scale.
type recordingCapSvc struct {
	*fakeHandlerService
	gotID string
}

func (r *recordingCapSvc) ScaleResource(ctx context.Context, tenantID string, id string) (gin.H, error) {
	r.gotID = id
	return gin.H{"id": id, "status": "scaled"}, nil
}

func newCapRouter(rec *recordingCapSvc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// The scale registration carries auth.RequirePermission("capacity","write").
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	NewHandler(rec).RegisterRoutes(r.Group("/api/v1"))
	return r
}

func TestCAPACITY_ScaleRouteCarriesTheTargetID(t *testing.T) {
	rec := &recordingCapSvc{}
	r := newCapRouter(rec)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/capacity/scale/inst-7", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("POST /capacity/scale/inst-7 -> %d (%s), want 200", w.Code, w.Body.String())
	}
	if rec.gotID != "inst-7" {
		t.Fatalf("ScaleResource received id=%q, want %q: the route must be /scale/:id so c.Param(\"id\") resolves", rec.gotID, "inst-7")
	}

	// A scale with no target must be rejected rather than resolving to an empty
	// id, which would silently scale nothing and still report success.
	rec = &recordingCapSvc{}
	r = newCapRouter(rec)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/capacity/scale", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("POST /capacity/scale -> %d (%s), want 404", w.Code, w.Body.String())
	}
	if rec.gotID != "" {
		t.Fatalf("ScaleResource was reached with id=%q from a route with no target", rec.gotID)
	}
}
