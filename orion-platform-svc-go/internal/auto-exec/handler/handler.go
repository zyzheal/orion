package handler

import (
	"errors"
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/auto-exec/engine"
	"orion/platform-svc-go/internal/auto-exec/models"
	"orion/platform-svc-go/internal/auto-exec/repository"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	eng  *engine.AutoExecEngine
	repo *repository.Repository
}

func NewHandler(eng *engine.AutoExecEngine, repo *repository.Repository) *Handler {
	return &Handler{eng: eng, repo: repo}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	tasks := rg.Group("/tasks")
	tasks.POST("", auth.RequirePermission("auto-exec", "write"), h.CreateTask)
	tasks.GET("", auth.RequirePermission("auto-exec", "read"), h.ListTasks)
	tasks.GET("/:id", auth.RequirePermission("auto-exec", "read"), h.GetTask)
	tasks.DELETE("/:id", auth.RequirePermission("auto-exec", "delete"), h.DeleteTask)
	tasks.POST("/:id/run", auth.RequirePermission("auto-exec", "execute"), h.RunTask)
	tasks.GET("/:id/history", auth.RequirePermission("auto-exec", "read"), h.GetHistory)

	plugins := rg.Group("/plugins")
	plugins.POST("", auth.RequirePermission("auto-exec", "admin"), h.RegisterPlugin)
	plugins.GET("", auth.RequirePermission("auto-exec", "read"), h.ListPlugins)
	plugins.GET("/:name", auth.RequirePermission("auto-exec", "read"), h.GetPlugin)
	plugins.PUT("/:name", auth.RequirePermission("auto-exec", "write"), h.UpdatePlugin)
}

func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

func (h *Handler) CreateTask(c *gin.Context) {
	var req models.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	task, err := h.eng.CreateTask(c.Request.Context(), h.tenantID(c), req.Name, req.Plugin, req.PluginParams)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, task)
}

func (h *Handler) GetTask(c *gin.Context) {
	task, err := h.repo.GetTask(c.Request.Context(), h.tenantID(c), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) ListTasks(c *gin.Context) {
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListTasks(c.Request.Context(), h.tenantID(c), status, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) DeleteTask(c *gin.Context) {
	if err := h.repo.DeleteTask(c.Request.Context(), h.tenantID(c), c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) RunTask(c *gin.Context) {
	taskID := c.Param("id")
	// Optional runtime param override (not persisted here; run-time only)
	var req models.RunTaskRequest
	_ = c.ShouldBindJSON(&req)

	task, err := h.eng.ExecuteTask(c.Request.Context(), taskID)
	if err != nil {
		if errors.Is(err, engine.ErrTaskAlreadyRunning) {
			respondConflict(c, "task is already running")
			return
		}
		if errors.Is(err, engine.ErrPluginNotRegistered) {
			respondNotFound(c, "plugin not registered")
			return
		}
		if errors.Is(err, engine.ErrValidationFailed) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) GetHistory(c *gin.Context) {
	taskID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	// Verify task belongs to tenant
	if _, terr := h.repo.GetTask(c.Request.Context(), h.tenantID(c), taskID); terr != nil {
		respondNotFound(c, terr.Error())
		return
	}
	resp, err := h.repo.ListHistory(c.Request.Context(), taskID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

func (h *Handler) RegisterPlugin(c *gin.Context) {
	var req models.RegisterPluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plugin, err := h.repo.CreatePlugin(c.Request.Context(), h.tenantID(c), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, plugin)
}

func (h *Handler) ListPlugins(c *gin.Context) {
	categories := c.Query("category")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListPlugins(c.Request.Context(), h.tenantID(c), categories, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	// Also include engine-registered plugins
	enginePlugins := h.eng.ListPlugins()
	respondSuccess(c, gin.H{
		"registered": enginePlugins,
		"list":       resp,
	})
}

func (h *Handler) GetPlugin(c *gin.Context) {
	plugin, err := h.repo.GetPlugin(c.Request.Context(), c.Param("name"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, plugin)
}

func (h *Handler) UpdatePlugin(c *gin.Context) {
	var req models.RegisterPluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	fields := make(map[string]interface{})
	if req.Category != "" {
		fields["category"] = req.Category
	}
	if req.Description != "" {
		fields["description"] = req.Description
	}
	if req.Enabled != nil {
		fields["enabled"] = *req.Enabled
	}
	plugin, err := h.repo.UpdatePlugin(c.Request.Context(), h.tenantID(c), c.Param("name"), fields)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, plugin)
}
