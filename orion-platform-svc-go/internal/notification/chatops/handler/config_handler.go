package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/notification/chatops/models"
	"orion/platform-svc-go/internal/notification/chatops/service"

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsGetQuestionConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetQuestionConfigs(ctx, tenantID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, configs)
}

func (h *ConfigHandler) UpsertQuestionConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsUpsertQuestionConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input models.QuestionConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.UpsertQuestionConfig(ctx, tenantID, userID, input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}

func (h *ConfigHandler) DeleteQuestionConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsDeleteQuestionConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if err := h.svc.DeleteQuestionConfig(ctx, tenantID, userID, c.Param("key")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// Command Config

func (h *ConfigHandler) GetCommandConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsGetCommandConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetCommandConfigs(ctx, tenantID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, configs)
}

func (h *ConfigHandler) UpsertCommandConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsUpsertCommandConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input models.CommandConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.UpsertCommandConfig(ctx, tenantID, userID, input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}

func (h *ConfigHandler) DeleteCommandConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsDeleteCommandConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if err := h.svc.DeleteCommandConfig(ctx, tenantID, userID, c.Param("key")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
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
