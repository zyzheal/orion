package handler

import (
	"net/http"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type CanaryHandler struct {
	svc *service.CanaryService
}

func NewCanaryHandler(svc *service.CanaryService) *CanaryHandler {
	return &CanaryHandler{svc: svc}
}

func (h *CanaryHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	var req models.CreateCanaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	canary, err := h.svc.Create(c.Request.Context(), tenantID, configID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "an active canary already exists for this config" {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, canary)
}

func (h *CanaryHandler) Promote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	result, err := h.svc.Promote(c.Request.Context(), tenantID, configID, c.Param("canaryId"))
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "canary is not in active state" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *CanaryHandler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	result, err := h.svc.Rollback(c.Request.Context(), tenantID, configID, c.Param("canaryId"))
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "canary is not in active state" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *CanaryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/configs/:configId/canary")
	{
		c.POST("", auth.RequirePermission("config", "write"), h.Create)
		c.POST("/:canaryId/promote", auth.RequirePermission("config", "write"), h.Promote)
		c.POST("/:canaryId/rollback", auth.RequirePermission("config", "execute"), h.Rollback)
	}
}