package handler

import (
	"net/http"
	"strconv"

	"orion/scheduler-svc-go/internal/models"
	"orion/scheduler-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for scheduler and on-call operations.
type Handler struct {
	schedulerSvc *service.SchedulerService
	onCallSvc    *service.OnCallService
	lockSvc      *service.DistributedLockService
}

func NewHandler(schedulerSvc *service.SchedulerService, onCallSvc *service.OnCallService, lockSvc *service.DistributedLockService) *Handler {
	return &Handler{
		schedulerSvc: schedulerSvc,
		onCallSvc:    onCallSvc,
		lockSvc:      lockSvc,
	}
}

// RegisterRoutes registers all scheduler and on-call routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// ── Cron Jobs ─────────────────────────────────────────────────────────
	jobs := rg.Group("/jobs")
	{
		jobs.POST("", auth.RequirePermission("scheduler", "write"), h.CreateJob)
		jobs.GET("", h.ListJobs)
		jobs.GET("/count", h.CountJobs)
		jobs.GET("/:id", h.GetJob)
		jobs.PUT("/:id", auth.RequirePermission("scheduler", "write"), h.UpdateJob)
		jobs.DELETE("/:id", auth.RequirePermission("scheduler", "delete"), h.DeleteJob)
		jobs.POST("/:id/execute", auth.RequirePermission("scheduler", "execute"), h.ExecuteJob)
		jobs.POST("/:id/pause", auth.RequirePermission("scheduler", "execute"), h.PauseJob)
		jobs.POST("/:id/resume", auth.RequirePermission("scheduler", "execute"), h.ResumeJob)
		jobs.POST("/:id/disable", auth.RequirePermission("scheduler", "write"), h.DisableJob)
		jobs.GET("/:id/runs", h.GetJobRuns)
	}
	rg.GET("/jobs/runs/history", h.GetExecutionHistory)

	// ── On-Call Schedules ─────────────────────────────────────────────────
	schedules := rg.Group("/oncall/schedules")
	{
		schedules.POST("", auth.RequirePermission("scheduler", "write"), h.CreateSchedule)
		schedules.GET("", h.ListSchedules)
		schedules.GET("/:id", h.GetSchedule)
		schedules.DELETE("/:id", auth.RequirePermission("scheduler", "delete"), h.DeleteSchedule)
		schedules.GET("/:id/on-call", h.GetCurrentOnCall)
		schedules.GET("/:id/assignments", h.ListAssignments)
		schedules.POST("/:id/overrides", auth.RequirePermission("scheduler", "write"), h.CreateOverride)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Job Handlers
// ═══════════════════════════════════════════════════════════════════════════

func (h *Handler) CreateJob(c *gin.Context) {
	var job models.Job
	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job.TenantID = c.GetString("tenant_id")
	if err := h.schedulerSvc.CreateJob(c.Request.Context(), &job); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, job)
}

func (h *Handler) GetJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	job, err := h.schedulerSvc.GetJobByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

func (h *Handler) ListJobs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	jobs, err := h.schedulerSvc.ListJobs(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": jobs})
}

func (h *Handler) UpdateJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.schedulerSvc.UpdateJob(c.Request.Context(), tenantID, id, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *Handler) DeleteJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.schedulerSvc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ExecuteJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.schedulerSvc.ExecuteJob(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, run)
}

func (h *Handler) PauseJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.schedulerSvc.PauseJob(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "paused"})
}

func (h *Handler) ResumeJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.schedulerSvc.ResumeJob(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "resumed"})
}

func (h *Handler) DisableJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.schedulerSvc.DisableJob(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "disabled"})
}

func (h *Handler) GetJobRuns(c *gin.Context) {
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	runs, err := h.schedulerSvc.GetJobRuns(c.Request.Context(), id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": runs})
}

func (h *Handler) CountJobs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.schedulerSvc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) GetExecutionHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	jobID := c.DefaultQuery("job_id", "")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	runs, err := h.schedulerSvc.GetExecutionHistory(c.Request.Context(), tenantID, jobID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": runs})
}

// ═══════════════════════════════════════════════════════════════════════════
// On-Call Handlers
// ═══════════════════════════════════════════════════════════════════════════

func (h *Handler) CreateSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	schedule, err := h.onCallSvc.CreateSchedule(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, schedule)
}

func (h *Handler) ListSchedules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	schedules, err := h.onCallSvc.ListSchedules(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": schedules})
}

func (h *Handler) GetSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	schedule, err := h.onCallSvc.GetSchedule(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found"})
		return
	}

	c.JSON(http.StatusOK, schedule)
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	deleted, err := h.onCallSvc.DeleteSchedule(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !deleted {
		c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetCurrentOnCall(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	scheduleID := c.Param("id")

	result, err := h.onCallSvc.GetCurrentOnCall(c.Request.Context(), tenantID, scheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) ListAssignments(c *gin.Context) {
	scheduleID := c.Param("id")

	assignments, err := h.onCallSvc.ListAssignments(c.Request.Context(), scheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": assignments})
}

func (h *Handler) CreateOverride(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	scheduleID := c.Param("id")

	var req models.CreateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	override, err := h.onCallSvc.CreateOverride(c.Request.Context(), tenantID, scheduleID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, override)
}
