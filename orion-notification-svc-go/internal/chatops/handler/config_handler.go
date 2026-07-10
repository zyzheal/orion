package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/chatops/models"
	"orion/notification-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
)

type ConfigHandler struct {
	svc *service.ConfigService
}

func NewConfigHandler(svc *service.ConfigService) *ConfigHandler {
	return &ConfigHandler{svc: svc}
}

// Question Config

func (h *ConfigHandler) GetQuestionConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetQuestionConfigs(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": configs})
}

func (h *ConfigHandler) UpsertQuestionConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input models.QuestionConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cfg, err := h.svc.UpsertQuestionConfig(c.Request.Context(), tenantID, userID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *ConfigHandler) DeleteQuestionConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if err := h.svc.DeleteQuestionConfig(c.Request.Context(), tenantID, userID, c.Param("key")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// Command Config

func (h *ConfigHandler) GetCommandConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetCommandConfigs(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": configs})
}

func (h *ConfigHandler) UpsertCommandConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input models.CommandConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cfg, err := h.svc.UpsertCommandConfig(c.Request.Context(), tenantID, userID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *ConfigHandler) DeleteCommandConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if err := h.svc.DeleteCommandConfig(c.Request.Context(), tenantID, userID, c.Param("key")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ConfigHandler) RegisterRoutes(rg *gin.RouterGroup) {
	qc := rg.Group("/question-configs")
	{
		qc.GET("", h.GetQuestionConfigs)
		qc.PUT("", h.UpsertQuestionConfig)
		qc.DELETE("/:key", h.DeleteQuestionConfig)
	}
	cc := rg.Group("/command-configs")
	{
		cc.GET("", h.GetCommandConfigs)
		cc.PUT("", h.UpsertCommandConfig)
		cc.DELETE("/:key", h.DeleteCommandConfig)
	}
}
