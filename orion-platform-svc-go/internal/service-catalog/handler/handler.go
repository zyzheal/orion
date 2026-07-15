package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/service-catalog/models"
	"orion/platform-svc-go/internal/service-catalog/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/service-catalog")
	r.GET("", auth.RequirePermission("service_catalog", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("service_catalog", "read"), h.Get)
	r.POST("", auth.RequirePermission("service_catalog", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("service_catalog", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("service_catalog", "delete"), h.Delete)

	// Request lifecycle endpoints
	r.POST("/requests/:id/status", auth.RequirePermission("service_catalog", "write"), h.UpdateRequestStatus)
	r.GET("/requests/:id/timeline", auth.RequirePermission("service_catalog", "read"), h.GetRequestTimeline)
	r.GET("/sla-breaches", auth.RequirePermission("service_catalog", "read"), h.GetSLABreaches)
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
	var req models.CreateServiceCatalogRequest
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
	var req models.UpdateServiceCatalogRequest
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

func (h *Handler) UpdateRequestStatus(c *gin.Context) {
	id := c.Param("id")
	var req models.StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.UpdateRequestStatus(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}

func (h *Handler) GetRequestTimeline(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetRequestTimeline(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}

func (h *Handler) GetSLABreaches(c *gin.Context) {
	var q models.SLABreachesQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetSLABreaches(c.Request.Context(), tenantID, &q)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}
