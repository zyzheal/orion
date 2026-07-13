package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ci-type/models"
	"orion/platform-svc-go/internal/ci-type/repository"
	"orion/platform-svc-go/internal/ci-type/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all ci-type endpoints under the given group.
// Mirrors /api/v1/ci-types routes from the TS source (11 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/ci-types")

	// --- CI Types ---
	// GET /ci-types - List CI types
	f.GET("", auth.RequirePermission("ci_type", "read"), h.ListTypes)
	// POST /ci-types - Create CI type
	f.POST("", auth.RequirePermission("ci_type", "write"), h.CreateType)
	// GET /ci-types/:id - Get CI type with attributes
	f.GET("/:id", auth.RequirePermission("ci_type", "read"), h.GetType)
	// PUT /ci-types/:id - Update CI type
	f.PUT("/:id", auth.RequirePermission("ci_type", "write"), h.UpdateType)
	// DELETE /ci-types/:id - Delete CI type
	f.DELETE("/:id", auth.RequirePermission("ci_type", "delete"), h.DeleteType)

	// --- Attributes ---
	// GET /ci-types/:id/attributes - Get attributes
	f.GET("/:id/attributes", auth.RequirePermission("ci_type", "read"), h.GetAttributes)
	// PUT /ci-types/:id/attributes - Set attributes (bulk upsert)
	f.PUT("/:id/attributes", auth.RequirePermission("ci_type", "write"), h.SetAttributes)

	// --- Validation ---
	// POST /ci-types/:id/validate - Validate instance data
	f.POST("/:id/validate", auth.RequirePermission("ci_type", "read"), h.ValidateInstance)

	// --- Versions ---
	// POST /ci-types/:id/versions - Create version snapshot
	f.POST("/:id/versions", auth.RequirePermission("ci_type", "write"), h.CreateVersion)
	// GET /ci-types/:id/versions - List versions
	f.GET("/:id/versions", auth.RequirePermission("ci_type", "read"), h.GetVersions)
	// POST /ci-types/:id/versions/:versionId/rollback - Rollback to version
	f.POST("/:id/versions/:versionId/rollback", auth.RequirePermission("ci_type", "write"), h.Rollback)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// ListTypes handler - GET /ci-types
func (h *Handler) ListTypes(c *gin.Context) {
	tenantID := h.getTenantID(c)

	status := c.Query("status")
	search := c.Query("search")
	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")

	filter := &repository.ListFilter{}
	if status != "" {
		filter.Status = &status
	}
	if search != "" {
		filter.Search = &search
	}
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err == nil && limit > 0 {
			filter.Limit = &limit
		}
	}
	if offsetStr != "" {
		offset, err := strconv.Atoi(offsetStr)
		if err == nil && offset >= 0 {
			filter.Offset = &offset
		}
	}

	types, total, err := h.svc.ListTypes(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     types,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

// CreateType handler - POST /ci-types
func (h *Handler) CreateType(c *gin.Context) {
	var req models.CreateCITypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		respondBadRequest(c, "name is required")
		return
	}
	tenantID := h.getTenantID(c)
	t, err := h.svc.CreateType(c.Request.Context(), &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, t)
}

// GetType handler - GET /ci-types/:id
func (h *Handler) GetType(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	schema, err := h.svc.GetTypeWithSchema(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, schema)
}

// UpdateType handler - PUT /ci-types/:id
func (h *Handler) UpdateType(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateCITypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	t, err := h.svc.UpdateType(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

// DeleteType handler - DELETE /ci-types/:id
func (h *Handler) DeleteType(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteType(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "CI type not found")
		return
	}
	respondSuccess(c, gin.H{"deleted": true})
}

// GetAttributes handler - GET /ci-types/:id/attributes
func (h *Handler) GetAttributes(c *gin.Context) {
	ciTypeID := c.Param("id")
	tenantID := h.getTenantID(c)
	attrs, err := h.svc.GetAttributes(c.Request.Context(), ciTypeID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, attrs)
}

// SetAttributes handler - PUT /ci-types/:id/attributes
func (h *Handler) SetAttributes(c *gin.Context) {
	ciTypeID := c.Param("id")
	var req struct {
		Attributes []models.CreateCIAttributeRequest `json:"attributes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Attributes == nil {
		respondBadRequest(c, "attributes must be an array")
		return
	}
	tenantID := h.getTenantID(c)
	attrs, err := h.svc.SetAttributes(c.Request.Context(), ciTypeID, tenantID, req.Attributes)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, attrs)
}

// ValidateInstance handler - POST /ci-types/:id/validate
func (h *Handler) ValidateInstance(c *gin.Context) {
	ciTypeID := c.Param("id")
	var req struct {
		Data map[string]interface{} `json:"data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "data object is required")
		return
	}
	if req.Data == nil {
		respondBadRequest(c, "data object is required")
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ValidateInstance(c.Request.Context(), ciTypeID, tenantID, req.Data)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// CreateVersion handler - POST /ci-types/:id/versions
func (h *Handler) CreateVersion(c *gin.Context) {
	ciTypeID := c.Param("id")
	var req models.CreateCITypeVersionRequest
	_ = c.ShouldBindJSON(&req)
	tenantID := h.getTenantID(c)
	version, err := h.svc.CreateVersion(c.Request.Context(), ciTypeID, tenantID, req.ChangeSummary)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, version)
}

// GetVersions handler - GET /ci-types/:id/versions
func (h *Handler) GetVersions(c *gin.Context) {
	ciTypeID := c.Param("id")
	tenantID := h.getTenantID(c)
	versions, err := h.svc.GetVersions(c.Request.Context(), ciTypeID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, versions)
}

// Rollback handler - POST /ci-types/:id/versions/:versionId/rollback
func (h *Handler) Rollback(c *gin.Context) {
	ciTypeID := c.Param("id")
	versionID := c.Param("versionId")
	tenantID := h.getTenantID(c)
	t, err := h.svc.Rollback(c.Request.Context(), ciTypeID, tenantID, versionID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "CI type or version not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}
