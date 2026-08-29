package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/monitoring/internal/alert-correlation/models"
	"orion/platform-svc-go/internal/monitoring/internal/alert-correlation/service"
	"orion/platform-svc-go/internal/monitoring/internal/response_writer"
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

func (h *AlertCorrelationHandler) CreateGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrCreateGroup")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateCorrelationGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}
	group, err := h.svc.CreateGroup(ctx, tenantID, req.RootAlertID, req.AlertIDs, req.GroupType)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, group)
}

func (h *AlertCorrelationHandler) ListGroups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrListGroups")
	defer span.End()
	tenantID := h.GetTenantID(c)
	groupType := c.Query("group_type")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.QueryGroups(ctx, tenantID, groupType, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{"total": resp.Total, "data": resp.Groups})
}

func (h *AlertCorrelationHandler) GetGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrGetGroup")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}
	group, err := h.svc.GetGroup(ctx, tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, group)
}

func (h *AlertCorrelationHandler) DeleteGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrDeleteGroup")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}
	if err := h.svc.DeleteGroup(ctx, tenantID, id); err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *AlertCorrelationHandler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrCreateRule")
	defer span.End()
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
	rule, err := h.svc.CreateRule(ctx, tenantID, req.Name, req.Description, req.GroupType, req.TimeWindowSec, req.Conditions)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, rule)
}

func (h *AlertCorrelationHandler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrListRules")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	rules, total, err := h.svc.QueryRules(ctx, tenantID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{"total": total, "data": rules})
}

func (h *AlertCorrelationHandler) AutoCorrelate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAlertCorrAutoCorrelate")
	defer span.End()
	tenantID := h.GetTenantID(c)
	groups, err := h.svc.AutoCorrelate(ctx, tenantID)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{"groups": groups})
}
