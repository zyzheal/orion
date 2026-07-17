package handler

import (
        "context"
        "errors"
	"orion/platform-svc-go/internal/middleware"

        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/pipeline-versions/models"
        "orion/platform-svc-go/internal/pipeline-versions/service"

        "github.com/gin-gonic/gin"
	"strconv"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
        CreateVersion(ctx context.Context, tenantID, pipelineID string, req *models.CreateVersionRequest, createdBy string) (*models.Version, error)
        GetVersion(ctx context.Context, tenantID, versionID string) (*models.Version, error)
        ListVersions(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*models.VersionListResult, error)
        UpdateVersion(ctx context.Context, tenantID, versionID string, req *models.UpdateVersionRequest) (*models.Version, error)
        DeleteVersion(ctx context.Context, tenantID, versionID string) error
        PublishVersion(ctx context.Context, tenantID, versionID string, req *models.PublishVersionRequest) (*models.Version, error)
        DeprecateVersion(ctx context.Context, tenantID, versionID string) (*models.Version, error)
        RollbackVersion(ctx context.Context, tenantID, pipelineID string, req *models.RollbackVersionRequest) (*models.Version, error)
        CompareVersions(ctx context.Context, tenantID string, req *models.CompareVersionsRequest) (*models.CompareResult, error)
}

type Handler struct {
        svc Service
}

func NewHandler(svc Service) *Handler {
        return &Handler{svc: svc}
}

// RegisterRoutes registers pipeline-versions endpoints under the given group.
// Routes follow the TS source pattern: /pipelines/:pipelineId/versions/...
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        rg.GET("/pipelines/:pipelineId/versions", auth.RequirePermission("pipeline_versions", "read"), h.ListVersions)
        rg.GET("/pipelines/:pipelineId/versions/:versionId", auth.RequirePermission("pipeline_versions", "read"), h.GetVersion)
        rg.POST("/pipelines/:pipelineId/versions", auth.RequirePermission("pipeline_versions", "write"), h.CreateVersion)
        rg.PUT("/pipelines/:pipelineId/versions/:versionId", auth.RequirePermission("pipeline_versions", "write"), h.UpdateVersion)
        rg.DELETE("/pipelines/:pipelineId/versions/:versionId", auth.RequirePermission("pipeline_versions", "delete"), h.DeleteVersion)
        rg.POST("/pipelines/:pipelineId/versions/:versionId/publish", auth.RequirePermission("pipeline_versions", "write"), h.PublishVersion)
        rg.POST("/pipelines/:pipelineId/versions/:versionId/deprecate", auth.RequirePermission("pipeline_versions", "delete"), h.DeprecateVersion)
        rg.POST("/pipelines/:pipelineId/versions/rollback", auth.RequirePermission("pipeline_versions", "write"), h.RollbackVersion)
        rg.POST("/pipelines/:pipelineId/versions/compare", auth.RequirePermission("pipeline_versions", "read"), h.CompareVersions)
}

// ==================== Version CRUD ====================

func (h *Handler) ListVersions(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        pipelineID := c.Param("pipelineId")

        q := &models.ListQuery{Limit: 20, Order: "DESC", Sort: "created_at"}
        if status := c.Query("status"); status != "" {
                q.Status = (*models.VersionStatus)(&status)
        }
        if tags := c.Query("tags"); tags != "" {
                q.Tags = &tags
        }
        if limit := c.Query("limit"); limit != "" {
                q.Limit = parseInt(limit, 20)
        }
        if offset := c.Query("offset"); offset != "" {
                q.Offset = parseInt(offset, 0)
        }
        if sort := c.Query("sort"); sort != "" {
                q.Sort = sort
        }
        if order := c.Query("order"); order != "" {
                q.Order = order
        }

        result, err := h.svc.ListVersions(c.Request.Context(), tenantID, pipelineID, q)
        if err != nil {
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

func (h *Handler) GetVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        versionID := c.Param("versionId")

        result, err := h.svc.GetVersion(c.Request.Context(), tenantID, versionID)
        if err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        pipelineID := c.Param("pipelineId")
        userID := c.GetString("user_id")
        if userID == "" {
                userID = "system"
        }

        var req models.CreateVersionRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                middleware.RespondBadRequest(c, err.Error())
                return
        }

        result, err := h.svc.CreateVersion(c.Request.Context(), tenantID, pipelineID, &req, userID)
        if err != nil {
                if service.IsBadRequest(err) {
                        middleware.RespondBadRequest(c, err.Error())
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondCreated(c, result)
}

func (h *Handler) UpdateVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        versionID := c.Param("versionId")

        var req models.UpdateVersionRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                middleware.RespondBadRequest(c, err.Error())
                return
        }

        result, err := h.svc.UpdateVersion(c.Request.Context(), tenantID, versionID, &req)
        if err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                if service.IsLocked(err) {
                        middleware.RespondBadRequest(c, "cannot update published version")
                        return
                }
                if service.IsBadRequest(err) {
                        middleware.RespondBadRequest(c, err.Error())
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        versionID := c.Param("versionId")

        if err := h.svc.DeleteVersion(c.Request.Context(), tenantID, versionID); err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, gin.H{"message": "version deleted"})
}

// ==================== Lifecycle ====================

func (h *Handler) PublishVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        versionID := c.Param("versionId")

        var req models.PublishVersionRequest
        _ = c.ShouldBindJSON(&req) // body optional

        result, err := h.svc.PublishVersion(c.Request.Context(), tenantID, versionID, &req)
        if err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                if service.IsBadRequest(err) || errors.Is(err, service.ErrAlreadyPublished) {
                        middleware.RespondBadRequest(c, err.Error())
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

func (h *Handler) DeprecateVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        versionID := c.Param("versionId")

        result, err := h.svc.DeprecateVersion(c.Request.Context(), tenantID, versionID)
        if err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

func (h *Handler) RollbackVersion(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        pipelineID := c.Param("pipelineId")

        var req models.RollbackVersionRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                middleware.RespondBadRequest(c, err.Error())
                return
        }

        result, err := h.svc.RollbackVersion(c.Request.Context(), tenantID, pipelineID, &req)
        if err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                if service.IsBadRequest(err) || errors.Is(err, service.ErrNoRollbackTarget) {
                        middleware.RespondBadRequest(c, err.Error())
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

// ==================== Compare ====================

func (h *Handler) CompareVersions(c *gin.Context) {
        tenantID := c.GetString("tenant_id")

        var req models.CompareVersionsRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                middleware.RespondBadRequest(c, err.Error())
                return
        }

        result, err := h.svc.CompareVersions(c.Request.Context(), tenantID, &req)
        if err != nil {
                if service.IsNotFound(err) {
                        middleware.RespondNotFound(c, "version not found")
                        return
                }
                if service.IsBadRequest(err) {
                        middleware.RespondBadRequest(c, err.Error())
                        return
                }
                middleware.RespondInternalError(c, err.Error())
                return
        }
        middleware.RespondSuccess(c, result)
}

func parseInt(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return n
}
