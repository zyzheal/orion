package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/metadata/models"
)

// recordingMetaSvc promotes every method of fakeHandlerService and records the
// key each per-record method received. The status-code checks in
// handler_test.go cannot see this, because they call the handlers with empty
// c.Params; only a request that travels the real route template proves the
// handler reads the param the route actually provides.
type recordingMetaSvc struct {
	*fakeHandlerService
	got []string
}

func (r *recordingMetaSvc) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	r.got = append(r.got, "Get="+id)
	return &models.Record{}, nil
}

func (r *recordingMetaSvc) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	r.got = append(r.got, "Update="+id)
	return &models.Record{}, nil
}

func (r *recordingMetaSvc) Delete(ctx context.Context, tenantID, id string) error {
	r.got = append(r.got, "Delete="+id)
	return nil
}

func newParamRouter(rec *recordingMetaSvc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// The three per-record registrations carry auth.RequirePermission, so the
	// router must look authenticated; "admin" holds *:* and passes every
	// resource/action pair.
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	NewHandler(rec).RegisterRoutes(r.Group("/api/v1"))
	return r
}

func TestMETADATA_RouteKeyReachesEveryPerRecordHandler(t *testing.T) {
	cases := []struct {
		method string
		path   string
		body   string
		want   string
	}{
		{http.MethodGet, "/api/v1/metadata/m-1", "", "Get=m-1"},
		{http.MethodPut, "/api/v1/metadata/m-2", `{"name":"n"}`, "Update=m-2"},
		{http.MethodDelete, "/api/v1/metadata/m-3", "", "Delete=m-3"},
	}
	for _, tc := range cases {
		t.Run(tc.want, func(t *testing.T) {
			rec := &recordingMetaSvc{}
			r := newParamRouter(rec)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
			if w.Code != http.StatusOK {
				t.Fatalf("%s %s -> %d (%s), want 200", tc.method, tc.path, w.Code, w.Body.String())
			}
			if len(rec.got) != 1 {
				t.Fatalf("service called %d times, want exactly 1: %v", len(rec.got), rec.got)
			}
			if rec.got[0] != tc.want {
				t.Fatalf("handler received %q, want %q: the route supplies :key, so the handler must read c.Param(\"key\")", rec.got[0], tc.want)
			}
		})
	}
}
