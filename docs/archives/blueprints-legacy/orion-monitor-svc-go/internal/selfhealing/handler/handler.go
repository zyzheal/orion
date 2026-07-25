package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/response_writer"
	"orion/monitor-svc-go/internal/selfhealing/models"
	"orion/monitor-svc-go/internal/selfhealing/service"
	"orion/go-common/pkg/auth"
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

// RegisterRoutes registers self-healing routes.
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

// ListActions returns paginated healing actions.
func (h *SelfHealingHandler) ListActions(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryHealingActions(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": resp.Total,
		"data":  resp.Data,
	})
}

// CreateAction creates a new healing action.
func (h *SelfHealingHandler) CreateAction(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateHealingActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	action, err := h.svc.CreateHealingAction(c.Request.Context(), tenantID, &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, action)
}

// GetAction returns a healing action by ID.
func (h *SelfHealingHandler) GetAction(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	action, err := h.svc.GetHealingAction(c.Request.Context(), tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, action)
}

// UpdateAction updates a healing action.
func (h *SelfHealingHandler) UpdateAction(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Command     *string `json:"command"`
		IsEnabled   *bool   `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	action, err := h.svc.UpdateHealingAction(c.Request.Context(), tenantID, id, req.Name, req.Description, req.Command, req.IsEnabled)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, action)
}

// DeleteAction removes a healing action.
func (h *SelfHealingHandler) DeleteAction(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	if err := h.svc.DeleteHealingAction(c.Request.Context(), tenantID, id); err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ExecuteAction triggers execution of a healing action.
func (h *SelfHealingHandler) ExecuteAction(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	triggeredBy := c.GetString("userId")
	if triggeredBy == "" {
		triggeredBy = "manual"
	}

	history, err := h.svc.ExecuteAction(c.Request.Context(), tenantID, id, triggeredBy)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusAccepted, history)
}

// ListHistory returns paginated healing history.
func (h *SelfHealingHandler) ListHistory(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	actionID, _ := uuid.Parse(c.Query("action_id"))
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryHealingHistory(c.Request.Context(), tenantID, actionID, status, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": resp.Total,
		"data":  resp.Data,
	})
}
