package handler

import (
	"net/http"
	"strconv"
	"orion/notification-svc-go/internal/models"
	"orion/notification-svc-go/internal/service"
	"github.com/gin-gonic/gin"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	n := rg.Group("/notifications")
	n.POST("", h.Send); n.GET("", h.List); n.GET("/:id", h.Get)
	t := rg.Group("/templates")
	t.POST("", h.CreateTemplate); t.GET("", h.ListTemplates)
	c := rg.Group("/channels")
	c.POST("", h.CreateChannel); c.GET("", h.ListChannels)
}

func (h *Handler) Send(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	n, err := h.svc.SendNotification(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, n)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListNotifications(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	n, err := h.svc.GetNotification(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, n)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var t models.NotificationTemplate
	if err := c.ShouldBindJSON(&t); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	if err := h.svc.CreateTemplate(c.Request.Context(), tenantID, &t); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, t)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListTemplates(c.Request.Context(), tenantID)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var ch models.NotificationChannel
	if err := c.ShouldBindJSON(&ch); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	if err := h.svc.CreateChannel(c.Request.Context(), tenantID, &ch); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, ch)
}

func (h *Handler) ListChannels(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListChannels(c.Request.Context(), tenantID)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}
