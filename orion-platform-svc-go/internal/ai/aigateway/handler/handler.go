package handler

import (
	"orion/platform-svc-go/internal/ai/aigateway/models"
	"orion/platform-svc-go/internal/ai/aigateway/service"

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
	{
		r.POST("", h.Create)
		r.GET("", h.List)
	}
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateAIGatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), c.GetString("tenant_id"), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) List(c *gin.Context) {
	items, err := h.svc.List(c.Request.Context(), c.GetString("tenant_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}
