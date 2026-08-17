package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/version-archive/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/version-archive/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeVersion_archiveService{})
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
type fakeVersion_archiveService struct{}

func (f *fakeVersion_archiveService) Create(ctx context.Context, tenantID string, req models.CreateVersionArchiveRequest) (*models.VersionArchive, error) {
	return &models.VersionArchive{}, nil
}

func (f *fakeVersion_archiveService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeVersion_archiveService) Get(ctx context.Context, tenantID, id string) (*models.VersionArchive, error) {
	return &models.VersionArchive{}, nil
}

func (f *fakeVersion_archiveService) List(ctx context.Context, tenantID string) ([]models.VersionArchive, error) {
	return []models.VersionArchive{}, nil
}

func (f *fakeVersion_archiveService) Update(ctx context.Context, tenantID, id string, req models.UpdateVersionArchiveRequest) (*models.VersionArchive, error) {
	return &models.VersionArchive{}, nil
}

var _ service.ServiceInterface = (*fakeVersion_archiveService)(nil)
=======
type fakeversion_archiveService struct{}

func (f *fakeversion_archiveService) Create(ctx context.Context, tenantID string, req models.CreateVersionArchiveRequest) ((*models.VersionArchive, error)) {
	return &models.VersionArchive{}, nil
}

func (f *fakeversion_archiveService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeversion_archiveService) Get(ctx context.Context, tenantID, id string) ((*models.VersionArchive, error)) {
	return &models.VersionArchive{}, nil
}

func (f *fakeversion_archiveService) List(ctx context.Context, tenantID string) (([]models.VersionArchive, error)) {
	return []models.VersionArchive{}, nil
}

func (f *fakeversion_archiveService) Update(ctx context.Context, tenantID, id string, req models.UpdateVersionArchiveRequest) ((*models.VersionArchive, error)) {
	return &models.VersionArchive{}, nil
}

var _ service.ServiceInterface = (*fakeversion_archiveService)(nil)
>>>>>>> Stashed changes


func TestHandler_VERSION_ARCHIV_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_VERSION_ARCH_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_VERSION_ARCH_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_VERSION_ARCH_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_VERSION_ARCH_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_VERSION_ARCH_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
