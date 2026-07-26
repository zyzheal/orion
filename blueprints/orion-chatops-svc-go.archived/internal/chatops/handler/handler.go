package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/orion/chatops-svc/internal/chatops/service"
)

type ChatOpsHandler struct {
	Service service.ChatOpsService
}

func NewChatOpsHandler(svc service.ChatOpsService) *ChatOpsHandler {
	return &ChatOpsHandler{Service: svc}
}

func (h *ChatOpsHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/commands", h.ExecuteCommand)
	rg.GET("/messages", h.ListMessages)
	rg.POST("/messages", h.SendMessage)
	rg.GET("/conversations", h.ListConversations)
	rg.GET("/platforms", h.ListPlatforms)
	rg.POST("/platforms", h.RegisterPlatform)
}

func (h *ChatOpsHandler) ExecuteCommand(c *gin.Context) {
	var req struct {
		Command string `json:"command"`
		Args    string `json:"args"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}
	result, err := h.Service.ExecuteCommand(c.Request.Context(), req.Command, req.Args)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": result})
}

func (h *ChatOpsHandler) ListMessages(c *gin.Context) {
	msgs, err := h.Service.ListMessages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": msgs})
}

func (h *ChatOpsHandler) SendMessage(c *gin.Context) {
	var req struct {
		Platform string `json:"platform"`
		Channel  string `json:"channel"`
		Content  string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}
	if err := h.Service.SendMessage(c.Request.Context(), req.Platform, req.Channel, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *ChatOpsHandler) ListConversations(c *gin.Context) {
	convs, err := h.Service.ListConversations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": convs})
}

func (h *ChatOpsHandler) ListPlatforms(c *gin.Context) {
	platforms, err := h.Service.ListPlatforms(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": platforms})
}

func (h *ChatOpsHandler) RegisterPlatform(c *gin.Context) {
	var req struct {
		Name   string `json:"name"`
		Type   string `json:"type"`
		Config string `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}
	if err := h.Service.RegisterPlatform(c.Request.Context(), req.Name, req.Type, req.Config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success"})
}
