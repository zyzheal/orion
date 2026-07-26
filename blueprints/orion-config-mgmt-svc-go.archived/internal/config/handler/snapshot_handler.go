package handler

import (
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
		respondBadRequest(c, err.Error())
		return
	}

	snapshot, err := h.svc.Create(c.Request.Context(), tenantID, configID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, snapshot)
}

func (h *SnapshotHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	snapshots, err := h.svc.List(c.Request.Context(), tenantID, configID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": snapshots})
}

func (h *SnapshotHandler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	snapshot, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("snapshotId"))
	if err != nil {
		respondNotFound(c, "snapshot not found")
		return
	}
	respondSuccess(c, snapshot)
}

func (h *SnapshotHandler) Restore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	var req models.RestoreSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.Restore(c.Request.Context(), tenantID, configID, c.Param("snapshotId"), req.RestoredBy)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *SnapshotHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("snapshotId")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "snapshot deleted"})
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