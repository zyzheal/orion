package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	goerr "orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/project-member/models"
	"orion/platform-svc-go/internal/project-member/service"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/project-members")
	r.GET("", auth.RequirePermission("project_member", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("project_member", "read"), h.Get)
	r.POST("", auth.RequirePermission("project_member", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("project_member", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("project_member", "delete"), h.Delete)
	r.GET("/by-project/:projectID", auth.RequirePermission("project_member", "read"), h.ListByProject)
	r.GET("/by-project/:projectID/count", auth.RequirePermission("project_member", "read"), h.CountByProject)
	r.GET("/role-check", auth.RequirePermission("project_member", "read"), h.CheckRole)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	q := models.ListMembersQuery{ProjectID: c.Query("project_id"), UserID: c.Query("user_id"), Role: c.Query("role"), Status: c.Query("status"), Limit: &limit, Offset: &offset}
	items, total, err := h.svc.ListMembers(ctx, tenantID, q)
	if err != nil { goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500); return }
	goerr.WriteSuccess(c, gin.H{"data": items, "total": total})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id"); id := c.Param("id")
	item, err := h.svc.GetMember(ctx, tenantID, id)
	if err != nil { goerr.WriteError(c, goerr.ErrNotFound, "not found", 404); return }
	goerr.WriteSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateProjectMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil { goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400); return }
	item, err := h.svc.CreateMember(ctx, tenantID, req)
	if err != nil {
		switch err {
		case service.ErrBadRequest, service.ErrInvalidRole: goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		case service.ErrDuplicateMember: goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 409)
		default: goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		}
		return
	}
	goerr.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id"); id := c.Param("id")
	var req models.UpdateProjectMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil { goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400); return }
	item, err := h.svc.UpdateMember(ctx, tenantID, id, req)
	if err != nil { goerr.WriteError(c, goerr.ErrNotFound, "not found", 404); return }
	goerr.WriteSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id"); id := c.Param("id")
	if err := h.svc.DeleteMember(ctx, tenantID, id); err != nil { goerr.WriteError(c, goerr.ErrNotFound, "not found", 404); return }
	goerr.WriteSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) ListByProject(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListByProject")
	defer span.End()
	tenantID := c.GetString("tenant_id"); projectID := c.Param("projectID")
	items, err := h.svc.ListByProject(ctx, tenantID, projectID)
	if err != nil { goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500); return }
	goerr.WriteSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) CountByProject(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountByProject")
	defer span.End()
	tenantID := c.GetString("tenant_id"); projectID := c.Param("projectID")
	count, err := h.svc.CountByProject(ctx, tenantID, projectID)
	if err != nil { goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500); return }
	goerr.WriteSuccess(c, gin.H{"count": count})
}

func (h *Handler) CheckRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckRole")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.CheckRole(ctx, tenantID, c.Query("project_id"), c.Query("user_id"), c.Query("role"))
	if err != nil { goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500); return }
	goerr.WriteSuccess(c, gin.H{"has_role": result})
}
