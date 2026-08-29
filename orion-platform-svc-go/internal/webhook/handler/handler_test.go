package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/webhook/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/webhook/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeWebhookService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeWebhookService struct{}

func (f *fakeWebhookService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeWebhookService) Create(ctx context.Context, tenantID, userID string, req *models.CreateWebhookRequest) (*models.Webhook, error) {
	return &models.Webhook{}, nil
}

func (f *fakeWebhookService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeWebhookService) Get(ctx context.Context, tenantID, id string) (*models.Webhook, error) {
	return &models.Webhook{}, nil
}

func (f *fakeWebhookService) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.Webhook, int, error) {
	return []models.Webhook{}, 0, nil
}

func (f *fakeWebhookService) ListDeliveries(ctx context.Context, tenantID, webhookID string, limit, offset int) ([]models.WebhookDelivery, int, error) {
	return []models.WebhookDelivery{}, 0, nil
}

func (f *fakeWebhookService) RotateSecret(ctx context.Context, tenantID, id string) (string, error) {
	return "", nil
}

func (f *fakeWebhookService) Trigger(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeWebhookService) TriggerByEvent(ctx context.Context, tenantID, eventType string) error {
	return nil
}

func (f *fakeWebhookService) Update(ctx context.Context, tenantID, id string, req *models.UpdateWebhookRequest) (*models.Webhook, error) {
	return &models.Webhook{}, nil
}

var _ service.ServiceInterface = (*fakeWebhookService)(nil)

func TestHandler_WEBHOOK_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_WEBHOOK_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_getUserID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_Trigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Trigger(c)
	if w.Code >= 500 {
		t.Fatalf("Trigger: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_TriggerByEvent(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TriggerByEvent(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerByEvent: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_RotateSecret(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RotateSecret(c)
	if w.Code >= 500 {
		t.Fatalf("RotateSecret: got %d", w.Code)
	}
}
func TestHandler_WEBHOOK_ListDeliveries(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDeliveries(c)
	if w.Code >= 500 {
		t.Fatalf("ListDeliveries: got %d", w.Code)
	}
}
