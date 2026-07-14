package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-breaker/models"
	"orion/platform-svc-go/internal/alert-breaker/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/alert-breaker")

	f.GET("", auth.RequirePermission("alert-breaker", "read"), h.ListAlertBreakers)
	f.GET("/:id", auth.RequirePermission("alert-breaker", "read"), h.GetAlertBreaker)
	f.POST("", auth.RequirePermission("alert-breaker", "write"), h.CreateAlertBreaker)
	f.PUT("/:id", auth.RequirePermission("alert-breaker", "write"), h.UpdateAlertBreaker)
	f.DELETE("/:id", auth.RequirePermission("alert-breaker", "delete"), h.DeleteAlertBreaker)
}

func (h *Handler) ListAlertBreakers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, total, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) GetAlertBreaker(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "alert breaker not found")
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) CreateAlertBreaker(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAlertBreakerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) UpdateAlertBreaker(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAlertBreakerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		respondNotFound(c, "alert breaker not found")
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) DeleteAlertBreaker(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "alert breaker not found")
		return
	}
	respondSuccess(c, gin.H{"message": "alert breaker deleted"})
}
