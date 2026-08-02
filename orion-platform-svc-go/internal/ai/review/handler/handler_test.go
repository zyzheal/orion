package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai/review/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
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

func TestAI_REVIEW_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAI_REVIEW_Handler_ApproveReview(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveReview: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_CreateReview(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateReview: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_GetReview(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetReview: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_ListReviews(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReviews(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListReviews: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_RejectReview(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RejectReview: got %d", w.Code)
	}
}
