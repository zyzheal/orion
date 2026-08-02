package handler

import (
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai/gateway/models"
	"orion/platform-svc-go/internal/ai/gateway/service"

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
	r := rg.Group("/ai-gateway")
	// Explicit routes before catch-all :id to avoid path collision
	r.POST("/chat", auth.RequirePermission("ai-gateway", "write"), h.Chat)
	r.GET("/models", auth.RequirePermission("ai-gateway", "read"), h.ListModels)
	r.POST("", auth.RequirePermission("ai-gateway", "write"), h.ProcessRequest)
	r.GET("/:id", auth.RequirePermission("ai-gateway", "read"), h.GetRequest)
	r.GET("", auth.RequirePermission("ai-gateway", "read"), h.ListRequests)
	r.GET("/by-provider/:provider", auth.RequirePermission("ai-gateway", "read"), h.ListByProvider)
	r.GET("/by-model/:model", auth.RequirePermission("ai-gateway", "read"), h.ListByModel)
	r.GET("/recent/:n", auth.RequirePermission("ai-gateway", "read"), h.ListRecent)
}

func (h *Handler) Chat(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Chat")
	defer span.End()
	var req models.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Model == "" {
		errors.WriteError(c, errors.ErrBadRequest, "model is required", http.StatusBadRequest)
		return
	}
	resp, err := h.svc.Chat(ctx, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) ListModels(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListModels")
	defer span.End()
	providers := h.svc.ListModels()
	errors.WriteSuccess(c, providers)
}

func (h *Handler) ProcessRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ProcessRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.GatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	resp, err := h.svc.ProcessRequest(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) GetRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	resp, err := h.svc.GetRequest(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "request not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) ListRequests(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRequests")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.ListQuery{Provider: c.Query("provider")}
	limit := 20
	if c.Query("limit") != "" {
		fmt.Sscanf(c.Query("limit"), "%d", &limit)
	}
	q.Limit = limit
	items, total, err := h.svc.ListRequests(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "total": total})
}

func (h *Handler) ListByProvider(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListByProvider")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	provider := c.Param("provider")
	limit := 50
	if c.Query("limit") != "" {
		fmt.Sscanf(c.Query("limit"), "%d", &limit)
	}
	items, total, err := h.svc.ListByProvider(ctx, tenantID, provider, limit)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "total": total})
}

func (h *Handler) ListByModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListByModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	model := c.Param("model")
	limit := 50
	if c.Query("limit") != "" {
		fmt.Sscanf(c.Query("limit"), "%d", &limit)
	}
	// GetByModel currently filters by provider field; rename is a future improvement
	items, total, err := h.svc.GetByModel(ctx, tenantID, model)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	// Truncate to limit
	if len(items) > limit {
		items = items[:limit]
	}
	errors.WriteSuccess(c, gin.H{"data": items, "total": total})
}

func (h *Handler) ListRecent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRecent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	n := 20
	fmt.Sscanf(c.Param("n"), "%d", &n)
	if n <= 0 || n > 100 {
		n = 20
	}
	items, total, err := h.svc.ListRecent(ctx, tenantID, n)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "total": total})
}
