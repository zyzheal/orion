package handler

import (

	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

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
		respondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.SendMessage(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *MessageHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/messages", h.SendMessage)
}
