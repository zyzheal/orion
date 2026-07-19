package handler

import (
	"context"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/project/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	Create(ctx context.Context, tenantID, createdBy string, req *models.CreateProjectRequest) (*models.Project, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Project, error)
	List(ctx context.Context, tenantID string) ([]models.Project, error)
	Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateProjectRequest) (*models.Project, error)
	Delete(ctx context.Context, tenantID, id string) error
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/projects")
	f.POST("", auth.RequirePermission("project", "write"), h.Create)
	f.GET("", auth.RequirePermission("project", "read"), h.List)
	f.GET("/:id", auth.RequirePermission("project", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("project", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("project", "delete"), h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	createdBy := c.GetString("user_id")
	var req models.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.Create(c.Request.Context(), tenantID, createdBy, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, p)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")
	var req models.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), updatedBy, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}
