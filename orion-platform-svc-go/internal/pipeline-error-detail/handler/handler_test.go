package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/pipeline-error-detail/models"
	"orion/platform-svc-go/internal/pipeline-error-detail/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockErrorDetailService struct {
	getErrorDetailFn func(ctx context.Context, runID string) (*models.PipelineErrorDetail, error)
}

func (m *mockErrorDetailService) GetErrorDetail(ctx context.Context, runID string) (*models.PipelineErrorDetail, error) {
	return m.getErrorDetailFn(ctx, runID)
}

// --- handler constructor override for tests ---

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

// --- helpers ---

func performErrorDetailRequest(h *Handler, runID string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/pipelines/"+runID+"/error-detail", nil)
	c.Params = []gin.Param{{Key: "runId", Value: runID}}
	h.ErrorDetail(c)
	return w
}

func TestErrorDetail_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockErrorDetailService{
		getErrorDetailFn: func(_ context.Context, _ string) (*models.PipelineErrorDetail, error) {
			return &models.PipelineErrorDetail{
				ErrorType:            models.CategoryCompilationError,
				Severity:             models.SeverityCritical,
				HumanReadableMessage: "代码编译失败",
				SuggestedFix:         []string{"修复代码语法错误"},
				RawError:             "syntax error",
				StageName:            "build",
				Timestamp:            "2026-07-15T10:00:00Z",
				Classification: &models.ErrorClassification{
					Type:          "permanent",
					ShouldRetry:   false,
					RetryStrategy: "skip",
					Confidence:    0.95,
					Reasoning:     "matched classifier pattern: permanent",
				},
			}, nil
		},
	})

	w := performErrorDetailRequest(h, "run-1")

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp errors.ResponseEnvelope
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Success != true {
		t.Error("expected success=true")
	}
}

func TestErrorDetail_InvalidRun(t *testing.T) {
	h := newHandlerWithSvc(&mockErrorDetailService{
		getErrorDetailFn: func(_ context.Context, _ string) (*models.PipelineErrorDetail, error) {
			return nil, service.ErrInvalidRun
		},
	})

	w := performErrorDetailRequest(h, "")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestErrorDetail_RunNotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockErrorDetailService{
		getErrorDetailFn: func(_ context.Context, _ string) (*models.PipelineErrorDetail, error) {
			return nil, service.ErrRunNotFound
		},
	})

	w := performErrorDetailRequest(h, "nonexistent")

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestErrorDetail_NotFailed(t *testing.T) {
	h := newHandlerWithSvc(&mockErrorDetailService{
		getErrorDetailFn: func(_ context.Context, _ string) (*models.PipelineErrorDetail, error) {
			return nil, service.ErrNotFailed
		},
	})

	w := performErrorDetailRequest(h, "run-1")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestErrorDetail_InternalError(t *testing.T) {
	h := newHandlerWithSvc(&mockErrorDetailService{
		getErrorDetailFn: func(_ context.Context, _ string) (*models.PipelineErrorDetail, error) {
			return nil, errInternal
		},
	})

	w := performErrorDetailRequest(h, "run-1")

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// errInternal is an unrecognized error that triggers the default 500 path.
var errInternal = &testError{msg: "unexpected error"}

type testError struct{ msg string }

func (e *testError) Error() string { return e.msg }