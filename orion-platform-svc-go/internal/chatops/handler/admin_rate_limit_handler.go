package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

func (h *Handler) GetAllRateLimits(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllRateLimits")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limits, err := h.svc.GetAllRateLimits(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": limits})
}

func (h *Handler) CreateRateLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.TargetType == "" || req.LimitType == "" || req.LimitCount <= 0 || req.WindowSeconds <= 0 {
		middleware.RespondBadRequest(c, "target_type, limit_type, limit_count, window_seconds are required")
		return
	}
	lim, err := h.svc.CreateRateLimit(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": lim})
}

func (h *Handler) UpdateRateLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	lim, err := h.svc.UpdateRateLimit(ctx, tenantID, id, body)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rate limit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": lim})
}

func (h *Handler) DeleteRateLimit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRateLimit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteRateLimit(ctx, tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rate limit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Webhooks ----

func (h *Handler) GetAllWebhooks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllWebhooks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	webhooks, err := h.svc.GetAllWebhooks(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": webhooks})
}

func (h *Handler) CreateWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" || req.URL == "" || len(req.Events) == 0 {
		middleware.RespondBadRequest(c, "name, url, events are required")
		return
	}
	req.CreatedBy = c.GetString("user_id")
	webhook, err := h.svc.CreateWebhook(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": webhook})
}

func (h *Handler) UpdateWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	webhook, err := h.svc.UpdateWebhook(ctx, tenantID, id, body)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": webhook})
}

func (h *Handler) DeleteWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteWebhook(ctx, tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) TestWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TestWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.TestWebhook(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": result.Success, "data": result})
}

func (h *Handler) GetWebhookLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetWebhookLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	logs, err := h.svc.GetWebhookLogs(ctx, tenantID, id, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": logs})
}

// ---- Chat Config ----

func (h *Handler) GetQuestionConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetQuestionConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetQuestionConfigs(ctx, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) UpdateQuestionConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateQuestionConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var body struct {
		QuestionConfigs []models.QuestionConfigInput `json:"question_configs"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req := models.UpdateQuestionConfigsRequest{QuestionConfigs: body.QuestionConfigs}
	configs, err := h.svc.UpdateQuestionConfigs(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) GetCommandConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCommandConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetCommandConfigs(ctx, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) UpdateCommandConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCommandConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var body struct {
		CommandConfigs []models.CommandConfigInput `json:"command_configs"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req := models.UpdateCommandConfigsRequest{CommandConfigs: body.CommandConfigs}
	updated, err := h.svc.UpdateCommandConfigs(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": updated})
}
