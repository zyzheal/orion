package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/execution-mode-engine/models"
	"orion/platform-svc-go/internal/execution-mode-engine/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/execution-modes")
	r.GET("", auth.RequirePermission("execution_mode", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("execution_mode", "read"), h.Get)
	r.POST("", auth.RequirePermission("execution_mode", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("execution_mode", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("execution_mode", "delete"), h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(c.Request.Context(), "Handler.List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		errors.WriteError(c, errors.ErrUnauthorized, "tenant_id required", http.StatusUnauthorized)
		return
	}
	list, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *Handler) Get(c *gin.Context) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(c.Request.Context(), "Handler.Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		errors.WriteError(c, errors.ErrUnauthorized, "tenant_id required", http.StatusUnauthorized)
		return
	}
	id := c.Param("id")
	cfg, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	middleware.RespondSuccess(c, cfg)
}

func (h *Handler) Create(c *gin.Context) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(c.Request.Context(), "Handler.Create")
	defer span.End()
	var req models.ExecutionModeConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	req.TenantID = c.GetString("tenant_id")
	if req.TenantID == "" {
		errors.WriteError(c, errors.ErrUnauthorized, "tenant_id required", http.StatusUnauthorized)
		return
	}
	if err := h.svc.Create(c.Request.Context(), &req); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	middleware.RespondCreated(c, req)
}

func (h *Handler) Update(c *gin.Context) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(c.Request.Context(), "Handler.Update")
	defer span.End()
	var req models.ExecutionModeConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	req.ID = c.Param("id")
	if err := h.svc.Update(c.Request.Context(), &req); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "updated"})
}

func (h *Handler) Delete(c *gin.Context) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(c.Request.Context(), "Handler.Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		errors.WriteError(c, errors.ErrUnauthorized, "tenant_id required", http.StatusUnauthorized)
		return
	}
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}
