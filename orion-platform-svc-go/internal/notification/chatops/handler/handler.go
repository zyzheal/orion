package handler

import (
	"strconv"
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/channels")
	r.POST("", auth.RequirePermission("chatops", "write"), h.Create); r.GET("", h.List); r.GET("/:id", h.Get)
	r.DELETE("/:id", auth.RequirePermission("chatops", "delete"), h.Delete)
	r.GET("/count", h.Count)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateChatChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil { respondBadRequest(c, err.Error()); return }
	d, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil { respondInternalError(c, err.Error()); return }
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { respondInternalError(c, err.Error()); return }
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { respondNotFound(c, err.Error()); return }
	respondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}
