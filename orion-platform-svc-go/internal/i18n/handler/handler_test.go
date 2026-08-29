package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/i18n/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/i18n/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeI18nService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeI18nService struct{}

func (f *fakeI18nService) CreateLocale(ctx context.Context, tenantID string, req models.CreateLocaleRequest) (*models.Locale, error) {
	return &models.Locale{}, nil
}

func (f *fakeI18nService) DeleteTranslation(ctx context.Context, tenantID, localeCode, namespace, key string) (bool, error) {
	return false, nil
}

func (f *fakeI18nService) GetAllTranslations(ctx context.Context, tenantID, localeCode string) (map[string]map[string]string, error) {
	return map[string]map[string]string{}, nil
}

func (f *fakeI18nService) GetTranslationsByNamespace(ctx context.Context, tenantID, localeCode, namespace string) (map[string]string, error) {
	return map[string]string{}, nil
}

func (f *fakeI18nService) ListLocales(ctx context.Context, tenantID string) ([]models.Locale, error) {
	return []models.Locale{}, nil
}

func (f *fakeI18nService) SetBulkTranslations(ctx context.Context, tenantID, localeCode, namespace string, kv map[string]string) (int, error) {
	return 0, nil
}

func (f *fakeI18nService) SetTranslation(ctx context.Context, tenantID, localeCode, namespace, key, value string) (*models.Translation, error) {
	return &models.Translation{}, nil
}

var _ service.ServiceInterface = (*fakeI18nService)(nil)

func TestHandler_I18N_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_I18N_CreateLocale(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateLocale(c)
	if w.Code >= 500 {
		t.Fatalf("CreateLocale: got %d", w.Code)
	}
}
func TestHandler_I18N_ListLocales(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListLocales(c)
	if w.Code >= 500 {
		t.Fatalf("ListLocales: got %d", w.Code)
	}
}
func TestHandler_I18N_SetTranslation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetTranslation(c)
	if w.Code >= 500 {
		t.Fatalf("SetTranslation: got %d", w.Code)
	}
}
func TestHandler_I18N_SetBulkTranslations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetBulkTranslations(c)
	if w.Code >= 500 {
		t.Fatalf("SetBulkTranslations: got %d", w.Code)
	}
}
func TestHandler_I18N_GetTranslations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTranslations(c)
	if w.Code >= 500 {
		t.Fatalf("GetTranslations: got %d", w.Code)
	}
}
func TestHandler_I18N_DeleteTranslation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTranslation(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTranslation: got %d", w.Code)
	}
}
