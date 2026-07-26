package handler

import (
	"errors"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/otel"

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
	tracer := "orion-auto-exec"
	tasks := rg.Group("/tasks")
	tasks.POST("", auth.RequirePermission("auto-exec", "write"), h.CreateTask(tracer))
	tasks.GET("", auth.RequirePermission("auto-exec", "read"), h.ListTasks(tracer))
	tasks.GET("/:id", auth.RequirePermission("auto-exec", "read"), h.GetTask(tracer))
	tasks.DELETE("/:id", auth.RequirePermission("auto-exec", "delete"), h.DeleteTask(tracer))
	tasks.POST("/:id/run", auth.RequirePermission("auto-exec", "execute"), h.RunTask(tracer))
	tasks.GET("/:id/history", auth.RequirePermission("auto-exec", "read"), h.GetHistory(tracer))

	plugins := rg.Group("/plugins")
	plugins.POST("", auth.RequirePermission("auto-exec", "admin"), h.RegisterPlugin(tracer))
	plugins.GET("", auth.RequirePermission("auto-exec", "read"), h.ListPlugins(tracer))
	plugins.GET("/:name", auth.RequirePermission("auto-exec", "read"), h.GetPlugin(tracer))
	plugins.PUT("/:name", auth.RequirePermission("auto-exec", "write"), h.UpdatePlugin(tracer))
}

func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

func (h *Handler) CreateTask(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.CreateTask")
		defer span.End()
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
}

func (h *Handler) GetTask(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.GetTask")
		defer span.End()
		task, err := h.repo.GetTask(c.Request.Context(), h.tenantID(c), c.Param("id"))
		if err != nil {
			respondNotFound(c, err.Error())
			return
		}
		respondSuccess(c, task)
	}
}

func (h *Handler) ListTasks(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.ListTasks")
		defer span.End()
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
}

func (h *Handler) DeleteTask(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.DeleteTask")
		defer span.End()
		if err := h.repo.DeleteTask(c.Request.Context(), h.tenantID(c), c.Param("id")); err != nil {
			respondNotFound(c, err.Error())
			return
		}
		respondSuccess(c, gin.H{"message": "deleted"})
	}
}

func (h *Handler) RunTask(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.RunTask")
		defer span.End()
		taskID := c.Param("id")
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
}

func (h *Handler) GetHistory(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.GetHistory")
		defer span.End()
		taskID := c.Param("id")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
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
}

func (h *Handler) RegisterPlugin(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.RegisterPlugin")
		defer span.End()
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
}

func (h *Handler) ListPlugins(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.ListPlugins")
		defer span.End()
		categories := c.Query("category")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
		resp, err := h.repo.ListPlugins(c.Request.Context(), h.tenantID(c), categories, limit, offset)
		if err != nil {
			respondInternalError(c, err.Error())
			return
		}
		enginePlugins := h.eng.ListPlugins()
		respondSuccess(c, gin.H{
			"registered": enginePlugins,
			"list":       resp,
		})
	}
}

func (h *Handler) GetPlugin(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.GetPlugin")
		defer span.End()
		plugin, err := h.repo.GetPlugin(c.Request.Context(), c.Param("name"))
		if err != nil {
			respondNotFound(c, err.Error())
			return
		}
		respondSuccess(c, plugin)
	}
}

func (h *Handler) UpdatePlugin(tracer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec.UpdatePlugin")
		defer span.End()
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
}
