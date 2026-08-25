package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-audit-log/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/pipeline-audit-log/models"
)

func newHandler() *Handler {
	return NewHandler(&fakePipeline_audit_logService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakePipeline_audit_logService struct{}

func (f *fakePipeline_audit_logService) CleanupExpired(ctx context.Context, tenantID string, req *models.CleanupRequest) (int64, error) {
	return 0, nil
}

func (f *fakePipeline_audit_logService) GetAuditLogByAction(ctx context.Context, tenantID, action string, limit, offset int) ([]models.AuditLog, int, error) {
	return []models.AuditLog{}, 0, nil
}

func (f *fakePipeline_audit_logService) GetAuditLogByPipeline(ctx context.Context, tenantID, pipelineID string, limit, offset int) ([]models.AuditLog, int, error) {
	return []models.AuditLog{}, 0, nil
}

func (f *fakePipeline_audit_logService) GetRunAuditTrail(ctx context.Context, tenantID, runID string, limit int) (*models.AuditTrailResponse, error) {
	return &models.AuditTrailResponse{}, nil
}

func (f *fakePipeline_audit_logService) Query(ctx context.Context, q *models.AuditLogQuery, tenantID string) ([]models.AuditLog, int, error) {
	return []models.AuditLog{}, 0, nil
}

func (f *fakePipeline_audit_logService) Record(ctx context.Context, req *models.AuditLogRequest, tenantID string) (*models.AuditLog, error) {
	return &models.AuditLog{}, nil
}

func (f *fakePipeline_audit_logService) RecordBatch(ctx context.Context, reqs []models.AuditLogRequest, tenantID string) ([]*models.AuditLog, error) {
	return []*models.AuditLog{}, nil
}

var _ service.ServiceInterface = (*fakePipeline_audit_logService)(nil)


func TestHandler_PIPELINE_AUDIT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_AUD_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_AUD_Record(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Record(c)
	if w.Code >= 500 {
		t.Fatalf("Record: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_AUD_RecordBatch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordBatch(c)
	if w.Code >= 500 {
		t.Fatalf("RecordBatch: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_AUD_Query(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Query(c)
	if w.Code >= 500 {
		t.Fatalf("Query: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_AUD_GetRunAuditTrail(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRunAuditTrail(c)
	if w.Code >= 500 {
		t.Fatalf("GetRunAuditTrail: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_AUD_CleanupExpired(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CleanupExpired(c)
	if w.Code >= 500 {
		t.Fatalf("CleanupExpired: got %d", w.Code)
	}
}
