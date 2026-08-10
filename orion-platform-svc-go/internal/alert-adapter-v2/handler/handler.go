package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-adapter-v2/models"
	"orion/platform-svc-go/internal/alert-adapter-v2/service"
)

type Handler struct { factory *service.NotificationFactory }

func NewHandler(factory *service.NotificationFactory) *Handler { return &Handler{factory: factory} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/alert-adapters/v2")
	g.POST("/adapters", auth.RequirePermission("alert", "write"), h.CreateAdapter)
	g.GET("/adapters", auth.RequirePermission("alert", "read"), h.ListAdapters)
	g.GET("/adapters/:id", auth.RequirePermission("alert", "read"), h.GetAdapter)
	g.PATCH("/adapters/:id", auth.RequirePermission("alert", "write"), h.UpdateAdapter)
	g.DELETE("/adapters/:id", auth.RequirePermission("alert", "delete"), h.DeleteAdapter)
	g.POST("/templates", auth.RequirePermission("alert", "write"), h.CreateTemplate)
	g.GET("/templates", auth.RequirePermission("alert", "read"), h.ListTemplates)
	g.POST("/:id/send", auth.RequirePermission("alert", "execute"), h.SendNotification)
	g.GET("/:id/events", auth.RequirePermission("alert", "read"), h.ListEvents)
}

func (h *Handler) CreateAdapter(c *gin.Context) {
	var req struct { Name, Channel, Config string `json:"name,omitempty"` }
	_ = c.ShouldBindJSON(&req)
	a, err := h.factory.CreateAdapter(c.Request.Context(), c.GetString("tenant_id"), req.Name, req.Channel, req.Config)
	if err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	c.JSON(201, gin.H{"data": a})
}

func (h *Handler) ListAdapters(c *gin.Context) {
	ch := c.Query("channel")
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 { limit = 20 }
	items, err := h.factory.ListAdapters(c.Request.Context(), c.GetString("tenant_id"), ch, offset, limit)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": items})
}

func (h *Handler) GetAdapter(c *gin.Context) {
	a, err := h.factory.GetAdapter(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"))
	if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": a})
}

func (h *Handler) UpdateAdapter(c *gin.Context) {
	var req models.UpdateAdapterRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	a, err := h.factory.UpdateAdapter(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"), &req)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": a})
}

func (h *Handler) DeleteAdapter(c *gin.Context) {
	if err := h.factory.DeleteAdapter(c.Request.Context(), c.GetString("tenant_id"), c.Param("id")); err != nil {
		c.JSON(500, gin.H{"error": err.Error()}); return
	}
	c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var req struct { Name, Channel, Template, Variables string }
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	t, err := h.factory.CreateTemplate(c.Request.Context(), c.GetString("tenant_id"), req.Name, req.Channel, req.Template, req.Variables)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(201, gin.H{"data": t})
}

func (h *Handler) ListTemplates(c *gin.Context) {
	ch := c.Query("channel")
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 { limit = 20 }
	items, err := h.factory.ListTemplates(c.Request.Context(), c.GetString("tenant_id"), ch, offset, limit)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": items})
}

func (h *Handler) SendNotification(c *gin.Context) {
	var req struct { TemplateID, AlertID string; Variables map[string]string }
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	ev, err := h.factory.SendNotification(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"), req.TemplateID, req.AlertID, req.Variables)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": ev})
}

func (h *Handler) ListEvents(c *gin.Context) {
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 { limit = 20 }
	items, err := h.factory.ListEvents(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"), c.Query("status"), offset, limit)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"data": items})
}
