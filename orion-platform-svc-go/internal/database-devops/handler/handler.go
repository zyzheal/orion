package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/database-devops/models"
	"orion/platform-svc-go/internal/database-devops/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel"
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
	r.GET("", auth.RequirePermission("database-devops", "read"), h.ListOperations)
	r.GET("/:id", auth.RequirePermission("database-devops", "read"), h.GetOperation)
	r.POST("", auth.RequirePermission("database-devops", "write"), h.CreateOperation)
	r.PUT("/:id", auth.RequirePermission("database-devops", "write"), h.UpdateOperation)
	r.DELETE("/:id", auth.RequirePermission("database-devops", "delete"), h.DeleteOperation)
	// Backup/Restore actions
	r.POST("/:id/backup", auth.RequirePermission("database-devops", "execute"), h.ExecuteBackup)
	r.POST("/:id/restore", auth.RequirePermission("database-devops", "execute"), h.ExecuteRestore)
	// Data source management
	r.GET("/data-sources", auth.RequirePermission("database-devops", "read"), h.ListDataSources)
	r.POST("/data-sources", auth.RequirePermission("database-devops", "write"), h.CreateDataSource)
	r.DELETE("/data-sources/:id", auth.RequirePermission("database-devops", "delete"), h.DeleteDataSource)
}

func (h *Handler) ListOperations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOperations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListOperations(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) GetOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOperation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetOperation(ctx, tenantID, c.Param("id"))
	if err != nil || item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) CreateOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOperation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDatabaseDevopsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.CreateOperation(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateOperation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDatabaseDevopsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.UpdateOperation(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteOperation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteOperation(ctx, tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ExecuteBackup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteBackup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.ExecuteBackup(ctx, tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ExecuteRestore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteRestore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.ExecuteRestore(ctx, tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ListDataSources(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDataSources")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDataSources(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) CreateDataSource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDataSource")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ds, err := h.svc.CreateDataSource(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ds)
}

func (h *Handler) DeleteDataSource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDataSource")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteDataSource(ctx, tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
