package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/incident-action/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/incident-action/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeIncident_actionService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeIncident_actionService struct{}

func (f *fakeIncident_actionService) Create(ctx context.Context, tenantID string, e *models.LILNLCLILDLELNLTLuLALCLTLILOLN) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return &models.LILNLCLILDLELNLTLuLALCLTLILOLN{}, nil
}

func (f *fakeIncident_actionService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeIncident_actionService) Get(ctx context.Context, tenantID, id string) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return &models.LILNLCLILDLELNLTLuLALCLTLILOLN{}, nil
}

func (f *fakeIncident_actionService) List(ctx context.Context, tenantID string) ([]models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return []models.LILNLCLILDLELNLTLuLALCLTLILOLN{}, nil
}

func (f *fakeIncident_actionService) Update(ctx context.Context, tenantID, id string, updates map[string]any) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return &models.LILNLCLILDLELNLTLuLALCLTLILOLN{}, nil
}

var _ service.ServiceInterface = (*fakeIncident_actionService)(nil)

func TestHandler_INCIDENT_ACTIO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INCIDENT_ACT_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_ACT_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_ACT_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_ACT_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_ACT_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
