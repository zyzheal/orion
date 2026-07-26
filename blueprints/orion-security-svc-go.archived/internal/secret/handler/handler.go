package handler

import (
	"strconv"

	"orion/security-svc-go/internal/secret/models"
	"orion/security-svc-go/internal/secret/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for secret operations.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers secret routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/secrets")
	{
		s.POST("", auth.RequirePermission("secrets", "write"), h.Create)
		s.GET("", h.List)
		s.GET("/:id", h.Get)
		s.PUT("/:id", auth.RequirePermission("secrets", "write"), h.Update)
		s.DELETE("/:id", auth.RequirePermission("secrets", "delete"), h.Delete)
		s.POST("/resolve", auth.RequirePermission("secrets", "execute"), h.Resolve)
		s.GET("/:id/references", h.GetReferences)
		s.GET("/count", h.Count)
	}
}

// Create creates a new secret.
// POST /secrets
func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if req.Name == "" || req.Value == "" {
		respondBadRequest(c, "name and value are required")
		return
	}

	s, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		if err == service.ErrInvalidName || err == service.ErrNameTooLong {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, toResponse(s, false))
}

// List returns secrets for a tenant (values masked).
// GET /secrets
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	scope := models.SecretScope(c.Query("scope"))

	if page <= 0 {
		page = 1
	}
	if ps <= 0 || ps > 100 {
		ps = 20
	}
	offset := (page - 1) * ps

	items, err := h.svc.List(c.Request.Context(), tenantID, offset, ps, scope)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	// Mask values in list response
	result := make([]gin.H, len(items))
	for i, item := range items {
		result[i] = toMap(&item, false)
	}

	respondSuccess(c, result)
}

// Get returns a secret by ID (value masked).
// GET /secrets/:id
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	s, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "secret not found")
		return
	}

	respondSuccess(c, toResponse(s, false))
}

// Update updates a secret's value and/or description.
// PUT /secrets/:id
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if req.Value == nil && req.Description == nil {
		respondBadRequest(c, "value or description is required")
		return
	}

	s, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if err == service.ErrSecretNotFound {
			respondNotFound(c, "secret not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, toResponse(s, false))
}

// Delete removes a secret by ID.
// DELETE /secrets/:id
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, "secret not found")
		return
	}

	respondSuccess(c, map[string]any{"message": "deleted"})
}

// Resolve resolves ${secrets.XXX} references in the provided parameters.
// POST /secrets/resolve
func (h *Handler) Resolve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.ResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if len(req.Parameters) == 0 {
		respondBadRequest(c, "parameters is required")
		return
	}

	result, err := h.svc.ResolveSecrets(c.Request.Context(), tenantID, req.Parameters)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, result)
}

// GetReferences returns information about where a secret is referenced.
// GET /secrets/:id/references
func (h *Handler) GetReferences(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	s, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "secret not found")
		return
	}

	refPattern := "${secrets." + s.Name + "}"
	respondSuccess(c, gin.H{
			"secretName":      s.Name,
			"referencePattern": refPattern,
			"pipelines":       []string{},
			"hint":            "search for \"" + refPattern + "\" in Pipeline YAML",
		},)
}

// Count returns the total number of secrets for a tenant.
// GET /secrets/count
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, map[string]any{"count": count})
}

// ==================== Response Helpers ====================

// toResponse converts a Secret to a response map. Value is masked unless includeValue is true.
func toResponse(s *models.Secret, includeValue bool) gin.H {
	return toMap(s, includeValue)
}

func toMap(s *models.Secret, includeValue bool) gin.H {
	h := gin.H{
		"id":          s.ID,
		"name":        s.Name,
		"scope":       s.Scope,
		"created_at":  s.CreatedAt,
		"updated_at":  s.UpdatedAt,
		"version":     s.Version,
		"environment": s.Env,
	}
	if s.Description != nil {
		h["description"] = *s.Description
	}
	if s.CreatedBy != nil {
		h["created_by"] = *s.CreatedBy
	}
	if includeValue {
		h["value"] = s.Value
	} else {
		h["value"] = "***"
	}
	return h
}
