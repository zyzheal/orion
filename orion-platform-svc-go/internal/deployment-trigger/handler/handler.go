package handler

import (
	"net/http"
	"strconv"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/deployment-trigger/models"
	"orion/platform-svc-go/internal/deployment-trigger/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/deployment-trigger")
	g.GET("", auth.RequirePermission("deployment_trigger", "read"), h.List)
	g.POST("", auth.RequirePermission("deployment_trigger", "write"), h.Create)
	g.GET("/:id", auth.RequirePermission("deployment_trigger", "read"), h.Get)
	g.PUT("/:id", auth.RequirePermission("deployment_trigger", "write"), h.Update)
	g.DELETE("/:id", auth.RequirePermission("deployment_trigger", "delete"), h.Delete)
	g.GET("/:id/executions", auth.RequirePermission("deployment_trigger", "read"), h.GetExecutions)
	g.POST("/:id/execute", auth.RequirePermission("deployment_trigger", "write"), h.Execute)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		if err == sentinel.NotFound {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if results == nil {
		results = []models.DeploymentTrigger{}
	}
	middleware.RespondSuccess(c, gin.H{"data": results})
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		if err == sentinel.NotFound {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		if err == sentinel.NotFound {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": "deleted"})
}

func (h *Handler) GetExecutions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecutions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limitStr := c.Query("limit")
	limit := 50
	if limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err == nil && l > 0 {
			limit = l
		}
	}
	results, err := h.svc.GetExecutions(ctx, tenantID, c.Param("id"), limit)
	if err != nil {
		if err == sentinel.NotFound {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if results == nil {
		results = []models.TriggerExecution{}
	}
	middleware.RespondSuccess(c, gin.H{"data": results})
}

func (h *Handler) Execute(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Execute")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Execute(ctx, tenantID, c.Param("id"))
	if err != nil {
		switch err {
		case sentinel.NotFound:
			middleware.RespondNotFound(c, err.Error())
		case service.ErrDisabled:
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		default:
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, result)
}

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
