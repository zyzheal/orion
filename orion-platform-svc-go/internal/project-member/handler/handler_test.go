package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/project-member/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/project-member/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeProject_memberService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeProject_memberService struct{}

func (f *fakeProject_memberService) CheckRole(ctx context.Context, tenantID, projectID, userID, role string) (bool, error) {
	return false, nil
}

func (f *fakeProject_memberService) CountByProject(ctx context.Context, tenantID, projectID string) (int, error) {
	return 0, nil
}

func (f *fakeProject_memberService) CreateMember(ctx context.Context, tenantID string, req models.CreateProjectMemberRequest) (*models.ProjectMember, error) {
	return &models.ProjectMember{}, nil
}

func (f *fakeProject_memberService) DeleteByProject(ctx context.Context, tenantID, projectID string) error {
	return nil
}

func (f *fakeProject_memberService) DeleteMember(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeProject_memberService) GetMember(ctx context.Context, tenantID, id string) (*models.ProjectMember, error) {
	return &models.ProjectMember{}, nil
}

func (f *fakeProject_memberService) GetMemberByProjectUser(ctx context.Context, tenantID, projectID, userID string) (*models.ProjectMember, error) {
	return &models.ProjectMember{}, nil
}

func (f *fakeProject_memberService) ListByProject(ctx context.Context, tenantID, projectID string) ([]models.ProjectMember, error) {
	return []models.ProjectMember{}, nil
}

func (f *fakeProject_memberService) ListMembers(ctx context.Context, tenantID string, q models.ListMembersQuery) ([]models.ProjectMember, int, error) {
	return []models.ProjectMember{}, 0, nil
}

func (f *fakeProject_memberService) UpdateMember(ctx context.Context, tenantID, id string, req models.UpdateProjectMemberRequest) (*models.ProjectMember, error) {
	return &models.ProjectMember{}, nil
}

var _ service.ServiceInterface = (*fakeProject_memberService)(nil)

func TestHandler_PROJECT_MEMBER_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PROJECT_MEMB_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_ListByProject(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListByProject(c)
	if w.Code >= 500 {
		t.Fatalf("ListByProject: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_CountByProject(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CountByProject(c)
	if w.Code >= 500 {
		t.Fatalf("CountByProject: got %d", w.Code)
	}
}
func TestHandler_PROJECT_MEMB_CheckRole(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckRole(c)
	if w.Code >= 500 {
		t.Fatalf("CheckRole: got %d", w.Code)
	}
}
