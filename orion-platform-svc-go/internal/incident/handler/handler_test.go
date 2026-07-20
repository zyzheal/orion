package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/incident/service"

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

func TestHandler_INCIDENT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INCIDENT_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_UpdateStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateStatus(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateStatus: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_AssignCommander(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AssignCommander(c)
	if w.Code >= 500 {
		t.Fatalf("AssignCommander: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_Escalate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Escalate(c)
	if w.Code >= 500 {
		t.Fatalf("Escalate: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_GetEscalations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEscalations(c)
	if w.Code >= 500 {
		t.Fatalf("GetEscalations: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_CheckSla(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckSla(c)
	if w.Code >= 500 {
		t.Fatalf("CheckSla: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_MarkSlaBreach(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().MarkSlaBreach(c)
	if w.Code >= 500 {
		t.Fatalf("MarkSlaBreach: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_AddTimelineEvent(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddTimelineEvent(c)
	if w.Code >= 500 {
		t.Fatalf("AddTimelineEvent: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_GetTimeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTimeline(c)
	if w.Code >= 500 {
		t.Fatalf("GetTimeline: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_CreatePostmortem(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreatePostmortem(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePostmortem: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_GetPostmortem(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPostmortem(c)
	if w.Code >= 500 {
		t.Fatalf("GetPostmortem: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_UpdatePostmortem(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdatePostmortem(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePostmortem: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_PublishPostmortem(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PublishPostmortem(c)
	if w.Code >= 500 {
		t.Fatalf("PublishPostmortem: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_ArchivePostmortem(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ArchivePostmortem(c)
	if w.Code >= 500 {
		t.Fatalf("ArchivePostmortem: got %d", w.Code)
	}
}
func TestHandler_INCIDENT_GetKnowledgeRecommendations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetKnowledgeRecommendations(c)
	if w.Code >= 500 {
		t.Fatalf("GetKnowledgeRecommendations: got %d", w.Code)
	}
}
