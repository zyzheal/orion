package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/backup/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/backup/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeBackupService{})
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

type fakeBackupService struct{}

func (f *fakeBackupService) CreatePlan(ctx context.Context, req *models.CreateBackupPlanRequest, tenantID string) (*models.BackupPlan, error) {
	return &models.BackupPlan{}, nil
}

func (f *fakeBackupService) CreateRecoveryPlan(ctx context.Context, req *models.CreateRecoveryPlanRequest, tenantID string) (*models.RecoveryPlan, error) {
	return &models.RecoveryPlan{}, nil
}

func (f *fakeBackupService) DeletePlan(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeBackupService) DeleteRecoveryPlan(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeBackupService) GetBackup(ctx context.Context, id string, tenantID string) (*models.BackupJob, error) {
	return &models.BackupJob{}, nil
}

func (f *fakeBackupService) GetPlan(ctx context.Context, id string, tenantID string) (*models.BackupPlan, error) {
	return &models.BackupPlan{}, nil
}

func (f *fakeBackupService) GetRecoveryPlan(ctx context.Context, id string, tenantID string) (*models.RecoveryPlan, error) {
	return &models.RecoveryPlan{}, nil
}

func (f *fakeBackupService) InitiateRestore(ctx context.Context, planID string, tenantID string) (*models.Restore, error) {
	return &models.Restore{}, nil
}

func (f *fakeBackupService) ListBackups(ctx context.Context, tenantID string, status *string) ([]models.BackupJob, int, error) {
	return []models.BackupJob{}, 0, nil
}

func (f *fakeBackupService) ListPlans(ctx context.Context, tenantID string) ([]models.BackupPlan, int, error) {
	return []models.BackupPlan{}, 0, nil
}

func (f *fakeBackupService) ListRecoveryPlans(ctx context.Context, tenantID string) ([]models.RecoveryPlan, int, error) {
	return []models.RecoveryPlan{}, 0, nil
}

func (f *fakeBackupService) TriggerBackup(ctx context.Context, planID string, tenantID string) (*models.BackupJob, error) {
	return &models.BackupJob{}, nil
}

func (f *fakeBackupService) UpdatePlan(ctx context.Context, id string, req *models.UpdateBackupPlanRequest, tenantID string) (*models.BackupPlan, error) {
	return &models.BackupPlan{}, nil
}

func (f *fakeBackupService) UpdateRecoveryPlan(ctx context.Context, id string, req *models.UpdateRecoveryPlanRequest, tenantID string) (*models.RecoveryPlan, error) {
	return &models.RecoveryPlan{}, nil
}

func (f *fakeBackupService) VerifyBackup(ctx context.Context, backupID string, tenantID string) (*models.BackupJob, error) {
	return &models.BackupJob{}, nil
}

var _ service.ServiceInterface = (*fakeBackupService)(nil)


func TestBACKUP_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestBACKUP_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestBACKUP_Handler_ListPlans(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPlans(c)
	if w.Code >= 500 {
		t.Fatalf("ListPlans: got %d", w.Code)
	}
}

func TestBACKUP_Handler_GetPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPlan(c)
	if w.Code >= 500 {
		t.Fatalf("GetPlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_CreatePlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreatePlan(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_UpdatePlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdatePlan(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_DeletePlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeletePlan(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_ListRecoveryPlans(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRecoveryPlans(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecoveryPlans: got %d", w.Code)
	}
}

func TestBACKUP_Handler_GetRecoveryPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRecoveryPlan(c)
	if w.Code >= 500 {
		t.Fatalf("GetRecoveryPlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_CreateRecoveryPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRecoveryPlan(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRecoveryPlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_UpdateRecoveryPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateRecoveryPlan(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRecoveryPlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_DeleteRecoveryPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteRecoveryPlan(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRecoveryPlan: got %d", w.Code)
	}
}

func TestBACKUP_Handler_VerifyBackup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().VerifyBackup(c)
	if w.Code >= 500 {
		t.Fatalf("VerifyBackup: got %d", w.Code)
	}
}

func TestBACKUP_Handler_InitiateRestore(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().InitiateRestore(c)
	if w.Code >= 500 {
		t.Fatalf("InitiateRestore: got %d", w.Code)
	}
}

func TestBACKUP_Handler_ListBackups(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListBackups(c)
	if w.Code >= 500 {
		t.Fatalf("ListBackups: got %d", w.Code)
	}
}

func TestBACKUP_Handler_GetBackup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetBackup(c)
	if w.Code >= 500 {
		t.Fatalf("GetBackup: got %d", w.Code)
	}
}

func TestBACKUP_Handler_TriggerBackup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().TriggerBackup(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerBackup: got %d", w.Code)
	}
}
