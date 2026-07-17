package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/data-lineage/models"
	"orion/platform-svc-go/internal/data-lineage/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all data-lineage endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/data-lineage")

	// === Lineage CRUD ===
	f.GET("", auth.RequirePermission("data-lineage", "read"), h.ListLineages)
	f.POST("", auth.RequirePermission("data-lineage", "write"), h.CreateLineage)
	// Single resource endpoints
	f.GET("/lineages/:id", auth.RequirePermission("data-lineage", "read"), h.GetLineage)
	f.PUT("/lineages/:id", auth.RequirePermission("data-lineage", "write"), h.UpdateLineage)
	f.DELETE("/lineages/:id", auth.RequirePermission("data-lineage", "delete"), h.DeleteLineage)

	// === Nodes ===
	f.POST("/lineages/:lineageId/nodes", auth.RequirePermission("data-lineage", "write"), h.CreateNode)
	f.GET("/lineages/:lineageId/nodes", auth.RequirePermission("data-lineage", "read"), h.ListNodes)

	// === Relationships ===
	f.POST("/lineages/:lineageId/relationships", auth.RequirePermission("data-lineage", "write"), h.CreateRelationship)
	// GET relationships handled below

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("data-lineage", "read"), h.GetStats)
}

// ==================== Lineage ====================

func (h *Handler) ListLineages(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListLineages(c.Request.Context(), tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateLineage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateLineageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateLineage(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetLineage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetLineage(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "lineage not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateLineage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateLineageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateLineage(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "lineage not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteLineage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteLineage(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "lineage not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "lineage deleted"})
}

// ==================== Nodes ====================

func (h *Handler) CreateNode(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	lineageID := c.Param("lineageId")
	var req models.CreateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Ensure request has the correct lineage context
	req2 := &models.CreateNodeRequest{Name: req.Name, Type: req.Type, Properties: req.Properties}
	result, err := h.svc.CreateNode(c.Request.Context(), tenantID, lineageID, req2)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "lineage not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) ListNodes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if id := c.Param("lineageId"); id != "" {
		result, err := h.svc.ListNodes(c.Request.Context(), tenantID, id)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		middleware.RespondSuccess(c, result)
		return
	}
	middleware.RespondBadRequest(c, "lineageId is required")
}

// ==================== Relationships ====================

func (h *Handler) CreateRelationship(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	lineageID := c.Param("lineageId")
	var req models.CreateRelationshipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateRelationship(c.Request.Context(), tenantID, lineageID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "lineage not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
