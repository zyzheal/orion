package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

func setupTicketRouter(svc *service.TicketService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	h := NewTicketHandler(svc)

	// Middleware to set tenant_id
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Next()
	})

	r.GET("/tickets", h.ListTickets)
	r.GET("/tickets/:id", h.GetTicket)
	r.POST("/tickets", h.CreateTicket)
	r.PUT("/tickets/:id", h.UpdateTicket)
	r.DELETE("/tickets/:id", h.DeleteTicket)
	r.POST("/tickets/:id/assign", h.AssignTicket)
	r.POST("/tickets/:id/resolve", h.ResolveTicket)
	r.GET("/tickets/:id/comments", h.ListComments)
	r.POST("/tickets/:id/comments", h.CreateComment)
	r.GET("/tickets/count", h.Count)

	return r
}

func newTestTicketHandler() (*gin.Engine, *testutil.MockTicketRepository) {
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

	r := setupTicketRouter(svc)
	return r, ticketRepo
}

func TestHandler_CreateTicket(t *testing.T) {
	r, _ := newTestTicketHandler()

	body, _ := json.Marshal(map[string]string{
		"title":    "Test Ticket",
		"type":     "bug",
		"priority": "high",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "user-1")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["data"] == nil {
		t.Error("expected data in response")
	}
}

func TestHandler_GetTicket(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Title: "Test"}

	req := httptest.NewRequest(http.MethodGet, "/tickets/t1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestHandler_GetTicket_NotFound(t *testing.T) {
	r, _ := newTestTicketHandler()

	req := httptest.NewRequest(http.MethodGet, "/tickets/nonexistent", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}
}

func TestHandler_ListTickets(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Title: "A"}
	repo.Tickets["t2"] = &models.Ticket{ID: "t2", TenantID: "tenant-1", Title: "B"}

	req := httptest.NewRequest(http.MethodGet, "/tickets?page=1&page_size=10", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["total"].(float64) != 2 {
		t.Errorf("expected total 2, got %v", resp["total"])
	}
}

func TestHandler_DeleteTicket(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}

	req := httptest.NewRequest(http.MethodDelete, "/tickets/t1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	if _, ok := repo.Tickets["t1"]; ok {
		t.Error("ticket should have been deleted")
	}
}

func TestHandler_AssignTicket(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "open"}

	body, _ := json.Marshal(map[string]string{"assigned_to": "engineer-1"})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/assign", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_CreateComment(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}

	body, _ := json.Marshal(map[string]string{
		"author":  "user-1",
		"content": "Hello",
	})
	req := httptest.NewRequest(http.MethodPost, "/tickets/t1/comments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_ListComments(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}

	req := httptest.NewRequest(http.MethodGet, "/tickets/t1/comments", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestHandler_Count(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}
	repo.Tickets["t2"] = &models.Ticket{ID: "t2", TenantID: "tenant-1"}

	req := httptest.NewRequest(http.MethodGet, "/tickets/count", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["count"].(float64) != 2 {
		t.Errorf("expected count 2, got %v", resp["count"])
	}
}

func TestHandler_UpdateTicket(t *testing.T) {
	r, repo := newTestTicketHandler()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Title: "Old"}

	body, _ := json.Marshal(map[string]string{"title": "New"})
	req := httptest.NewRequest(http.MethodPut, "/tickets/t1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]any)
	if data["title"] != "New" {
		t.Errorf("expected title 'New', got '%s'", data["title"])
	}
}
