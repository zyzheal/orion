package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/api-market/models"
)

// recordingAMSvc promotes every method of fakeHandlerService and records the
// app id GetApp and ListSubscriptions received. Before the route spelled ":id"
// both saw "" on every request, so the endpoint 404'd for every caller.
type recordingAMSvc struct {
	*fakeHandlerService
	gotAppID    string
	gotSubAppID string
}

func (r *recordingAMSvc) GetApp(ctx context.Context, id string, tenantID string) (*models.DeveloperApp, error) {
	r.gotAppID = id
	return &models.DeveloperApp{}, nil
}

func (r *recordingAMSvc) ListSubscriptions(ctx context.Context, appID string, tenantID string) ([]models.Subscription, error) {
	r.gotSubAppID = appID
	return []models.Subscription{}, nil
}

func TestAPIMarket_SubscriptionsRouteParamReachesBothServiceCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := &recordingAMSvc{}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Set("user_id", "user-1")
		c.Next()
	})
	NewHandler(rec).RegisterRoutes(r.Group("/api/v1"))

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/market/subscriptions/app-9", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET /market/subscriptions/app-9 -> %d (%s), want 200", w.Code, w.Body.String())
	}
	if rec.gotAppID != "app-9" {
		t.Fatalf("GetApp received id=%q, want %q: the route must spell the param :id so c.Param(\"id\") resolves", rec.gotAppID, "app-9")
	}
	if rec.gotSubAppID != "app-9" {
		t.Fatalf("ListSubscriptions received appID=%q, want %q", rec.gotSubAppID, "app-9")
	}
}
