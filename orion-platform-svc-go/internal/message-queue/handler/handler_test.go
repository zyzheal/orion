package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/message-queue/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/message-queue/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeMessage_queueService{})
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
type fakeMessage_queueService struct{}

func (f *fakeMessage_queueService) Create(ctx context.Context, tenantID string, req models.CreateMessageQueueRequest) (*models.MessageQueue, error) {
	return &models.MessageQueue{}, nil
}

func (f *fakeMessage_queueService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeMessage_queueService) Get(ctx context.Context, tenantID, id string) (*models.MessageQueue, error) {
	return &models.MessageQueue{}, nil
}

func (f *fakeMessage_queueService) List(ctx context.Context, tenantID string) ([]models.MessageQueue, error) {
	return []models.MessageQueue{}, nil
}

func (f *fakeMessage_queueService) Update(ctx context.Context, tenantID, id string, req models.UpdateMessageQueueRequest) (*models.MessageQueue, error) {
	return &models.MessageQueue{}, nil
}

var _ service.ServiceInterface = (*fakeMessage_queueService)(nil)
=======
type fakemessage_queueService struct{}

func (f *fakemessage_queueService) Create(ctx context.Context, tenantID string, req models.CreateMessageQueueRequest) ((*models.MessageQueue, error)) {
	return &models.MessageQueue{}, nil
}

func (f *fakemessage_queueService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakemessage_queueService) Get(ctx context.Context, tenantID, id string) ((*models.MessageQueue, error)) {
	return &models.MessageQueue{}, nil
}

func (f *fakemessage_queueService) List(ctx context.Context, tenantID string) (([]models.MessageQueue, error)) {
	return []models.MessageQueue{}, nil
}

func (f *fakemessage_queueService) Update(ctx context.Context, tenantID, id string, req models.UpdateMessageQueueRequest) ((*models.MessageQueue, error)) {
	return &models.MessageQueue{}, nil
}

var _ service.ServiceInterface = (*fakemessage_queueService)(nil)
>>>>>>> Stashed changes


func TestHandler_MESSAGE_QUEUE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_MESSAGE_QUEU_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_MESSAGE_QUEU_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_MESSAGE_QUEU_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_MESSAGE_QUEU_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_MESSAGE_QUEU_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
