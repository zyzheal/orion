package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/pipeline-run-history/models"
	"orion/platform-svc-go/internal/pipeline-run-history/repository"
	"orion/platform-svc-go/internal/pipeline-run-history/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockRunHistoryService struct {
	getRunHistoryFn func(ctx context.Context, pipelineID, tenantID, period string, limit int) (*models.RunHistoryResponse, error)
}

func (m *mockRunHistoryService) GetRunHistory(ctx context.Context, pipelineID, tenantID, period string, limit int) (*models.RunHistoryResponse, error) {
	return m.getRunHistoryFn(ctx, pipelineID, tenantID, period, limit)
}

// --- handler constructor override for tests ---

func newRunHistoryHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

// --- helpers ---

func performRunHistoryRequest(h *Handler, pipelineID, period, limit string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	url := "/pipelines/" + pipelineID + "/run-history"
	c.Request = httptest.NewRequest("GET", url, nil)
	c.Params = []gin.Param{{Key: "id", Value: pipelineID}}
	c.Set("tenant_id", "test-tenant")

	q := c.Request.URL.Query()
	if period != "" {
		q.Set("period", period)
	}
	if limit != "" {
		q.Set("limit", limit)
	}
	c.Request.URL.RawQuery = q.Encode()

	h.RunHistory(c)
	return w
}

func TestRunHistory_Success(t *testing.T) {
	now := time.Now()
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{
		getRunHistoryFn: func(_ context.Context, pipelineID, tenantID, period string, limit int) (*models.RunHistoryResponse, error) {
			return &models.RunHistoryResponse{
				Entries: []models.RunHistoryEntry{
					{
						PeriodStart: now,
						PeriodEnd:   now.Add(24 * time.Hour),
						TotalRuns:   10,
						Succeeded:   8,
						Failed:      2,
						Cancelled:   0,
					},
				},
				PipelineID: pipelineID,
				Period:     period,
				TotalCount: 10,
			}, nil
		},
	})

	w := performRunHistoryRequest(h, "pipeline-1", "day", "30")

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

func TestRunHistory_DefaultPeriod(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{
		getRunHistoryFn: func(_ context.Context, pipelineID, tenantID, period string, limit int) (*models.RunHistoryResponse, error) {
			if period != "day" {
				t.Errorf("expected default period 'day', got %s", period)
			}
			return &models.RunHistoryResponse{
				Entries:    []models.RunHistoryEntry{},
				PipelineID: pipelineID,
				Period:     period,
				TotalCount: 0,
			}, nil
		},
	})

	w := performRunHistoryRequest(h, "pipeline-1", "", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRunHistory_DefaultLimit(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{
		getRunHistoryFn: func(_ context.Context, pipelineID, tenantID, period string, limit int) (*models.RunHistoryResponse, error) {
			if limit != 30 {
				t.Errorf("expected default limit 30, got %d", limit)
			}
			return &models.RunHistoryResponse{
				Entries:    []models.RunHistoryEntry{},
				PipelineID: pipelineID,
				Period:     period,
				TotalCount: 0,
			}, nil
		},
	})

	w := performRunHistoryRequest(h, "pipeline-1", "day", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRunHistory_CustomLimit(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{
		getRunHistoryFn: func(_ context.Context, pipelineID, tenantID, period string, limit int) (*models.RunHistoryResponse, error) {
			if limit != 7 {
				t.Errorf("expected limit 7, got %d", limit)
			}
			return &models.RunHistoryResponse{
				Entries:    []models.RunHistoryEntry{},
				PipelineID: pipelineID,
				Period:     period,
				TotalCount: 0,
			}, nil
		},
	})

	w := performRunHistoryRequest(h, "pipeline-1", "week", "7")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRunHistory_InvalidLimitNonNumeric(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{})

	w := performRunHistoryRequest(h, "pipeline-1", "day", "abc")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRunHistory_InvalidLimitTooHigh(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{})

	w := performRunHistoryRequest(h, "pipeline-1", "day", "400")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRunHistory_InvalidLimitTooLow(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{})

	w := performRunHistoryRequest(h, "pipeline-1", "day", "0")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRunHistory_InvalidPeriod(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{
		getRunHistoryFn: func(_ context.Context, _, _, _ string, _ int) (*models.RunHistoryResponse, error) {
			return nil, service.ErrInvalidPeriod
		},
	})

	w := performRunHistoryRequest(h, "pipeline-1", "invalid", "30")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRunHistory_PipelineNotFound(t *testing.T) {
	h := newRunHistoryHandlerWithSvc(&mockRunHistoryService{
		getRunHistoryFn: func(_ context.Context, _, _, _ string, _ int) (*models.RunHistoryResponse, error) {
			// Wrap repository.ErrNotFound so service.IsNotFound returns true.
			return nil, fmt.Errorf("pipeline not found: %w", repository.ErrNotFound)
		},
	})

	w := performRunHistoryRequest(h, "nonexistent", "day", "30")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}