// Package handler provides HTTP handlers for auto-exec,
// delegating all business logic to the service layer.
//
// ARCHITECTURE (Clean Architecture):
//
//	Handler (thin, gin) → Service → Engine + Repository
//
// The handler is responsible ONLY for: HTTP binding, response formatting,
// and routing. All orchestration (tenant checks, validation, coordination)
// lives in the service layer.
package handler

import (
	stderrors "errors"
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"orion/platform-svc-go/internal/auto-exec/engine"
	"orion/platform-svc-go/internal/auto-exec/models"
	"orion/platform-svc-go/internal/auto-exec/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts auto-exec on /auto-exec, a namespace no other module
// registers.
//
// The module used to expose only three routes, and it put them straight on
// /tasks and /plugins. That is the root cause of the seven dead handlers below:
// /api/v1/tasks is already owned by ai-intelligence (POST/GET/GET:id/DELETE:id/
// GET count) and /api/v1/plugins by internal/plugin (POST/GET/GET:id/
// DELETE:id/PATCH:id/GET count plus actions), so the remaining (method, path)
// pairs had nowhere to go — Gin panics on a duplicate registration, and the
// three that did fit sat next to a foreign domain's collection routes under a
// path that was not the module's. Three other handlers in this codebase hit the
// same wall and resolved it by deleting the route rather than moving the
// namespace, which is why CreateTask and friends had no caller at all: nothing
// could address them.
//
// Every handler method in this file now has a route.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	tracer := "orion-auto-exec"
	ae := rg.Group("/auto-exec")

	tasks := ae.Group("/tasks")
	tasks.POST("", auth.RequirePermission("auto-exec", "write"),
		withSpan(tracer, "CreateTask", h.CreateTask))
	tasks.GET("", auth.RequirePermission("auto-exec", "read"),
		withSpan(tracer, "ListTasks", h.ListTasks))
	tasks.GET("/:id", auth.RequirePermission("auto-exec", "read"),
		withSpan(tracer, "GetTask", h.GetTask))
	tasks.DELETE("/:id", auth.RequirePermission("auto-exec", "delete"),
		withSpan(tracer, "DeleteTask", h.DeleteTask))
	tasks.POST("/:id/run", auth.RequirePermission("auto-exec", "execute"),
		withSpan(tracer, "RunTask", h.RunTask))
	tasks.GET("/:id/history", auth.RequirePermission("auto-exec", "read"),
		withSpan(tracer, "GetHistory", h.GetHistory))

	plugins := ae.Group("/plugins")
	plugins.POST("", auth.RequirePermission("auto-exec", "write"),
		withSpan(tracer, "RegisterPlugin", h.RegisterPlugin))
	plugins.GET("", auth.RequirePermission("auto-exec", "read"),
		withSpan(tracer, "ListPlugins", h.ListPlugins))
	plugins.GET("/:id", auth.RequirePermission("auto-exec", "read"),
		withSpan(tracer, "GetPlugin", h.GetPlugin))
	plugins.PUT("/:id", auth.RequirePermission("auto-exec", "write"),
		withSpan(tracer, "UpdatePlugin", h.UpdatePlugin))
}

func withSpan(tracer, name string, fn func(*gin.Context)) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), "auto-exec."+name)
		defer span.End()
		fn(c)
	}
}

func tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

func bindJSON(c *gin.Context, v any) error {
	return c.ShouldBindJSON(v)
}

func fail(c *gin.Context, err error) {
	errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
}

// ---- Tasks ----

func (h *Handler) CreateTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecCreateTask")
	defer span.End()
	var req models.CreateTaskRequest
	if err := bindJSON(c, &req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	task, err := h.svc.CreateTask(ctx, tenantID(c), req)
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteCreated(c, task)
}

func (h *Handler) GetTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecGetTask")
	defer span.End()
	task, err := h.svc.GetTask(ctx, tenantID(c), c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, task)
}

func (h *Handler) ListTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecListTasks")
	defer span.End()
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.ListTasks(ctx, tenantID(c), status, limit, offset)
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) DeleteTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecDeleteTask")
	defer span.End()
	if err := h.svc.DeleteTask(ctx, tenantID(c), c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) RunTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecRunTask")
	defer span.End()
	taskID := c.Param("id")
	var req models.RunTaskRequest
	// A malformed body used to be ignored (the error was discarded), which ran
	// the task with no overrides and reported 200.
	if err := bindJSON(c, &req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	task, err := h.svc.ExecuteTask(ctx, tenantID(c), taskID, &req)
	if err != nil {
		if stderrors.Is(err, engine.ErrTaskAlreadyRunning) {
			errors.WriteError(c, errors.ErrConflict, "task is already running", 409)
			return
		}
		if stderrors.Is(err, engine.ErrPluginNotRegistered) {
			errors.WriteError(c, errors.ErrNotFound, "plugin not registered", 404)
			return
		}
		if stderrors.Is(err, engine.ErrValidationFailed) {
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
			return
		}
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, task)
}

func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecGetHistory")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.GetHistory(ctx, tenantID(c), c.Param("id"), limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, resp)
}

// ---- Plugins ----

func (h *Handler) RegisterPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecRegisterPlugin")
	defer span.End()
	var req models.RegisterPluginRequest
	if err := bindJSON(c, &req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	plugin, err := h.svc.RegisterPlugin(ctx, tenantID(c), req)
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteCreated(c, plugin)
}

func (h *Handler) ListPlugins(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecListPlugins")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.ListPlugins(ctx, tenantID(c), c.Query("category"), limit, offset)
	if err != nil {
		fail(c, err)
		return
	}
	enginePlugins := h.svc.ListEnginePlugins()
	errors.WriteSuccess(c, gin.H{
		"registered": enginePlugins,
		"list":       resp,
	})
}

func (h *Handler) GetPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecGetPlugin")
	defer span.End()
	plugin, err := h.svc.GetPlugin(ctx, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, plugin)
}

func (h *Handler) UpdatePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoExecUpdatePlugin")
	defer span.End()
	var req models.RegisterPluginRequest
	if err := bindJSON(c, &req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	fields := make(map[string]any)
	if req.Category != "" {
		fields["category"] = req.Category
	}
	if req.Description != "" {
		fields["description"] = req.Description
	}
	if req.Enabled != nil {
		fields["enabled"] = *req.Enabled
	}
	plugin, err := h.svc.UpdatePlugin(ctx, tenantID(c), c.Param("id"), fields)
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, plugin)
}
