package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/chatops/models"
	"orion/notification-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
)

type MessageHandler struct {
	svc *service.MessageService
}

func NewMessageHandler(svc *service.MessageService) *MessageHandler {
	return &MessageHandler{svc: svc}
}

func (h *MessageHandler) SendMessage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.svc.SendMessage(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *MessageHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/messages", h.SendMessage)
}
