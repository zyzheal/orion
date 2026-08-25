package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/apk-upload-history/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/apk-upload-history/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeApk_upload_historyService{})
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

type fakeApk_upload_historyService struct{}

func (f *fakeApk_upload_historyService) CheckDuplicate(ctx context.Context, tenantID, market, packageName, version string) (bool, error) {
	return false, nil
}

func (f *fakeApk_upload_historyService) CreateRecord(ctx context.Context, tenantID string, record *models.ApkUploadRecord) (*models.ApkUploadRecord, error) {
	return &models.ApkUploadRecord{}, nil
}

func (f *fakeApk_upload_historyService) GetRecord(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error) {
	return &models.ApkUploadRecord{}, nil
}

func (f *fakeApk_upload_historyService) GetStats(ctx context.Context, tenantID string) (*models.ApkUploadStats, error) {
	return &models.ApkUploadStats{}, nil
}

func (f *fakeApk_upload_historyService) ListRecords(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error) {
	return []models.ApkUploadRecord{}, 0, nil
}

func (f *fakeApk_upload_historyService) RecentFailures(ctx context.Context, tenantID string) ([]models.ApkUploadRecord, error) {
	return []models.ApkUploadRecord{}, nil
}

func (f *fakeApk_upload_historyService) UpdateStatus(ctx context.Context, tenantID, id string, status models.ApkStatus, errMsg string) (*models.ApkUploadRecord, error) {
	return &models.ApkUploadRecord{}, nil
}

var _ service.ServiceInterface = (*fakeApk_upload_historyService)(nil)


func TestAPK_UPLOAD_HISTORY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPK_UPLOAD_HISTORY_Handler_ListRecords(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRecords(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecords: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_GetRecord(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRecord(c)
	if w.Code >= 500 {
		t.Fatalf("GetRecord: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_CreateRecord(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRecord(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRecord: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_UpdateStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateStatus(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateStatus: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_DeleteRecord(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteRecord(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRecord: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_RecentFailures(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RecentFailures(c)
	if w.Code >= 500 {
		t.Fatalf("RecentFailures: got %d", w.Code)
	}
}

func TestAPK_UPLOAD_HISTORY_Handler_CheckDuplicate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CheckDuplicate(c)
	if w.Code >= 500 {
		t.Fatalf("CheckDuplicate: got %d", w.Code)
	}
}
