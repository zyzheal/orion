package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/alert-correlation/models"
	"orion/platform-svc-go/internal/monitoring/internal/alert-correlation/service"
	"orion/platform-svc-go/internal/monitoring/internal/response_writer"
	"orion/go-common/pkg/auth"
)

type AlertCorrelationHandler struct {
	svc *service.AlertCorrelationService
}

func NewAlertCorrelationHandler(svc *service.AlertCorrelationService) *AlertCorrelationHandler {
	return &AlertCorrelationHandler{svc: svc}
}

func (h *AlertCorrelationHandler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

// RegisterRoutes registers alert-correlation routes.
func (h *AlertCorrelationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	corr := rg.Group("/alert-correlation")

	corr.POST("/groups", auth.RequirePermission("monitor", "write"), h.CreateGroup)
	corr.GET("/groups", auth.RequirePermission("monitor", "read"), h.ListGroups)
	corr.GET("/groups/:id", auth.RequirePermission("monitor", "read"), h.GetGroup)
	corr.DELETE("/groups/:id", auth.RequirePermission("monitor", "delete"), h.DeleteGroup)

	corr.POST("/rules", auth.RequirePermission("monitor", "write"), h.CreateRule)
	corr.GET("/rules", auth.RequirePermission("monitor", "read"), h.ListRules)

	corr.POST("/auto", auth.RequirePermission("monitor", "execute"), h.AutoCorrelate)
}

// CreateGroup creates a correlation group.
func (h *AlertCorrelationHandler) CreateGroup(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateCorrelationGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	group, err := h.svc.CreateGroup(c.Request.Context(), tenantID, req.RootAlertID, req.AlertIDs, req.GroupType)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, group)
}

// ListGroups returns paginated correlation groups.
func (h *AlertCorrelationHandler) ListGroups(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	groupType := c.Query("group_type")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryGroups(c.Request.Context(), tenantID, groupType, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{"total": resp.Total, "data": resp.Groups})
}

// GetGroup returns a single correlation group.
func (h *AlertCorrelationHandler) GetGroup(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	group, err := h.svc.GetGroup(c.Request.Context(), tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, group)
}

// DeleteGroup removes a correlation group.
func (h *AlertCorrelationHandler) DeleteGroup(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	if err := h.svc.DeleteGroup(c.Request.Context(), tenantID, id); err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// CreateRule creates a correlation rule.
func (h *AlertCorrelationHandler) CreateRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req struct {
		Name          string `json:"name" binding:"required"`
		Description   string `json:"description"`
		GroupType     string `json:"group_type" binding:"required,oneof=temporal spatial causal"`
		TimeWindowSec int    `json:"time_window_sec"`
		Conditions    string `json:"conditions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, req.Name, req.Description, req.GroupType, req.TimeWindowSec, req.Conditions)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, rule)
}

// ListRules returns paginated correlation rules.
func (h *AlertCorrelationHandler) ListRules(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	rules, total, err := h.svc.QueryRules(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{"total": total, "data": rules})
}

// AutoCorrelate triggers automatic correlation.
func (h *AlertCorrelationHandler) AutoCorrelate(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	groups, err := h.svc.AutoCorrelate(c.Request.Context(), tenantID)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{"groups": groups})
}
