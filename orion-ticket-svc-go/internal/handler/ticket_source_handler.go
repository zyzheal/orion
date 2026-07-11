package handler

import (
	"net/http"

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
	rg.POST("/tickets/from-alert", h.FromAlert)
	rg.POST("/tickets/from-incident", h.FromIncident)
}

func (h *TicketSourceHandler) FromAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var alert map[string]any
	if err := c.ShouldBindJSON(&alert); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.svc.FromAlert(c.Request.Context(), tenantID, alert, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ticket})
}

func (h *TicketSourceHandler) FromIncident(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var incident map[string]any
	if err := c.ShouldBindJSON(&incident); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.svc.FromIncident(c.Request.Context(), tenantID, incident, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ticket})
}
