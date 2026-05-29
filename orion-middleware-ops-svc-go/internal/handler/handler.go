package handler

import (
	"net/http"
	"strconv"
	"orion/middleware-ops-svc-go/internal/models"
	"orion/middleware-ops-svc-go/internal/service"
	"github.com/gin-gonic/gin"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	m := rg.Group("/middleware")
	m.POST("/instances", h.CreateInstance)
	m.GET("/instances", h.ListInstances)
	m.GET("/instances/:id", h.GetInstance)
	m.PUT("/instances/:id", h.UpdateInstance)
	m.DELETE("/instances/:id", h.DeleteInstance)
	m.POST("/backups", h.CreateBackup)
	m.GET("/instances/:id/backups", h.ListBackups)
	r.DELETE("/:id", h.Delete)
	r.GET("/count", h.Count)
}

func (h *Handler) CreateInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.CreateInstance(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListInstances(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListInstances(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetInstance(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

func (h *Handler) UpdateInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.UpdateInstance(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteInstance(c.Request.Context(), tenantID, c.Param("id")); err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) CreateBackup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBackupRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.CreateBackup(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListBackups(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListBackupsByInstance(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
