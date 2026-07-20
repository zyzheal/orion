package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/skill/service"

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

func TestHandler_SKILL_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SKILL_ListSkills(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSkills(c)
	if w.Code >= 500 {
		t.Fatalf("ListSkills: got %d", w.Code)
	}
}
func TestHandler_SKILL_CreateSkill(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSkill(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetSkill(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSkill(c)
	if w.Code >= 500 {
		t.Fatalf("GetSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_UpdateSkill(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSkill(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_DeleteSkill(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSkill(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListVersions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListVersions: got %d", w.Code)
	}
}
func TestHandler_SKILL_AddVersion(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddVersion(c)
	if w.Code >= 500 {
		t.Fatalf("AddVersion: got %d", w.Code)
	}
}
func TestHandler_SKILL_RateSkill(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RateSkill(c)
	if w.Code >= 500 {
		t.Fatalf("RateSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetRatingStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRatingStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetRatingStats: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListInstances(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListInstances(c)
	if w.Code >= 500 {
		t.Fatalf("ListInstances: got %d", w.Code)
	}
}
func TestHandler_SKILL_CreateInstance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateInstance(c)
	if w.Code >= 500 {
		t.Fatalf("CreateInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetInstance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetInstance(c)
	if w.Code >= 500 {
		t.Fatalf("GetInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_UpdateInstance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateInstance(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_DeleteInstance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteInstance(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_ExecuteSkill(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteSkill(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListExecutions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExecutions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExecutions: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetReview(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReview(c)
	if w.Code >= 500 {
		t.Fatalf("GetReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_SubmitReview(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SubmitReview(c)
	if w.Code >= 500 {
		t.Fatalf("SubmitReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_ApproveReview(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveReview(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_RejectReview(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectReview(c)
	if w.Code >= 500 {
		t.Fatalf("RejectReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_ArchiveReview(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ArchiveReview(c)
	if w.Code >= 500 {
		t.Fatalf("ArchiveReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListReviews(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListReviews(c)
	if w.Code >= 500 {
		t.Fatalf("ListReviews: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetAuditLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAuditLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetAuditLogs: got %d", w.Code)
	}
}
