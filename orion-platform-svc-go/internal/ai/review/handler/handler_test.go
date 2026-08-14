package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai/review/models"
	"orion/platform-svc-go/internal/ai/review/service"

	"github.com/gin-gonic/gin"
)

type fakeReviewService struct{}

func (f *fakeReviewService) Create(ctx context.Context, tenantID string, req models.CreateReviewRequest) (*models.ReviewRequest, error) {
	return &models.ReviewRequest{ID: "rev-1"}, nil
}
func (f *fakeReviewService) Get(ctx context.Context, tenantID string, id string) (*models.ReviewRequest, error) {
	return &models.ReviewRequest{ID: id}, nil
}
func (f *fakeReviewService) List(ctx context.Context, tenantID string, q models.ListReviewsQuery) (*models.ReviewListResponse, error) {
	return &models.ReviewListResponse{}, nil
}
func (f *fakeReviewService) Approve(ctx context.Context, tenantID string, id string) (*models.ReviewRequest, error) {
	return &models.ReviewRequest{ID: id}, nil
}
func (f *fakeReviewService) Reject(ctx context.Context, tenantID string, id string) (*models.ReviewRequest, error) {
	return &models.ReviewRequest{ID: id}, nil
}

var _ service.ServiceInterface = (*fakeReviewService)(nil)

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
	newHandler().RegisterRoutes(gin.New().Group("/api/v1/ai/review"))
}

func TestAI_REVIEW_Handler_CreateReview(t *testing.T) {
	h := NewHandler(&fakeReviewService{})
	c, w := makeCtx(http.MethodPost, "/api/v1/ai/review", models.CreateReviewRequest{Content: "test", CreatedBy: "u1"}, nil)
	h.CreateReview(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("CreateReview: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_GetReview(t *testing.T) {
	h := NewHandler(&fakeReviewService{})
	c, w := makeCtx(http.MethodGet, "/api/v1/ai/review/rev-1", nil, map[string]string{"id": "rev-1"})
	h.GetReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetReview: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_ListReviews(t *testing.T) {
	h := NewHandler(&fakeReviewService{})
	c, w := makeCtx(http.MethodGet, "/api/v1/ai/review", nil, nil)
	h.ListReviews(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListReviews: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_ApproveReview(t *testing.T) {
	h := NewHandler(&fakeReviewService{})
	c, w := makeCtx(http.MethodPost, "/api/v1/ai/review/rev-1/approve", nil, map[string]string{"id": "rev-1"})
	h.ApproveReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveReview: got %d", w.Code)
	}
}

func TestAI_REVIEW_Handler_RejectReview(t *testing.T) {
	h := NewHandler(&fakeReviewService{})
	c, w := makeCtx(http.MethodPost, "/api/v1/ai/review/rev-1/reject", nil, map[string]string{"id": "rev-1"})
	h.RejectReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RejectReview: got %d", w.Code)
	}
}
