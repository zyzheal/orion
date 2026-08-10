package handler

import (
        "github.com/gin-gonic/gin"
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
        var req models.RegisterComponentRequest
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        if err := h.svc.RegisterComponent(c.Request.Context(), &req); err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(201, gin.H{"status": "registered", "name": req.Name})
}

func (h *Handler) UnregisterComponent(c *gin.Context) {
        if err := h.svc.UnregisterComponent(c.Request.Context(), c.Param("name")); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) GetComponent(c *gin.Context) {
        comp, err := h.svc.GetComponent(c.Request.Context(), c.Param("name"))
        if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": gin.H{"name": comp.Name, "num_routes": comp.NumRoutes()}})
}

func (h *Handler) ListComponents(c *gin.Context) {
        names, err := h.svc.ListComponents(c.Request.Context())
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": names})
}

func (h *Handler) ListRoutes(c *gin.Context) {
        routes, err := h.svc.ListRoutes(c.Request.Context())
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": routes})
}

func (h *Handler) Stats(c *gin.Context) {
        stats := h.svc.Stats(c.Request.Context())
        c.JSON(200, gin.H{"data": stats})
}

func (h *Handler) FilterByTag(c *gin.Context) {
        names, err := h.svc.FilterByTag(c.Request.Context(), c.Param("tag"))
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": names})
}
