package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/notification/chatops/models"
	"orion/platform-svc-go/internal/notification/chatops/service"

	"github.com/gin-gonic/gin"
)

type SessionHandler struct {
	svc *service.SessionService
}

func NewSessionHandler(svc *service.SessionService) *SessionHandler {
	return &SessionHandler{svc: svc}
}

func (h *SessionHandler) GetOrCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsGetOrCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.GetOrCreate(ctx, tenantID, req.SessionKey, req.UserID, req.ChannelID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *SessionHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	session, err := h.svc.Get(ctx, tenantID, c.Param("key"))
	if err != nil {
		respondNotFound(c, "session not found")
		return
	}
	respondSuccess(c, session)
}

func (h *SessionHandler) UpdateState(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsUpdateState")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		State   models.JSONB `json:"state"`
		History models.JSONB `json:"history"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateState(ctx, tenantID, c.Param("key"), req.State, req.History); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "updated"})
}

func (h *SessionHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("key")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *SessionHandler) RegisterRoutes(rg *gin.RouterGroup) {
	sess := rg.Group("/sessions")
	{
		sess.POST("", h.GetOrCreate)
		sess.GET("/:key", h.Get)
		sess.PUT("/:key/state", h.UpdateState)
		sess.DELETE("/:key", h.Delete)
	}
}
