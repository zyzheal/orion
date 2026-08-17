package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sprint/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/sprint/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeSprintService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeSprintService struct{}

func (f *fakeSprintService) AddTicket(ctx context.Context, tenantID, sprintID string, req models.AddTicketRequest) (*models.SprintTicket, error) {
	return &models.SprintTicket{}, nil
}

func (f *fakeSprintService) Create(ctx context.Context, tenantID string, req models.CreateSprintRequest) (*models.Sprint, error) {
	return &models.Sprint{}, nil
}

func (f *fakeSprintService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeSprintService) Get(ctx context.Context, tenantID, id string) (*models.Sprint, error) {
	return &models.Sprint{}, nil
}

func (f *fakeSprintService) GetBoard(ctx context.Context, tenantID, sprintID string) (*models.SprintBoard, error) {
	return &models.SprintBoard{}, nil
}

func (f *fakeSprintService) GetBurndownData(ctx context.Context, tenantID, sprintID string) (*models.BurndownData, error) {
	return &models.BurndownData{}, nil
}

func (f *fakeSprintService) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Sprint, error) {
	return []models.Sprint{}, nil
}

func (f *fakeSprintService) RemoveTicket(ctx context.Context, tenantID, sprintID, ticketID string) error {
	return nil
}

func (f *fakeSprintService) ReorderTickets(ctx context.Context, tenantID, sprintID string, req models.ReorderTicketsRequest) error {
	return nil
}

func (f *fakeSprintService) Update(ctx context.Context, tenantID, id string, req models.UpdateSprintRequest) (*models.Sprint, error) {
	return &models.Sprint{}, nil
}

var _ service.ServiceInterface = (*fakeSprintService)(nil)
=======
type fakesprintService struct{}

func (f *fakesprintService) AddTicket(ctx context.Context, tenantID, sprintID string, req models.AddTicketRequest) ((*models.SprintTicket, error)) {
	return &models.SprintTicket{}, nil
}

func (f *fakesprintService) Create(ctx context.Context, tenantID string, req models.CreateSprintRequest) ((*models.Sprint, error)) {
	return &models.Sprint{}, nil
}

func (f *fakesprintService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakesprintService) Get(ctx context.Context, tenantID, id string) ((*models.Sprint, error)) {
	return &models.Sprint{}, nil
}

func (f *fakesprintService) GetBoard(ctx context.Context, tenantID, sprintID string) ((*models.SprintBoard, error)) {
	return &models.SprintBoard{}, nil
}

func (f *fakesprintService) GetBurndownData(ctx context.Context, tenantID, sprintID string) ((*models.BurndownData, error)) {
	return &models.BurndownData{}, nil
}

func (f *fakesprintService) List(ctx context.Context, tenantID string, limit, offset int) (([]models.Sprint, error)) {
	return []models.Sprint{}, nil
}

func (f *fakesprintService) RemoveTicket(ctx context.Context, tenantID, sprintID, ticketID string) (error) {
	return nil
}

func (f *fakesprintService) ReorderTickets(ctx context.Context, tenantID, sprintID string, req models.ReorderTicketsRequest) (error) {
	return nil
}

func (f *fakesprintService) Update(ctx context.Context, tenantID, id string, req models.UpdateSprintRequest) ((*models.Sprint, error)) {
	return &models.Sprint{}, nil
}

var _ service.ServiceInterface = (*fakesprintService)(nil)
>>>>>>> Stashed changes


func TestHandler_SPRINT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SPRINT_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SPRINT_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SPRINT_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SPRINT_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SPRINT_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SPRINT_GetBoard(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBoard(c)
	if w.Code >= 500 {
		t.Fatalf("GetBoard: got %d", w.Code)
	}
}
func TestHandler_SPRINT_AddTicket(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddTicket(c)
	if w.Code >= 500 {
		t.Fatalf("AddTicket: got %d", w.Code)
	}
}
func TestHandler_SPRINT_RemoveTicket(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveTicket(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveTicket: got %d", w.Code)
	}
}
func TestHandler_SPRINT_ReorderTickets(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ReorderTickets(c)
	if w.Code >= 500 {
		t.Fatalf("ReorderTickets: got %d", w.Code)
	}
}
func TestHandler_SPRINT_GetBurndownData(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBurndownData(c)
	if w.Code >= 500 {
		t.Fatalf("GetBurndownData: got %d", w.Code)
	}
}
