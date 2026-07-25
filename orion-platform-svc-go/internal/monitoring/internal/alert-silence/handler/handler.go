package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/alert-silence/models"
	"orion/platform-svc-go/internal/monitoring/internal/alert-silence/service"
	"orion/platform-svc-go/internal/monitoring/internal/response_writer"
	"orion/go-common/pkg/auth"
)

type AlertSilenceHandler struct {
	svc *service.AlertSilenceService
}

func NewAlertSilenceHandler(svc *service.AlertSilenceService) *AlertSilenceHandler {
	return &AlertSilenceHandler{svc: svc}
}

func (h *AlertSilenceHandler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

// RegisterRoutes registers alert-silence routes.
func (h *AlertSilenceHandler) RegisterRoutes(rg *gin.RouterGroup) {
	silences := rg.Group("/alert-silences")

	silences.GET("", auth.RequirePermission("monitor", "read"), h.List)
	silences.POST("", auth.RequirePermission("monitor", "write"), h.Create)
	silences.GET("/:id", auth.RequirePermission("monitor", "read"), h.Get)
	silences.DELETE("/:id", auth.RequirePermission("monitor", "delete"), h.Delete)
	silences.PATCH("/:id/extend", auth.RequirePermission("monitor", "write"), h.Extend)
}

// List returns paginated silences.
func (h *AlertSilenceHandler) List(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QuerySilences(c.Request.Context(), tenantID, status, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": resp.Total,
		"data":  resp.Data,
	})
}

// Create creates a new silence.
func (h *AlertSilenceHandler) Create(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateSilenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	createdBy := c.GetString("userId")
	silence, err := h.svc.CreateSilence(c.Request.Context(), tenantID, &req, createdBy)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, silence)
}

// Get returns a single silence.
func (h *AlertSilenceHandler) Get(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	silence, err := h.svc.GetSilence(c.Request.Context(), tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, silence)
}

// Delete removes a silence.
func (h *AlertSilenceHandler) Delete(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	if err := h.svc.DeleteSilence(c.Request.Context(), tenantID, id); err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// Extend extends a silence duration.
func (h *AlertSilenceHandler) Extend(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	var req struct {
		ExtendBy int `json:"extend_by" binding:"required,min=60"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	silence, err := h.svc.ExtendSilence(c.Request.Context(), tenantID, id, req.ExtendBy)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, silence)
}
