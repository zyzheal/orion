package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ticket-knowledge/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/ticket-knowledge/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeTicket_knowledgeService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeTicket_knowledgeService struct{}

func (f *fakeTicket_knowledgeService) Create(ctx context.Context, tenantID string, req models.CreateTicketKnowledgeRequest) (*models.TicketKnowledge, error) {
	return &models.TicketKnowledge{}, nil
}

func (f *fakeTicket_knowledgeService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeTicket_knowledgeService) Get(ctx context.Context, tenantID, id string) (*models.TicketKnowledge, error) {
	return &models.TicketKnowledge{}, nil
}

func (f *fakeTicket_knowledgeService) List(ctx context.Context, tenantID string) ([]models.TicketKnowledge, error) {
	return []models.TicketKnowledge{}, nil
}

func (f *fakeTicket_knowledgeService) Update(ctx context.Context, tenantID, id string, req models.UpdateTicketKnowledgeRequest) (*models.TicketKnowledge, error) {
	return &models.TicketKnowledge{}, nil
}

var _ service.ServiceInterface = (*fakeTicket_knowledgeService)(nil)


func TestHandler_TICKET_KNOWLED_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TICKET_KNOWL_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_TICKET_KNOWL_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_TICKET_KNOWL_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_TICKET_KNOWL_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_TICKET_KNOWL_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
