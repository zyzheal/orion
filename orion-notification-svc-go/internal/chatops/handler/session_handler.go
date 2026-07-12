package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/chatops/models"
	"orion/notification-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
)

type SessionHandler struct {
	svc *service.SessionService
}

func NewSessionHandler(svc *service.SessionService) *SessionHandler {
	return &SessionHandler{svc: svc}
}

func (h *SessionHandler) GetOrCreate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.GetOrCreate(c.Request.Context(), tenantID, req.SessionKey, req.UserID, req.ChannelID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *SessionHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	session, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("key"))
	if err != nil {
		respondNotFound(c, "session not found")
		return
	}
	respondSuccess(c, session)
}

func (h *SessionHandler) UpdateState(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		State   models.JSONB `json:"state"`
		History models.JSONB `json:"history"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateState(c.Request.Context(), tenantID, c.Param("key"), req.State, req.History); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "updated"})
}

func (h *SessionHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("key")); err != nil {
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
