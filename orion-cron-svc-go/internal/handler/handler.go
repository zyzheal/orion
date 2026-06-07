package handler

import (
	"net/http"
	"strconv"

	"orion/cron-svc-go/internal/models"
	"orion/cron-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// ── Cron Jobs ────────────────────────────────────────────
	c := rg.Group("/cron-jobs")
	c.POST("", auth.RequirePermission("cron", "write"), h.Create)
	c.GET("", h.List)
	c.GET("/count", h.Count)
	c.GET("/:id", h.Get)
	c.PUT("/:id", auth.RequirePermission("cron", "write"), h.Update)
	c.DELETE("/:id", auth.RequirePermission("cron", "delete"), h.Delete)
	c.PUT("/:id/enable", auth.RequirePermission("cron", "write"), h.Enable)
	c.PUT("/:id/disable", auth.RequirePermission("cron", "write"), h.Disable)
	c.POST("/:id/execute", auth.RequirePermission("cron", "execute"), h.Execute)
	c.GET("/:id/executions", h.GetExecutionHistory)

	// ── Scheduler Controls ───────────────────────────────────
	rg.POST("/scheduler/start", auth.RequirePermission("cron", "execute"), h.StartScheduler)
	rg.POST("/scheduler/stop", auth.RequirePermission("cron", "execute"), h.StopScheduler)
	rg.GET("/scheduler/running", h.GetRunningJobs)

	// ── OnCall Schedules ─────────────────────────────────────
	o := rg.Group("/oncall-schedules")
	o.POST("", auth.RequirePermission("cron", "write"), h.CreateOnCallSchedule)
	o.GET("", h.ListOnCallSchedules)
	o.GET("/:id", h.GetOnCallSchedule)
	o.DELETE("/:id", auth.RequirePermission("cron", "delete"), h.DeleteOnCallSchedule)
	o.GET("/:id/current", h.GetCurrentOnCall)
	o.POST("/:id/overrides", auth.RequirePermission("cron", "write"), h.CreateOnCallOverride)
}

// ═══════════════════════════════════════════════════════════════
//  CronJob Handlers
// ═══════════════════════════════════════════════════════════════

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	j, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, j)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	j, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, j)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) Enable(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Enable(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "enabled"})
}

func (h *Handler) Disable(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Disable(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "disabled"})
}

func (h *Handler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	exec, err := h.svc.ExecuteJob(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, exec)
}

func (h *Handler) GetExecutionHistory(c *gin.Context) {
	jobID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.GetExecutionHistory(c.Request.Context(), jobID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// ═══════════════════════════════════════════════════════════════
//  Scheduler Control Handlers
// ═══════════════════════════════════════════════════════════════

func (h *Handler) StartScheduler(c *gin.Context) {
	h.svc.Start(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"message": "scheduler started"})
}

func (h *Handler) StopScheduler(c *gin.Context) {
	h.svc.Stop()
	c.JSON(http.StatusOK, gin.H{"message": "scheduler stopped"})
}

func (h *Handler) GetRunningJobs(c *gin.Context) {
	ids := h.svc.GetRunningJobIDs()
	c.JSON(http.StatusOK, gin.H{"running_jobs": ids})
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Schedule Handlers
// ═══════════════════════════════════════════════════════════════

func (h *Handler) CreateOnCallSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateOnCallScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	schedule, err := h.svc.CreateOnCallSchedule(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, schedule)
}

func (h *Handler) ListOnCallSchedules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListOnCallSchedules(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetOnCallSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	schedule, err := h.svc.GetOnCallSchedule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedule)
}

func (h *Handler) DeleteOnCallSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteOnCallSchedule(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetCurrentOnCall(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetCurrentOnCall(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CreateOnCallOverride(c *gin.Context) {
	var req models.CreateOnCallOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	override, err := h.svc.CreateOnCallOverride(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, override)
}
