package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cron/models"
	"orion/platform-svc-go/internal/cron/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all 14 cron endpoints onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	jobs := rg.Group("/cron/jobs")
	jobs.POST("", auth.RequirePermission("cron", "write"), h.Create)
	jobs.GET("", auth.RequirePermission("cron", "read"), h.List)
	jobs.GET("/:id", auth.RequirePermission("cron", "read"), h.Get)
	jobs.PUT("/:id", auth.RequirePermission("cron", "write"), h.Update)
	jobs.DELETE("/:id", auth.RequirePermission("cron", "delete"), h.Delete)
	jobs.POST("/:id/enable", auth.RequirePermission("cron", "write"), h.EnableJob)
	jobs.POST("/:id/disable", auth.RequirePermission("cron", "write"), h.DisableJob)
	jobs.POST("/:id/execute", auth.RequirePermission("cron", "write"), h.ExecuteJob)

	rg.GET("/cron/executions", auth.RequirePermission("cron", "read"), h.ListExecutions)
	rg.GET("/cron/executions/:executionId", auth.RequirePermission("cron", "read"), h.GetExecution)
	rg.GET("/cron/running", auth.RequirePermission("cron", "read"), h.RunningJobs)
	rg.GET("/cron/status", auth.RequirePermission("cron", "read"), h.Status)
	rg.POST("/cron/start", auth.RequirePermission("cron", "write"), h.StartScheduler)
	rg.POST("/cron/stop", auth.RequirePermission("cron", "write"), h.StopScheduler)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	off, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(c.Request.Context(), tenantID, limit, off)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Schedule != nil {
		updates["schedule"] = *req.Schedule
	}
	if req.Task != nil {
		updates["task"] = *req.Task
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
		if *req.Enabled {
			updates["status"] = "active"
		} else {
			updates["status"] = "disabled"
		}
	}
	if len(updates) == 0 {
		middleware.RespondBadRequest(c, "no fields to update")
		return
	}
	m, err := h.svc.UpdatePartial(c.Request.Context(), tenantID, id, updates)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) EnableJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.EnableJob(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "cron job enabled"})
}

func (h *Handler) DisableJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DisableJob(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "cron job disabled"})
}

func (h *Handler) ExecuteJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	execution, err := h.svc.ExecuteJob(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, execution)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	jobID := c.Query("jobId")
	history, err := h.svc.GetExecutionHistory(c.Request.Context(), tenantID, jobID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

func (h *Handler) GetExecution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	executionID := c.Param("executionId")
	evt, err := h.svc.GetExecutionByID(c.Request.Context(), tenantID, executionID)
	if err != nil {
		middleware.RespondNotFound(c, "execution not found")
		return
	}
	middleware.RespondSuccess(c, evt)
}

func (h *Handler) RunningJobs(c *gin.Context) {
	running := h.svc.GetRunningJobs()
	middleware.RespondSuccess(c, running)
}

func (h *Handler) Status(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetStatus(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

func (h *Handler) StartScheduler(c *gin.Context) {
	h.svc.Start()
	middleware.RespondSuccess(c, gin.H{"message": "cron scheduler started"})
}

func (h *Handler) StopScheduler(c *gin.Context) {
	h.svc.Stop()
	middleware.RespondSuccess(c, gin.H{"message": "cron scheduler stopped"})
}
