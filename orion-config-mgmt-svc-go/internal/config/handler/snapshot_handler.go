package handler

import (
	"net/http"
	"strconv"

	"orion/config-mgmt-svc-go/internal/config/models"
	"orion/config-mgmt-svc-go/internal/config/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type SnapshotHandler struct {
	svc *service.SnapshotService
}

func NewSnapshotHandler(svc *service.SnapshotService) *SnapshotHandler {
	return &SnapshotHandler{svc: svc}
}

func (h *SnapshotHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	var req models.CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	snapshot, err := h.svc.Create(c.Request.Context(), tenantID, configID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, snapshot)
}

func (h *SnapshotHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	snapshots, err := h.svc.List(c.Request.Context(), tenantID, configID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": snapshots})
}

func (h *SnapshotHandler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	snapshot, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("snapshotId"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "snapshot not found"})
		return
	}
	c.JSON(http.StatusOK, snapshot)
}

func (h *SnapshotHandler) Restore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	var req models.RestoreSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.Restore(c.Request.Context(), tenantID, configID, c.Param("snapshotId"), req.RestoredBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *SnapshotHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("snapshotId")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "snapshot deleted"})
}

func (h *SnapshotHandler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/configs/:configId/snapshots")
	{
		s.POST("", auth.RequirePermission("config", "write"), h.Create)
		s.GET("", h.List)
		s.GET("/:snapshotId", h.GetByID)
		s.POST("/:snapshotId/restore", auth.RequirePermission("config", "write"), h.Restore)
		s.DELETE("/:snapshotId", auth.RequirePermission("config", "delete"), h.Delete)
	}
}