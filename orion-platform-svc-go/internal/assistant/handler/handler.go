package handler

import (
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
	}
}

func (h *Handler) Health(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{"status": "ok", "module": "assistant"})
}

func (h *Handler) Ask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssistantAsk")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.Query(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// Action executes a workflow action (create ticket / trigger pipeline / create change)
// from a natural-language request (TR-09 tool-calling).
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