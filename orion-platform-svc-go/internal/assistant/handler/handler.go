package handler

import (
	"fmt"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/assistant/models"
	"orion/platform-svc-go/internal/assistant/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("assistant", "read")
	f := rg.Group("/assistant")
	{
		f.GET("/health", h.Health)
		f.POST("/ask", read, h.Ask)
		f.POST("/action", read, h.Action)
		f.GET("/sessions", read, h.ListSessions)
		f.GET("/sessions/:id", read, h.GetSession)
		f.DELETE("/sessions/:id", read, h.DeleteSession)
	}
}

func (h *Handler) Health(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantHealth")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"status": "ok", "module": "assistant"})
}

type AskRequest struct {
	models.QueryRequest `json:",inline"`
	SessionID           string `json:"session_id,omitempty"`
}

func (h *Handler) Ask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantAsk")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req AskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if req.SessionID != "" {
		resp, err := h.svc.QueryWithSession(ctx, tenantID, userID, req.SessionID, req.QueryRequest)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		middleware.RespondSuccess(c, resp)
		return
	}

	resp, err := h.svc.Query(ctx, tenantID, req.QueryRequest)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) Action(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantAction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Prompt == "" {
		middleware.RespondBadRequest(c, "prompt is required")
		return
	}
	res, err := h.svc.ExecuteAction(ctx, tenantID, &req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, res)
}

func (h *Handler) ListSessions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantListSessions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	limit := 20
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	sessions, err := h.svc.ListSessions(ctx, tenantID, userID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if sessions == nil {
		sessions = make([]*models.Session, 0)
	}
	middleware.RespondSuccess(c, sessions)
}

func (h *Handler) GetSession(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantGetSession")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	sessionID := c.Param("id")
	if sessionID == "" {
		middleware.RespondBadRequest(c, "session id is required")
		return
	}
	sess, err := h.svc.GetSession(ctx, tenantID, userID, sessionID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sess)
}

func (h *Handler) DeleteSession(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantDeleteSession")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sessionID := c.Param("id")
	if err := h.svc.DeleteSession(ctx, tenantID, sessionID); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "session deleted"})
}

// Suppress unused fmt import warning
var _ = fmt.Sprintf
