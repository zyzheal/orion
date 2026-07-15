package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/oci-registry/models"
	"orion/platform-svc-go/internal/oci-registry/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/oci-registry")
	r.GET("", auth.RequirePermission("oci_registry", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("oci_registry", "read"), h.Get)
	r.POST("", auth.RequirePermission("oci_registry", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("oci_registry", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("oci_registry", "delete"), h.Delete)
	// Business endpoints
	r.PATCH("/:registryId/enable", auth.RequirePermission("oci_registry", "write"), h.ToggleRegistry)
	r.GET("/repositories/:registryId/:name/tags", auth.RequirePermission("oci_registry", "read"), h.ListTags)
	r.DELETE("/images/:registryId/:name/:digest", auth.RequirePermission("oci_registry", "delete"), h.DeleteImage)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	item, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}
	c.JSON(200, gin.H{"data": item})
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateOciRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"data": item})
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateOciRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": item})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"message": "deleted"})
}

// ToggleRegistry enables or disables a registry.
// PATCH /oci-registry/:registryId/enable
func (h *Handler) ToggleRegistry(c *gin.Context) {
	registryID := c.Param("registryId")
	var req models.ToggleRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.ToggleRegistry(c.Request.Context(), tenantID, registryID, &req)
	if err != nil {
		if err.Error() == "oci-registry not found" {
			c.JSON(404, gin.H{"error": "registry not found"})
			return
		}
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}

// ListTags lists image tags for a repository in a registry.
// GET /oci-registry/repositories/:registryId/:name/tags
func (h *Handler) ListTags(c *gin.Context) {
	registryID := c.Param("registryId")
	name := c.Param("name")
	var q models.TagsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.ListTags(c.Request.Context(), tenantID, registryID, name, &q)
	if err != nil {
		if err.Error() == "oci-registry not found" {
			c.JSON(404, gin.H{"error": "registry not found"})
			return
		}
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}

// DeleteImage deletes an image by digest from a registry.
// DELETE /oci-registry/images/:registryId/:name/:digest
func (h *Handler) DeleteImage(c *gin.Context) {
	registryID := c.Param("registryId")
	name := c.Param("name")
	digest := c.Param("digest")
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteImage(c.Request.Context(), tenantID, registryID, name, digest); err != nil {
		if err.Error() == "oci-registry not found" {
			c.JSON(404, gin.H{"error": "registry not found"})
			return
		}
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"message": "image deleted"})
}
