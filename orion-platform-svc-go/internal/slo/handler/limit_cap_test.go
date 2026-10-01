package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/slo/models"
)

type limitCaptureSloSvc struct {
	sloLimit int
	ebLimit  int
}

func (f *limitCaptureSloSvc) CreateSLO(ctx context.Context, slo *models.SLODefinition) error {
	return nil
}
func (f *limitCaptureSloSvc) DeleteSLO(ctx context.Context, tenantID, id string) error { return nil }
func (f *limitCaptureSloSvc) GetDashboard(ctx context.Context, tenantID string) ([]models.SLODefinition, error) {
	return nil, nil
}
func (f *limitCaptureSloSvc) GetErrorBudgetHistory(ctx context.Context, sloID, tenantID string, limit int) ([]models.ErrorBudget, error) {
	f.ebLimit = limit
	return nil, nil
}
func (f *limitCaptureSloSvc) GetLatestErrorBudget(ctx context.Context, sloID, tenantID string) (*models.ErrorBudget, error) {
	return nil, nil
}
func (f *limitCaptureSloSvc) GetSLIHistory(ctx context.Context, sloID, tenantID string, limit int) ([]models.SLIMeasurement, error) {
	f.sloLimit = limit
	return nil, nil
}
func (f *limitCaptureSloSvc) GetSLO(ctx context.Context, tenantID, id string) (*models.SLODefinition, error) {
	return nil, nil
}
func (f *limitCaptureSloSvc) ListSLOs(ctx context.Context, tenantID string, sloType string, enabled *bool) ([]models.SLODefinition, error) {
	return nil, nil
}
func (f *limitCaptureSloSvc) RecordSLI(ctx context.Context, m *models.SLIMeasurement) error {
	return nil
}
func (f *limitCaptureSloSvc) UpdateSLO(ctx context.Context, tenantID, id string, updates map[string]any) (*models.SLODefinition, error) {
	return nil, nil
}

func TestGetSLIHistory_CapsLimitAtOneHundred(t *testing.T) {
	for _, tc := range []struct {
		name  string
		query string
		want  int
	}{
		{"capped", "limit=1000", 100},
		{"insideTheCap", "limit=5", 5},
		{"defaults", "", 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &limitCaptureSloSvc{}
			h := NewHandler(f)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("tenant_id", "tenant-1")
			c.Params = gin.Params{{Key: "id", Value: "slo-1"}}
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.GetSLIHistory(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
			}
			if f.sloLimit != tc.want {
				t.Errorf("limit=%q bound %d, want %d", tc.query, f.sloLimit, tc.want)
			}
		})
	}
}

func TestGetErrorBudgetHistory_CapsLimitAtOneHundred(t *testing.T) {
	for _, tc := range []struct {
		name  string
		query string
		want  int
	}{
		{"capped", "limit=1000", 100},
		{"insideTheCap", "limit=5", 5},
		{"defaults", "", 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &limitCaptureSloSvc{}
			h := NewHandler(f)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("tenant_id", "tenant-1")
			c.Params = gin.Params{{Key: "id", Value: "slo-1"}}
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.GetErrorBudgetHistory(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
			}
			if f.ebLimit != tc.want {
				t.Errorf("limit=%q bound %d, want %d", tc.query, f.ebLimit, tc.want)
			}
		})
	}
}
