package handler

import (
	"orion/go-common/pkg/auth"
	goerr "orion/go-common/pkg/errors"

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
	f.POST("/:id/success", auth.RequirePermission("circuit_breaker", "write"), h.RecordSuccess)
	f.POST("/:id/failure", auth.RequirePermission("circuit_breaker", "write"), h.RecordFailure)
	f.GET("/:id/state", auth.RequirePermission("circuit_breaker", "read"), h.GetState)
	f.GET("/:id/events", auth.RequirePermission("circuit_breaker", "read"), h.GetEvents)
	f.GET("/open", auth.RequirePermission("circuit_breaker", "read"), h.ListOpen)
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
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(c.Request.Context(), &req, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(c.Request.Context(), id, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), id, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	if !deleted {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) RecordSuccess(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	var req models.SuccessRequest
	_ = c.ShouldBindJSON(&req) // optional body
	_, err := h.svc.RecordSuccess(c.Request.Context(), id, tenantID, req.ResponseTimeMs)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		if err == service.ErrDisabled {
			goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "success recorded"})
}

func (h *Handler) RecordFailure(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	var req models.FailureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	_, err := h.svc.RecordFailure(c.Request.Context(), id, tenantID, req.ErrorMsg)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		if err == service.ErrDisabled {
			goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "failure recorded"})
}

func (h *Handler) GetState(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	resp, err := h.svc.Evaluate(c.Request.Context(), id, tenantID)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, resp)
}

func (h *Handler) GetEvents(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	limit := 20
	_ = c.Query("limit") // optional
	events, err := h.svc.GetRecentEvents(c.Request.Context(), id, tenantID, limit)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, events)
}

func (h *Handler) ListOpen(c *gin.Context) {
	tenantID := h.getTenantID(c)
	entities, err := h.svc.ListOpen(c.Request.Context(), tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"data": entities, "total": len(entities)})
}
