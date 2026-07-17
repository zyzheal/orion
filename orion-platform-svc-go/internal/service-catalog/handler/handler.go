package handler

import (
	"net/http"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/service-catalog/models"
	"orion/platform-svc-go/internal/service-catalog/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/service-catalog")
	r.GET("", auth.RequirePermission("service_catalog", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("service_catalog", "read"), h.Get)
	r.POST("", auth.RequirePermission("service_catalog", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("service_catalog", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("service_catalog", "delete"), h.Delete)

	// Request lifecycle endpoints
	r.POST("/requests/:id/status", auth.RequirePermission("service_catalog", "write"), h.UpdateRequestStatus)
	r.GET("/requests/:id/timeline", auth.RequirePermission("service_catalog", "read"), h.GetRequestTimeline)
	r.GET("/sla-breaches", auth.RequirePermission("service_catalog", "read"), h.GetSLABreaches)
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
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	item, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.CreateServiceCatalogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	var req models.UpdateServiceCatalogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) UpdateRequestStatus(c *gin.Context) {
	id := c.Param("id")
	var req models.StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.UpdateRequestStatus(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetRequestTimeline(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetRequestTimeline(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetSLABreaches(c *gin.Context) {
	var q models.SLABreachesQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetSLABreaches(c.Request.Context(), tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, result)
}

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondInternalError(c *gin.Context) {
	errors.WriteError(c, errors.ErrInternal, "internal server error", http.StatusInternalServerError)
}

func respondNotFound(c *gin.Context) {
	errors.WriteError(c, errors.ErrNotFound, "resource not found", http.StatusNotFound)
}
