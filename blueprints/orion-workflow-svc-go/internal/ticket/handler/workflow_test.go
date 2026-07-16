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

func setupWorkflowRouter(svc *service.TicketService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewWorkflowHandler(svc)

	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Next()
	})

	r.POST("/tickets/:id/transition", h.TransitionStatus)
	r.GET("/tickets/:id/history", h.GetWorkflowHistory)
	r.POST("/tickets/:id/escalate", h.EscalateTicket)
	r.POST("/tickets/:id/close", h.CloseTicket)

	return r
}

func newTestWorkflowHandler() (*gin.Engine, *testutil.MockTicketRepository) {
	ticketRepo := testutil.NewMockTicketRepository()
	commentRepo := testutil.NewMockCommentRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()
	slaRepo := testutil.NewMockSLARepository()
	dispatchRepo := testutil.NewMockDispatchRepository()
	relationRepo := testutil.NewMockRelationRepository()
	ruleRepo := testutil.NewMockAssignmentRuleRepository()

	workflowSvc := service.NewWorkflowService(workflowRepo, ticketRepo)
	slaSvc := service.NewSLAService(slaRepo, ticketRepo)
	dispatchSvc := service.NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	analyzerSvc := service.NewAnalyzerService(relationRepo, ticketRepo)
	svc := service.NewTicketService(ticketRepo, commentRepo, workflowSvc, slaSvc, dispatchSvc, analyzerSvc, ruleRepo)

	return setupWorkflowRouter(svc), ticketRepo
}

func TestHandler_TransitionStatus(t *testing.T) {
	r, repo := newTestWorkflowHandler()
	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "open"}

	body, _ := json.Marshal(map[string]string{
		"to_status":    "in-progress",
		"performed_by": "user-1",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/transition", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_TransitionStatus_Invalid(t *testing.T) {
	r, repo := newTestWorkflowHandler()
	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "closed"}

	body, _ := json.Marshal(map[string]string{
		"to_status":    "resolved",
		"performed_by": "user-1",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/transition", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_GetWorkflowHistory(t *testing.T) {
	r, _ := newTestWorkflowHandler()

	req := httptest.NewRequest(http.MethodGet, "/tickets/t1/history", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_EscalateTicket(t *testing.T) {
	r, repo := newTestWorkflowHandler()
	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Priority: "low", Status: "open"}

	body, _ := json.Marshal(map[string]string{
		"escalated_by": "user-1",
		"reason":       "urgent",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/escalate", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_CloseTicket(t *testing.T) {
	r, repo := newTestWorkflowHandler()
	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "resolved"}

	body, _ := json.Marshal(map[string]string{
		"performed_by": "user-1",
		"reason":       "done",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/close", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
