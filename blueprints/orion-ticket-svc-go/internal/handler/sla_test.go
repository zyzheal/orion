package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
	"orion-ticket-svc-go/internal/testutil"
)

func setupSLARouter(svc *service.SLAService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSLAHandler(svc)

	r.POST("/sla/targets", h.AddSLATarget)
	r.GET("/tickets/:id/sla", h.GetTicketSLA)
	r.GET("/sla/compliance", h.GetSLACompliance)
	r.GET("/sla/breaches", h.CheckSLABreaches)

	return r
}

func newTestSLAHandler() *gin.Engine {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := service.NewSLAService(slaRepo, ticketRepo)
	return setupSLARouter(svc)
}

func TestHandler_AddSLATarget(t *testing.T) {
	r := newTestSLAHandler()

	body, _ := json.Marshal(map[string]any{
		"name":                      "High Priority SLA",
		"priority":                  "high",
		"target_response_time_ms":   3600000,
		"target_resolution_time_ms": 86400000,
	})
	req := httptest.NewRequest(http.MethodPost, "/sla/targets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_GetTicketSLA(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	slaRepo.Records = []models.SLARecord{{ID: "r1", TicketID: "t1"}}
	svc := service.NewSLAService(slaRepo, ticketRepo)
	r := setupSLARouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/tickets/t1/sla", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTicketSLA_NotFound(t *testing.T) {
	r := newTestSLAHandler()

	req := httptest.NewRequest(http.MethodGet, "/tickets/nonexistent/sla", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandler_GetSLACompliance(t *testing.T) {
	r := newTestSLAHandler()

	req := httptest.NewRequest(http.MethodGet, "/sla/compliance", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CheckSLABreaches(t *testing.T) {
	r := newTestSLAHandler()

	req := httptest.NewRequest(http.MethodGet, "/sla/breaches", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
