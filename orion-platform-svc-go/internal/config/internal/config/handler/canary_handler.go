package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/service"

	"github.com/gin-gonic/gin"
)

type CanaryHandler struct {
	svc *service.CanaryService
}

func NewCanaryHandler(svc *service.CanaryService) *CanaryHandler {
	return &CanaryHandler{svc: svc}
}

func (h *CanaryHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	var req models.CreateCanaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	canary, err := h.svc.Create(ctx, tenantID, configID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "an active canary already exists for this config" {
			status = http.StatusConflict
		}
		respondError(c, status, err)
		return
	}
	respondCreated(c, canary)
}

func (h *CanaryHandler) Promote(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigPromote")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	result, err := h.svc.Promote(ctx, tenantID, configID, c.Param("canaryId"))
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "canary is not in active state" {
			status = http.StatusBadRequest
		}
		respondError(c, status, err)
		return
	}
	respondSuccess(c, result)
}

func (h *CanaryHandler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigRollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("configId")

	result, err := h.svc.Rollback(ctx, tenantID, configID, c.Param("canaryId"))
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "canary is not in active state" {
			status = http.StatusBadRequest
		}
		respondError(c, status, err)
		return
	}
	respondSuccess(c, result)
}

func (h *CanaryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/configs/:configId/canary")
	{
		c.POST("", auth.RequirePermission("config", "write"), h.Create)
		c.POST("/:canaryId/promote", auth.RequirePermission("config", "write"), h.Promote)
		c.POST("/:canaryId/rollback", auth.RequirePermission("config", "execute"), h.Rollback)
	}
}
