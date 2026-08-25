package handler

import (
	"context"
	"net/http"

	"orion/platform-svc-go/internal/database-devops/models"
	"orion/platform-svc-go/internal/database-devops/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(db *sqlx.DB) *Handler {
	return &Handler{svc: service.NewService(db)}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	r := router.Group("/database-devops")
	// Operation CRUD
	r.GET("", h.ListOperations)
	r.GET("/:id", h.GetOperation)
	r.POST("", h.CreateOperation)
	r.PUT("/:id", h.UpdateOperation)
	r.DELETE("/:id", h.DeleteOperation)
	// Backup/Restore actions
	r.POST("/:id/backup", h.ExecuteBackup)
	r.POST("/:id/restore", h.ExecuteRestore)
	// Data source management
	r.GET("/data-sources", h.ListDataSources)
	r.POST("/data-sources", h.CreateDataSource)
	r.DELETE("/data-sources/:id", h.DeleteDataSource)
}

func (h *Handler) ListOperations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListOperations(context.Background(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) GetOperation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetOperation(context.Background(), tenantID, c.Param("id"))
	if err != nil || item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) CreateOperation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDatabaseDevopsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.CreateOperation(context.Background(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateOperation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDatabaseDevopsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.UpdateOperation(context.Background(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteOperation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteOperation(context.Background(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ExecuteBackup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.ExecuteBackup(context.Background(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ExecuteRestore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.ExecuteRestore(context.Background(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ListDataSources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDataSources(context.Background(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) CreateDataSource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ds, err := h.svc.CreateDataSource(context.Background(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ds)
}

func (h *Handler) DeleteDataSource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteDataSource(context.Background(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
