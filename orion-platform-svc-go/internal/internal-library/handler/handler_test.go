package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/internal-library/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/internal-library/models"
	"time"
)

func newHandler() *Handler {
	return NewHandler(&fakeInternal_libraryService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeInternal_libraryService struct{}

func (f *fakeInternal_libraryService) Activate(ctx context.Context, tenantID, id string) (*models.InternalLibrary, error) {
	return &models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) AddDependent(ctx context.Context, libraryID string, req models.AddDependentRequest) (*models.LibraryDependent, error) {
	return &models.LibraryDependent{}, nil
}

func (f *fakeInternal_libraryService) CheckDependencies(ctx context.Context, repoName string) ([]models.DependencyCheckResult, error) {
	return []models.DependencyCheckResult{}, nil
}

func (f *fakeInternal_libraryService) Create(ctx context.Context, tenantID string, req models.CreateInternalLibraryRequest) (*models.InternalLibrary, error) {
	return &models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeInternal_libraryService) Deprecate(ctx context.Context, tenantID, id, reason, migrationGuide string, eolDate *time.Time) (*models.InternalLibrary, error) {
	return &models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) DeprecateVersion(ctx context.Context, libraryID, version, reason, migrationGuide string, eolDate *time.Time) (*models.LibraryVersion, error) {
	return &models.LibraryVersion{}, nil
}

func (f *fakeInternal_libraryService) Get(ctx context.Context, tenantID, id string) (*models.InternalLibrary, error) {
	return &models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) GetByName(ctx context.Context, tenantID, name string) (*models.InternalLibrary, error) {
	return &models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) GetVersion(ctx context.Context, libraryID, version string) (*models.LibraryVersion, error) {
	return &models.LibraryVersion{}, nil
}

func (f *fakeInternal_libraryService) List(ctx context.Context, tenantID string, limit, offset int) ([]models.InternalLibrary, error) {
	return []models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) ListByLanguage(ctx context.Context, tenantID, language string, limit, offset int) ([]models.InternalLibrary, error) {
	return []models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) ListByOwner(ctx context.Context, tenantID, owner string, limit, offset int) ([]models.InternalLibrary, error) {
	return []models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) ListDependents(ctx context.Context, libraryID string) ([]models.LibraryDependent, error) {
	return []models.LibraryDependent{}, nil
}

func (f *fakeInternal_libraryService) ListVersions(ctx context.Context, libraryID string) ([]models.LibraryVersion, error) {
	return []models.LibraryVersion{}, nil
}

func (f *fakeInternal_libraryService) PublishVersion(ctx context.Context, libraryID string, req models.PublishVersionRequest) (*models.LibraryVersion, error) {
	return &models.LibraryVersion{}, nil
}

func (f *fakeInternal_libraryService) Update(ctx context.Context, tenantID, id string, req models.UpdateInternalLibraryRequest) (*models.InternalLibrary, error) {
	return &models.InternalLibrary{}, nil
}

func (f *fakeInternal_libraryService) UpdateDependentVersion(ctx context.Context, libraryID, repoName, newVersion string) error {
	return nil
}

func (f *fakeInternal_libraryService) UpdateStats(ctx context.Context, libraryID string) (*models.UpdateStatsResult, error) {
	return &models.UpdateStatsResult{}, nil
}

var _ service.ServiceInterface = (*fakeInternal_libraryService)(nil)


func TestHandler_INTERNAL_LIBRA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INTERNAL_LIB_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_GetByName(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetByName(c)
	if w.Code >= 500 {
		t.Fatalf("GetByName: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_ListByLanguage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListByLanguage(c)
	if w.Code >= 500 {
		t.Fatalf("ListByLanguage: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_ListByOwner(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListByOwner(c)
	if w.Code >= 500 {
		t.Fatalf("ListByOwner: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_PublishVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PublishVersion(c)
	if w.Code >= 500 {
		t.Fatalf("PublishVersion: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_ListVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListVersions: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_GetVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVersion(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersion: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_DeprecateVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeprecateVersion(c)
	if w.Code >= 500 {
		t.Fatalf("DeprecateVersion: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_Deprecate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Deprecate(c)
	if w.Code >= 500 {
		t.Fatalf("Deprecate: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_Activate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Activate(c)
	if w.Code >= 500 {
		t.Fatalf("Activate: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_ListDependents(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDependents(c)
	if w.Code >= 500 {
		t.Fatalf("ListDependents: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_AddDependent(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddDependent(c)
	if w.Code >= 500 {
		t.Fatalf("AddDependent: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_UpdateDependentVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDependentVersion(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDependentVersion: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_CheckDependencies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckDependencies(c)
	if w.Code >= 500 {
		t.Fatalf("CheckDependencies: got %d", w.Code)
	}
}
func TestHandler_INTERNAL_LIB_UpdateStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateStats(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateStats: got %d", w.Code)
	}
}
