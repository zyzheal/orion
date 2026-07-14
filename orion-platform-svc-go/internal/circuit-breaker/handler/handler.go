package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/circuit-breaker/models"
	"orion/platform-svc-go/internal/circuit-breaker/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/circuit-breakers")
	f.GET("", auth.RequirePermission("circuit_breaker", "read"), h.List)
	f.POST("", auth.RequirePermission("circuit_breaker", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("circuit_breaker", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("circuit_breaker", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("circuit_breaker", "delete"), h.Delete)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(c.Request.Context(), id, tenantID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, gin.H{"deleted": true})
}
