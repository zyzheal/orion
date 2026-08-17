package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/terminal-audit/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/terminal-audit/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeTerminal_auditService{})
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
type fakeTerminal_auditService struct{}

func (f *fakeTerminal_auditService) DeleteBatch(ctx context.Context, tenantID string, ids []string) (int, error) {
	return 0, nil
}

func (f *fakeTerminal_auditService) GetAudit(ctx context.Context, tenantID, id string) (*models.TerminalAuditLog, error) {
	return &models.TerminalAuditLog{}, nil
}

func (f *fakeTerminal_auditService) GetStats(ctx context.Context, tenantID string) (*models.AuditStats, error) {
	return &models.AuditStats{}, nil
}

func (f *fakeTerminal_auditService) ListAudits(ctx context.Context, tenantID string, q models.AuditQuery) ([]models.TerminalAuditLog, error) {
	return []models.TerminalAuditLog{}, nil
}

func (f *fakeTerminal_auditService) SearchAudits(ctx context.Context, tenantID string, q models.AuditQuery) ([]models.TerminalAuditLog, error) {
	return []models.TerminalAuditLog{}, nil
}

var _ service.ServiceInterface = (*fakeTerminal_auditService)(nil)
=======
type faketerminal_auditService struct{}

func (f *faketerminal_auditService) DeleteBatch(ctx context.Context, tenantID string, ids []string) ((int, error)) {
	return 0, nil
}

func (f *faketerminal_auditService) GetAudit(ctx context.Context, tenantID, id string) ((*models.TerminalAuditLog, error)) {
	return &models.TerminalAuditLog{}, nil
}

func (f *faketerminal_auditService) GetStats(ctx context.Context, tenantID string) ((*models.AuditStats, error)) {
	return &models.AuditStats{}, nil
}

func (f *faketerminal_auditService) ListAudits(ctx context.Context, tenantID string, q models.AuditQuery) (([]models.TerminalAuditLog, error)) {
	return []models.TerminalAuditLog{}, nil
}

func (f *faketerminal_auditService) SearchAudits(ctx context.Context, tenantID string, q models.AuditQuery) (([]models.TerminalAuditLog, error)) {
	return []models.TerminalAuditLog{}, nil
}

var _ service.ServiceInterface = (*faketerminal_auditService)(nil)
>>>>>>> Stashed changes


func TestHandler_TERMINAL_AUDIT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TERMINAL_AUD_DeleteBatch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteBatch(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBatch: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_GetAudit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAudit(c)
	if w.Code >= 500 {
		t.Fatalf("GetAudit: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_ListAudits(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAudits(c)
	if w.Code >= 500 {
		t.Fatalf("ListAudits: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_SearchAudits(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SearchAudits(c)
	if w.Code >= 500 {
		t.Fatalf("SearchAudits: got %d", w.Code)
	}
}
