package handler

import (
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai-gateway/models"
	"orion/platform-svc-go/internal/ai-gateway/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai-gateway")
	r.POST("", auth.RequirePermission("ai-gateway", "write"), h.ProcessRequest)
	r.GET("/:id", auth.RequirePermission("ai-gateway", "read"), h.GetRequest)
	r.GET("", auth.RequirePermission("ai-gateway", "read"), h.ListRequests)
}

func (h *Handler) ProcessRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req models.GatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	resp, err := h.svc.SimulateGatewayCall(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) GetRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	resp, err := h.svc.GetRequest(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "request not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) ListRequests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
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
