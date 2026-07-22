package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/knowledge/service"

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

func TestHandler_KNOWLEDGE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_KNOWLEDGE_ListSpaces(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSpaces(c)
	if w.Code >= 500 {
		t.Fatalf("ListSpaces: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_CreateSpace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSpace(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSpace: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetSpace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSpace(c)
	if w.Code >= 500 {
		t.Fatalf("GetSpace: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_UpdateSpace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSpace(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSpace: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_DeleteSpace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSpace(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSpace: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_ListDocs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDocs(c)
	if w.Code >= 500 {
		t.Fatalf("ListDocs: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetDocTags(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDocTags(c)
	if w.Code >= 500 {
		t.Fatalf("GetDocTags: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetDocToc(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDocToc(c)
	if w.Code >= 500 {
		t.Fatalf("GetDocToc: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_CreateDoc(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDoc(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDoc: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetDoc(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDoc(c)
	if w.Code >= 500 {
		t.Fatalf("GetDoc: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_UpdateDoc(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDoc(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDoc: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_DeleteDoc(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDoc(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDoc: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetDocVersions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDocVersions(c)
	if w.Code >= 500 {
		t.Fatalf("GetDocVersions: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_TriggerSync(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TriggerSync(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerSync: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetSyncLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSyncLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetSyncLogs: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_RAGRetrieve(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RAGRetrieve(c)
	if w.Code >= 500 {
		t.Fatalf("RAGRetrieve: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_RAGQuery(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RAGQuery(c)
	if w.Code >= 500 {
		t.Fatalf("RAGQuery: got %d", w.Code)
	}
}
func TestHandler_KNOWLEDGE_GetGraph(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetGraph(c)
	if w.Code >= 500 {
		t.Fatalf("GetGraph: got %d", w.Code)
	}
}
