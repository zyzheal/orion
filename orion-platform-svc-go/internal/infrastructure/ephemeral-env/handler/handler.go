package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/infrastructure/ephemeral-env/models"
	"orion/platform-svc-go/internal/infrastructure/ephemeral-env/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ephemeral_envs")
	{
		r.POST("", auth.RequirePermission("ephemeral_env", "write"), h.Create)
		r.GET("", auth.RequirePermission("ephemeral_env", "read"), h.List)
		r.GET("/:id", auth.RequirePermission("ephemeral_env", "read"), h.Get)
		r.DELETE("/:id", auth.RequirePermission("ephemeral_env", "delete"), h.Delete)
	}
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateEphemeralEnvRequest
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

func (h *Handler) Get(c *gin.Context) {
	m, err := h.svc.Get(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(c.Request.Context(), c.GetString("tenant_id"), limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.GetString("tenant_id"), c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}