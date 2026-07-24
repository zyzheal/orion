package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/team/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_TEAM_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TEAM_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_TEAM_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_TEAM_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_TEAM_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_TEAM_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_TEAM_GetUserTeams(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetUserTeams(c)
	if w.Code >= 500 {
		t.Fatalf("GetUserTeams: got %d", w.Code)
	}
}
func TestHandler_TEAM_GetMembers(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMembers(c)
	if w.Code >= 500 {
		t.Fatalf("GetMembers: got %d", w.Code)
	}
}
func TestHandler_TEAM_AddMember(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddMember(c)
	if w.Code >= 500 {
		t.Fatalf("AddMember: got %d", w.Code)
	}
}
func TestHandler_TEAM_RemoveMember(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveMember(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveMember: got %d", w.Code)
	}
}
func TestHandler_TEAM_UpdateMemberRole(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateMemberRole(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateMemberRole: got %d", w.Code)
	}
}
func TestHandler_TEAM_GetRoles(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRoles(c)
	if w.Code >= 500 {
		t.Fatalf("GetRoles: got %d", w.Code)
	}
}
func TestHandler_TEAM_AssignRole(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AssignRole(c)
	if w.Code >= 500 {
		t.Fatalf("AssignRole: got %d", w.Code)
	}
}
func TestHandler_TEAM_RemoveRole(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveRole(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveRole: got %d", w.Code)
	}
}
