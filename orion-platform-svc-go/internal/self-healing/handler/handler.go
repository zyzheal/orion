package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/self-healing/models"
	"orion/platform-svc-go/internal/self-healing/service"
)

type SelfHealingHandler struct {
	svc *service.SelfHealingService
}

func NewSelfHealingHandler(svc *service.SelfHealingService) *SelfHealingHandler {
	return &SelfHealingHandler{svc: svc}
}

func (h *SelfHealingHandler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

func (h *SelfHealingHandler) RegisterRoutes(rg *gin.RouterGroup) {
	actions := rg.Group("/selfhealing/actions")
	actions.GET("", auth.RequirePermission("monitor", "read"), h.ListActions)
	actions.POST("", auth.RequirePermission("monitor", "write"), h.CreateAction)
	actions.GET("/:id", auth.RequirePermission("monitor", "read"), h.GetAction)
	actions.PUT("/:id", auth.RequirePermission("monitor", "write"), h.UpdateAction)
	actions.DELETE("/:id", auth.RequirePermission("monitor", "delete"), h.DeleteAction)
	actions.POST("/:id/execute", auth.RequirePermission("monitor", "execute"), h.ExecuteAction)
	rg.GET("/selfhealing/history", auth.RequirePermission("monitor", "read"), h.ListHistory)
}

func (h *SelfHealingHandler) ListActions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingListActions")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.QueryHealingActions(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

func (h *SelfHealingHandler) CreateAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingCreateAction")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateHealingActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	action, err := h.svc.CreateHealingAction(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, action)
}

func (h *SelfHealingHandler) GetAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingGetAction")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	action, err := h.svc.GetHealingAction(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, action)
}

func (h *SelfHealingHandler) UpdateAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingUpdateAction")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Command     *string `json:"command"`
		IsEnabled   *bool   `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	action, err := h.svc.UpdateHealingAction(ctx, tenantID, id, req.Name, req.Description, req.Command, req.IsEnabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, action)
}

func (h *SelfHealingHandler) DeleteAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingDeleteAction")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	if err := h.svc.DeleteHealingAction(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *SelfHealingHandler) ExecuteAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingExecuteAction")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	triggeredBy := c.GetString("userId")
	if triggeredBy == "" {
		triggeredBy = "manual"
	}
	history, err := h.svc.ExecuteAction(ctx, tenantID, id, triggeredBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

func (h *SelfHealingHandler) ListHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SelfHealingListHistory")
	defer span.End()
	tenantID := h.GetTenantID(c)
	actionID, _ := uuid.Parse(c.Query("action_id"))
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.QueryHealingHistory(ctx, tenantID, actionID, status, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}
