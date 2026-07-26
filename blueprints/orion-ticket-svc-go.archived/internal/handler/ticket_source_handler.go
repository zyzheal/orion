package handler

import (
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/service"
)

type TicketSourceHandler struct {
	svc *service.TicketGeneratorService
}

func NewTicketSourceHandler(svc *service.TicketGeneratorService) *TicketSourceHandler {
	return &TicketSourceHandler{svc: svc}
}

func (h *TicketSourceHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/tickets/from-alert", auth.RequirePermission("ticket", "write"), h.FromAlert)
	rg.POST("/tickets/from-incident", auth.RequirePermission("ticket", "write"), h.FromIncident)
}

func (h *TicketSourceHandler) FromAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var alert map[string]any
	if err := c.ShouldBindJSON(&alert); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	ticket, err := h.svc.FromAlert(c.Request.Context(), tenantID, alert, createdBy)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ticket)
}

func (h *TicketSourceHandler) FromIncident(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var incident map[string]any
	if err := c.ShouldBindJSON(&incident); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	ticket, err := h.svc.FromIncident(c.Request.Context(), tenantID, incident, createdBy)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ticket)
}
