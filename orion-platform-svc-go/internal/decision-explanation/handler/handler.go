package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/decision-explanation/models"
	"orion/platform-svc-go/internal/decision-explanation/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/decision-explanation")

	f.GET("", auth.RequirePermission("decision-explanation", "read"), h.List)
	f.POST("", auth.RequirePermission("decision-explanation", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("decision-explanation", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("decision-explanation", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("decision-explanation", "delete"), h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDecisionExplanationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "decision-explanation not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDecisionExplanationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "decision-explanation not found")
			return
		}
		if service.IsBadRequest(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "decision-explanation not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "decision-explanation deleted"})
}
