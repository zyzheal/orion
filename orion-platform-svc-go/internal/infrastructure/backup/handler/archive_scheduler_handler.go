package handler

import (
	"net/http"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/middleware"
)

// ArchiveSchedulerHandler exposes the scheduler's status and per-plan controls.
// It mirrors the shape of ArchiveHandler but owns a thin adapter around
// ArchiveScheduler so the scheduler itself stays pure (no HTTP knowledge).
type ArchiveSchedulerHandler struct {
	scheduler *service.ArchiveScheduler
	log       *zap.Logger
	mu        sync.Mutex
	// lastRun caches the latest completed run's result for /status.
	lastRun *SchedulerRunSummary
}

// SchedulerRunSummary captures the outcome of the most recent cron-triggered
// archive run. It is the payload of GET /backup/archive/scheduler/status.
type SchedulerRunSummary struct {
	PlanID     string    `json:"planId"`
	TenantID   string    `json:"tenantId"`
	StartedAt  time.Time `json:"startedAt"`
	Archived   int       `json:"archived"`
	Skipped    int       `json:"skipped"`
	Failed     int       `json:"failed"`
	TotalBytes int64     `json:"totalBytes"`
}

// NewArchiveSchedulerHandler returns an ArchiveSchedulerHandler. Scheduler
// may be nil — the handlers degrade to 503 when it is.
func NewArchiveSchedulerHandler(scheduler *service.ArchiveScheduler, log *zap.Logger) *ArchiveSchedulerHandler {
	return &ArchiveSchedulerHandler{scheduler: scheduler, log: log}
}

// RegisterRoutes mounts /backup/archive/scheduler routes under the given group.
func (h *ArchiveSchedulerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	bg := rg.Group("/backup")
	bg.GET("/archive/scheduler/status", auth.RequirePermission("backup", "read"), h.Status)
	bg.POST("/archive/scheduler/plans", auth.RequirePermission("backup", "write"), h.RegisterPlan)
	bg.DELETE("/archive/scheduler/plans/:planId", auth.RequirePermission("backup", "delete"), h.UnregisterPlan)
}

// Status returns the scheduler's currently registered plan keys and, when
// available, the most recent completed run summary.
func (h *ArchiveSchedulerHandler) Status(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArchiveSchedulerStatus")
	defer span.End()
	if h.scheduler == nil {
		middleware.RespondServiceUnavailable(c, "archive scheduler not configured")
		return
	}
	_ = ctx
	middleware.RespondSuccess(c, gin.H{
		"plans":   h.scheduler.List(),
		"lastRun": h.lastRun,
	})
}

// RegisterPlanRequest is the payload for adding/updating a scheduled plan.
type RegisterPlanRequest struct {
	TenantID      string             `json:"tenantId"`
	PlanID        string             `json:"planId" binding:"required"`
	SourceDir     string             `json:"sourceDir" binding:"required"`
	ArchiveType   models.ArchiveType `json:"archiveType" binding:"required"`
	Schedule      string             `json:"schedule" binding:"required"`
	EncryptionKey string             `json:"encryptionKey,omitempty"`
	Enabled       bool               `json:"enabled"`
}

// RegisterPlan upserts a scheduled archive plan.
func (h *ArchiveSchedulerHandler) RegisterPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArchiveSchedulerRegisterPlan")
	defer span.End()
	if h.scheduler == nil {
		middleware.RespondServiceUnavailable(c, "archive scheduler not configured")
		return
	}
	var req RegisterPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if !req.Enabled {
		req.Enabled = true
	}
	spec := &service.ArchivePlanSpec{
		TenantID:    req.TenantID,
		PlanID:      req.PlanID,
		SourceDir:   req.SourceDir,
		ArchiveType: req.ArchiveType,
		Schedule:    req.Schedule,
		Enabled:     req.Enabled,
	}
	if req.EncryptionKey != "" {
		spec.EncryptionKey = []byte(req.EncryptionKey)
	}
	h.scheduler.AddPlan(spec)
	middleware.RespondSuccess(c, gin.H{"registered": true, "plan": spec})
	_ = ctx
}

// UnregisterPlan removes a scheduled plan by ID.
func (h *ArchiveSchedulerHandler) UnregisterPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArchiveSchedulerUnregisterPlan")
	defer span.End()
	if h.scheduler == nil {
		middleware.RespondServiceUnavailable(c, "archive scheduler not configured")
		return
	}
	tenantID := c.DefaultQuery("tenant_id", c.GetString("tenant_id"))
	h.scheduler.RemovePlan(tenantID, c.Param("planId"))
	middleware.RespondSuccess(c, gin.H{"removed": true})
	_ = ctx
}

// RecordRun lets the Archiver's cron callback record its run outcome in the
// handler so GET /status can surface it. Wired from ArchiveScheduler via a
// callback (see wiring.go).
func (h *ArchiveSchedulerHandler) RecordRun(s *SchedulerRunSummary) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lastRun = s
}
