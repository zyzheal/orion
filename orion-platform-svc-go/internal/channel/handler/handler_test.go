package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/channel/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/channel/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeChannelService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

type fakeChannelService struct{}

func (f *fakeChannelService) Create(ctx context.Context, tenantID string, req *models.CreateChannelRequest) (*models.NotificationChannel, error) {
	return &models.NotificationChannel{}, nil
}

func (f *fakeChannelService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeChannelService) GetByID(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	return &models.NotificationChannel{}, nil
}

func (f *fakeChannelService) GetEnabledByType(ctx context.Context, tenantID, channelType string) ([]models.NotificationChannel, error) {
	return []models.NotificationChannel{}, nil
}

func (f *fakeChannelService) List(ctx context.Context, tenantID string, filter *models.ChannelFilter) ([]models.NotificationChannel, int, error) {
	return []models.NotificationChannel{}, 0, nil
}

func (f *fakeChannelService) Update(ctx context.Context, tenantID, id string, req *models.UpdateChannelRequest) (*models.NotificationChannel, error) {
	return &models.NotificationChannel{}, nil
}

var _ service.ServiceInterface = (*fakeChannelService)(nil)

func TestCHANNEL_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHANNEL_Handler_CreateChannel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateChannel(c)
	if w.Code >= 500 {
		t.Fatalf("CreateChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_GetChannel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetChannel(c)
	if w.Code >= 500 {
		t.Fatalf("GetChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_ListChannels(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListChannels(c)
	if w.Code >= 500 {
		t.Fatalf("ListChannels: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_UpdateChannel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateChannel(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_DeleteChannel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteChannel(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_GetEnabledByType(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetEnabledByType(c)
	if w.Code >= 500 {
		t.Fatalf("GetEnabledByType: got %d", w.Code)
	}
}
