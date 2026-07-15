package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/service"

	"github.com/gin-gonic/gin"
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
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(c.Request.Context(), id, tenantID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, gin.H{"deleted": true})
}

// ==================== Change Request Handlers ====================

func (h *Handler) ApproveChangeRequest(c *gin.Context) {
	var req models.ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.ApproveChangeRequest(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, cr)
}

func (h *Handler) ExecuteChangeRequest(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.ExecuteChangeRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, cr)
}

func (h *Handler) RollbackChangeRequest(c *gin.Context) {
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.RollbackChangeRequest(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, cr)
}

func (h *Handler) GetChangeHistory(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entries, err := h.svc.GetChangeHistory(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entries)
}

// ==================== Drift Handlers ====================

func (h *Handler) DriftDetect(c *gin.Context) {
	var req models.DriftDetectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.DriftDetect(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) RemediateDrift(c *gin.Context) {
	var req models.RemediateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	dr, err := h.svc.RemediateDrift(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, dr)
}
