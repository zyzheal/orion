package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/release-management/models"
	"orion/platform-svc-go/internal/release-management/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	releases := rg.Group("/releases")
	releases.Use(auth.RequirePermission("release", "read"))
	{
		releases.POST("", auth.RequirePermission("release", "write"), h.Create)
		releases.GET("", h.List)
		releases.GET("/:id", h.Get)
		releases.PUT("/:id", auth.RequirePermission("release", "write"), h.Update)
		releases.DELETE("/:id", auth.RequirePermission("release", "delete"), h.Delete)
		releases.POST("/:id/approve", auth.RequirePermission("release", "approve"), h.Approve)
		releases.POST("/:id/deploy", auth.RequirePermission("release", "deploy"), h.Deploy)
		releases.POST("/:id/rollback", auth.RequirePermission("release", "rollback"), h.Rollback)
	}
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, release)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	release, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	q := models.ListReleasesQuery{
		Page:       page,
		PageSize:   pageSize,
		PipelineID: c.Query("pipelineId"),
	}
	result, err := h.svc.List(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Approve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	userID := c.GetString("user_id")
	var req struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&req)
	approval, err := h.svc.Approve(c.Request.Context(), tenantID, id, userID, req.Comment)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, approval)
}

func (h *Handler) Deploy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	userID := c.GetString("user_id")
	release, err := h.svc.Deploy(c.Request.Context(), tenantID, id, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}

func (h *Handler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	userID := c.GetString("user_id")
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	release, err := h.svc.Rollback(c.Request.Context(), tenantID, id, req.Reason, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, release)
}