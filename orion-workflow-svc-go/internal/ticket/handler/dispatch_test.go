package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/workflow-svc-go/internal/ticket/models"
	"orion/workflow-svc-go/internal/ticket/service"
	"orion/workflow-svc-go/internal/ticket/testutil"
)

func setupDispatchRouter(svc *service.DispatchService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewDispatchHandler(svc)

	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Next()
	})

	r.POST("/dispatch/engineers", h.RegisterEngineer)
	r.GET("/dispatch/engineers", h.ListEngineers)
	r.GET("/dispatch/engineers/:id", h.GetEngineer)
	r.POST("/tickets/:id/dispatch/manual", h.ManualDispatch)
	r.GET("/dispatch/queue/status", h.GetDispatchQueueStatus)
	r.POST("/dispatch/rules", h.AddDispatchRule)
	r.GET("/dispatch/rules", h.GetDispatchRules)
	r.DELETE("/dispatch/rules/:ruleId", h.RemoveDispatchRule)
	r.GET("/dispatch/load-balance", h.GetLoadBalanceReport)
	r.PUT("/dispatch/weights", h.UpdateDispatchWeights)
	r.GET("/dispatch/weights", h.GetDispatchWeights)
	r.GET("/dispatch/metrics", h.GetDispatchMetrics)
	r.GET("/dispatch/performance", h.GetAllEngineerPerformances)

	return r
}

func newTestDispatchHandler() (*gin.Engine, *testutil.MockDispatchRepository) {
	ticketRepo := testutil.NewMockTicketRepository()
	dispatchRepo := testutil.NewMockDispatchRepository()
	slaRepo := testutil.NewMockSLARepository()

	svc := service.NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	r := setupDispatchRouter(svc)
	return r, dispatchRepo
}

func TestHandler_RegisterEngineer(t *testing.T) {
	r, _ := newTestDispatchHandler()

	body, _ := json.Marshal(map[string]any{
		"id":         "eng-1",
		"name":       "Alice",
		"expertise":  []string{"backend"},
		"max_capacity": 10,
	})
	req := httptest.NewRequest(http.MethodPost, "/dispatch/engineers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_ListEngineers(t *testing.T) {
	r, repo := newTestDispatchHandler()
	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice"},
		{ID: "eng-2", Name: "Bob"},
	}

	req := httptest.NewRequest(http.MethodGet, "/dispatch/engineers", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetEngineer(t *testing.T) {
	r, repo := newTestDispatchHandler()
	repo.Engineers = []models.EngineerProfile{{ID: "eng-1", Name: "Alice"}}

	req := httptest.NewRequest(http.MethodGet, "/dispatch/engineers/eng-1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetEngineer_NotFound(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/engineers/nonexistent", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandler_ManualDispatch(t *testing.T) {
	_, repo := newTestDispatchHandler()
	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice", MaxCapacity: 10, Availability: "available"},
	}

	// Need to also set up the ticket
	ticketRepo := testutil.NewMockTicketRepository()
	ticketRepo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}

	// Re-create with proper repos
	slaRepo := testutil.NewMockSLARepository()
	svc := service.NewDispatchService(repo, ticketRepo, slaRepo)
	r2 := setupDispatchRouter(svc)

	body, _ := json.Marshal(map[string]string{
		"engineer_id": "eng-1",
		"reason":      "manual",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/dispatch/manual", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r2.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_GetDispatchQueueStatus(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/queue/status", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_AddDispatchRule(t *testing.T) {
	r, _ := newTestDispatchHandler()

	body, _ := json.Marshal(map[string]any{
		"name":       "Backend Rule",
		"condition":  "type == 'backend'",
		"engineer_id": "eng-1",
		"priority":   10,
	})
	req := httptest.NewRequest(http.MethodPost, "/dispatch/rules", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_GetDispatchRules(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/rules", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_RemoveDispatchRule(t *testing.T) {
	r, repo := newTestDispatchHandler()
	repo.Rules = []models.DispatchRule{{ID: "rule-1", Name: "Test"}}

	req := httptest.NewRequest(http.MethodDelete, "/dispatch/rules/rule-1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetLoadBalanceReport(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/load-balance", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_UpdateDispatchWeights(t *testing.T) {
	r, _ := newTestDispatchHandler()

	body, _ := json.Marshal(map[string]float64{
		"expertise":    0.4,
		"workload":     0.2,
		"availability": 0.2,
		"success_rate": 0.1,
		"sla_urgency":  0.1,
	})
	req := httptest.NewRequest(http.MethodPut, "/dispatch/weights", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_GetDispatchWeights(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/weights", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetDispatchMetrics(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/metrics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetAllEngineerPerformances(t *testing.T) {
	r, _ := newTestDispatchHandler()

	req := httptest.NewRequest(http.MethodGet, "/dispatch/performance", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
