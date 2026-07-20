package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/config-mgmt")
	f.GET("", auth.RequirePermission("config_mgmt_enhanced", "read"), h.List)
	f.POST("", auth.RequirePermission("config_mgmt_enhanced", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("config_mgmt_enhanced", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("config_mgmt_enhanced", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("config_mgmt_enhanced", "delete"), h.Delete)

	// Change request business endpoints
	crg := f.Group("/change-requests")
	crg.POST("/:id/approve", auth.RequirePermission("config_mgmt_enhanced", "write"), h.ApproveChangeRequest)
	crg.POST("/:id/execute", auth.RequirePermission("config_mgmt_enhanced", "write"), h.ExecuteChangeRequest)
	crg.POST("/:id/rollback", auth.RequirePermission("config_mgmt_enhanced", "delete"), h.RollbackChangeRequest)
	crg.GET("/:id/history", auth.RequirePermission("config_mgmt_enhanced", "read"), h.GetChangeHistory)

	// Drift detection endpoints
	f.POST("/drift-detect", auth.RequirePermission("config_mgmt_enhanced", "read"), h.DriftDetect)
	f.POST("/drift/:id/remediate", auth.RequirePermission("config_mgmt_enhanced", "write"), h.RemediateDrift)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(ctx, id, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(ctx, id, tenantID, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// ==================== Change Request Handlers ====================

func (h *Handler) ApproveChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveChangeRequest")
	defer span.End()
	var req models.ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.ApproveChangeRequest(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) ExecuteChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteChangeRequest")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.ExecuteChangeRequest(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) RollbackChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackChangeRequest")
	defer span.End()
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.RollbackChangeRequest(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) GetChangeHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeHistory")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entries, err := h.svc.GetChangeHistory(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entries)
}

// ==================== Drift Handlers ====================

func (h *Handler) DriftDetect(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DriftDetect")
	defer span.End()
	var req models.DriftDetectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.DriftDetect(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) RemediateDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemediateDrift")
	defer span.End()
	var req models.RemediateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	dr, err := h.svc.RemediateDrift(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dr)
}
