package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/eventbus/models"
	"orion/platform-svc-go/internal/eventbus/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeEventbusService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeEventbusService struct{}

func (f *fakeEventbusService) Connect(ctx context.Context, tenantID string, req *models.ConnectRequest) (*models.ConnectResult, error) {
	return &models.ConnectResult{}, nil
}
func (f *fakeEventbusService) GetStatus(ctx context.Context, tenantID string) (*models.BusStatus, error) {
	return &models.BusStatus{}, nil
}
func (f *fakeEventbusService) ListSubscriptions(ctx context.Context, tenantID string) ([]models.Subscription, error) {
	return []models.Subscription{}, nil
}
func (f *fakeEventbusService) GetDLQ(ctx context.Context, tenantID string, q *models.DLQQuery) (*models.DLQResponse, error) {
	return &models.DLQResponse{}, nil
}
func (f *fakeEventbusService) GetStats(ctx context.Context, tenantID string) (*models.BusStats, error) {
	return &models.BusStats{}, nil
}
func (f *fakeEventbusService) Publish(ctx context.Context, tenantID string, userID string, req *models.PublishRequest) (*models.Event, error) {
	return &models.Event{}, nil
}
func (f *fakeEventbusService) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Event, error) {
	return []models.Event{}, nil
}
func (f *fakeEventbusService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

var _ service.ServiceInterface = (*fakeEventbusService)(nil)

func TestHandler_EVENTBUS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}
func TestHandler_EVENTBUS_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_getUserID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_Publish(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Publish(c)
	if w.Code >= 500 {
		t.Fatalf("Publish: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_GetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_ListSubscriptions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSubscriptions(c)
	if w.Code >= 500 {
		t.Fatalf("ListSubscriptions: got %d", w.Code)
	}
}
func TestHandler_EVENTBUS_GetDLQ(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDLQ(c)
	if w.Code >= 500 {
		t.Fatalf("GetDLQ: got %d", w.Code)
	}
}
