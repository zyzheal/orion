package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/infrastructure/backup/service"
)

func init() { gin.SetMode(gin.TestMode) }

func newTestSchedulerHandler() (*gin.Engine, *ArchiveSchedulerHandler) {
	r := gin.New()
	scheduler := service.NewArchiveScheduler(nil, nil)
	h := NewArchiveSchedulerHandler(scheduler, nil)
	// Bypass auth for unit tests — mount directly on a fresh group.
	g := r.Group("/api/v1")
	bg := g.Group("/backup")
	bg.GET("/archive/scheduler/status", h.Status)
	bg.POST("/archive/scheduler/plans", h.RegisterPlan)
	bg.DELETE("/archive/scheduler/plans/:planId", h.UnregisterPlan)
	return r, h
}

func TestSchedulerStatus_NotConfigured(t *testing.T) {
	r := gin.New()
	h := NewArchiveSchedulerHandler(nil, nil)
	g := r.Group("/api/v1/backup")
	g.GET("/archive/scheduler/status", h.Status)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/backup/archive/scheduler/status", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

func TestSchedulerRegisterPlan(t *testing.T) {
	r, _ := newTestSchedulerHandler()
	body := `{"planId":"p1","sourceDir":"/tmp/wal","archiveType":"wal","schedule":"* * * * * *","enabled":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/backup/archive/scheduler/plans", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["registered"] != true {
		t.Fatalf("expected registered=true, got %v", resp)
	}
}

func TestSchedulerRegisterPlan_BadBody(t *testing.T) {
	r, _ := newTestSchedulerHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/backup/archive/scheduler/plans", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestSchedulerUnregisterPlan(t *testing.T) {
	r, _ := newTestSchedulerHandler()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/backup/archive/scheduler/plans/p1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestSchedulerRecordRun(t *testing.T) {
	_, h := newTestSchedulerHandler()
	h.RecordRun(&SchedulerRunSummary{
		PlanID: "p1", TenantID: "t1",
		StartedAt: time.Now(), Archived: 3, Skipped: 1, Failed: 0, TotalBytes: 1024,
	})
	if h.lastRun == nil || h.lastRun.Archived != 3 {
		t.Fatalf("expected lastRun with 3 archived, got %v", h.lastRun)
	}
}
