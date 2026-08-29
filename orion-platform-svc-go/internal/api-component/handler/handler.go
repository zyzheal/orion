package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/api-component/handler/models"
	"orion/platform-svc-go/internal/api-component/service"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/api-components")
	g.POST("", auth.RequirePermission("api", "write"), h.RegisterComponent)
	g.DELETE("/:name", auth.RequirePermission("api", "delete"), h.UnregisterComponent)
	g.GET("/:name", auth.RequirePermission("api", "read"), h.GetComponent)
	g.GET("", auth.RequirePermission("api", "read"), h.ListComponents)
	g.GET("/routes", auth.RequirePermission("api", "read"), h.ListRoutes)
	g.GET("/stats", auth.RequirePermission("api", "read"), h.Stats)
	g.GET("/tag/:tag", auth.RequirePermission("api", "read"), h.FilterByTag)
}

func (h *Handler) RegisterComponent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterComponent")
	defer span.End()
	var req models.RegisterComponentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.RegisterComponent(ctx, &req); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"status": "registered", "name": req.Name})
}

func (h *Handler) UnregisterComponent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UnregisterComponent")
	defer span.End()
	if err := h.svc.UnregisterComponent(ctx, c.Param("name")); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) GetComponent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComponent")
	defer span.End()
	comp, err := h.svc.GetComponent(ctx, c.Param("name"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": gin.H{"name": comp.Name, "num_routes": comp.NumRoutes()}})
}

func (h *Handler) ListComponents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListComponents")
	defer span.End()
	names, err := h.svc.ListComponents(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": names})
}

func (h *Handler) ListRoutes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRoutes")
	defer span.End()
	routes, err := h.svc.ListRoutes(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": routes})
}

func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComponentStats")
	defer span.End()
	stats := h.svc.Stats(ctx)
	c.JSON(200, gin.H{"data": stats})
}

func (h *Handler) FilterByTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FilterByTag")
	defer span.End()
	names, err := h.svc.FilterByTag(ctx, c.Param("tag"))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": names})
}
