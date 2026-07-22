package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/skill/models"
	"orion/platform-svc-go/internal/skill/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all skill endpoints under the /skill group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/skill")

	// === Skill CRUD ===
	f.GET("", auth.RequirePermission("skill", "read"), h.ListSkills)
	f.POST("", auth.RequirePermission("skill", "write"), h.CreateSkill)
	f.GET("/stats", auth.RequirePermission("skill", "read"), h.GetStats)
	f.GET("/:id", auth.RequirePermission("skill", "read"), h.GetSkill)
	f.PUT("/:id", auth.RequirePermission("skill", "write"), h.UpdateSkill)
	f.DELETE("/:id", auth.RequirePermission("skill", "delete"), h.DeleteSkill)

	// === Version management ===
	f.GET("/:skillId/versions", auth.RequirePermission("skill", "read"), h.ListVersions)
	f.POST("/:skillId/versions", auth.RequirePermission("skill", "write"), h.AddVersion)

	// === Rating ===
	f.POST("/:skillId/rate", auth.RequirePermission("skill", "write"), h.RateSkill)
	f.GET("/:skillId/rating", auth.RequirePermission("skill", "read"), h.GetRatingStats)

	// === Instances ===
	f.GET("/instances", auth.RequirePermission("skill", "read"), h.ListInstances)
	f.POST("/instances", auth.RequirePermission("skill", "write"), h.CreateInstance)
	f.GET("/instances/:id", auth.RequirePermission("skill", "read"), h.GetInstance)
	f.PUT("/instances/:id", auth.RequirePermission("skill", "write"), h.UpdateInstance)
	f.DELETE("/instances/:id", auth.RequirePermission("skill", "delete"), h.DeleteInstance)

	// === Execution ===
	f.POST("/:skillId/execute", auth.RequirePermission("skill", "write"), h.ExecuteSkill)
	f.GET("/:skillId/executions", auth.RequirePermission("skill", "read"), h.ListExecutions)

	// === Review workflow ===
	f.GET("/:skillId/review", auth.RequirePermission("skill", "read"), h.GetReview)
	f.POST("/:skillId/review/submit", auth.RequirePermission("skill", "write"), h.SubmitReview)
	f.POST("/:skillId/review/approve", auth.RequirePermission("skill", "write"), h.ApproveReview)
	f.POST("/:skillId/review/reject", auth.RequirePermission("skill", "write"), h.RejectReview)
	f.POST("/:skillId/review/archive", auth.RequirePermission("skill", "delete"), h.ArchiveReview)
	f.GET("/reviews", auth.RequirePermission("skill", "read"), h.ListReviews)

	// === Audit log ===
	f.GET("/:skillId/audit", auth.RequirePermission("skill", "read"), h.GetAuditLogs)
}

// ==================== Skill CRUD ====================

func (h *Handler) ListSkills(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSkills")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	category := c.Query("category")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	skills, total := h.svc.ListSkills(ctx, tenantID, category, status, page, limit)
	middleware.RespondSuccess(c, gin.H{"skills": skills, "total": total})
}

func (h *Handler) CreateSkill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSkill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.CreateSkill(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, skill)
}

func (h *Handler) GetSkill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSkill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	skill, err := h.svc.GetSkill(ctx, tenantID, id)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, skill)
}

func (h *Handler) UpdateSkill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSkill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.UpdateSkill(ctx, tenantID, id, req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, skill)
}

func (h *Handler) DeleteSkill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSkill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteSkill(ctx, tenantID, id); err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "skill deleted"})
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ==================== Version management ====================

func (h *Handler) ListVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	versions, err := h.svc.ListVersions(ctx, tenantID, skillID)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, versions)
}

func (h *Handler) AddVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	var req models.AddVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	version, err := h.svc.AddVersion(ctx, tenantID, skillID, req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		if err == service.ErrDuplicateVersion {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, version)
}

// ==================== Rating ====================

func (h *Handler) RateSkill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RateSkill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.RateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.RateSkill(ctx, tenantID, skillID, userID, req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"skill": skill, "message": "rating submitted"})
}

func (h *Handler) GetRatingStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRatingStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	stats, err := h.svc.GetRatingStats(ctx, tenantID, skillID)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ==================== Instances ====================

func (h *Handler) ListInstances(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListInstances")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	instances, err := h.svc.ListInstances(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, instances)
}

func (h *Handler) CreateInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		SkillID      string `json:"skill_id" binding:"required"`
		InstanceName string `json:"instance_name" binding:"required"`
		Config       string `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.CreateInstance(ctx, tenantID, req.SkillID, models.CreateInstanceRequest{
		InstanceName: req.InstanceName,
		Config:       req.Config,
	})
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, inst)
}

func (h *Handler) GetInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	inst, err := h.svc.GetInstance(ctx, tenantID, id)
	if err != nil {
		if err == service.ErrInstanceNotFound {
			middleware.RespondNotFound(c, "skill instance not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

func (h *Handler) UpdateInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.UpdateInstance(ctx, tenantID, id, req)
	if err != nil {
		if err == service.ErrInstanceNotFound {
			middleware.RespondNotFound(c, "skill instance not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

func (h *Handler) DeleteInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteInstance(ctx, tenantID, id); err != nil {
		if err == service.ErrInstanceNotFound {
			middleware.RespondNotFound(c, "skill instance not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "skill instance deleted"})
}

// ==================== Execution ====================

func (h *Handler) ExecuteSkill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteSkill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.ExecuteSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	execution, err := h.svc.ExecuteSkill(ctx, tenantID, skillID, userID, req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, execution)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExecutions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	executions, err := h.svc.ListExecutions(ctx, tenantID, skillID, page, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, executions)
}

// ==================== Review workflow ====================

func (h *Handler) GetReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	review, err := h.svc.GetReview(ctx, tenantID, skillID)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if review == nil {
		middleware.RespondSuccess(c, gin.H{"review": nil})
		return
	}
	middleware.RespondSuccess(c, review)
}

func (h *Handler) SubmitReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SubmitReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	review, err := h.svc.ReviewAction(ctx, tenantID, skillID, userID, "submit", models.ReviewActionRequest{})
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		if err == service.ErrAlreadySubmitted {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"review": review, "message": "skill submitted for review"})
}

func (h *Handler) ApproveReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.ReviewActionRequest
	c.ShouldBindJSON(&req)
	review, err := h.svc.ReviewAction(ctx, tenantID, skillID, userID, "approve", req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		if err == service.ErrNotSubmitted {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"review": review, "message": "skill approved"})
}

func (h *Handler) RejectReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	// This is a POST with review action, so it needs a body
	userID := c.GetString("user_id")
	var req models.ReviewActionRequest
	c.ShouldBindJSON(&req)
	review, err := h.svc.ReviewAction(ctx, tenantID, skillID, userID, "reject", req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		if err == service.ErrNotSubmitted {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"review": review, "message": "skill rejected"})
}

func (h *Handler) ArchiveReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArchiveReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.ReviewActionRequest
	c.ShouldBindJSON(&req)
	review, err := h.svc.ReviewAction(ctx, tenantID, skillID, userID, "archive", req)
	if err != nil {
		if err == service.ErrSkillNotFound {
			middleware.RespondNotFound(c, "skill not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"review": review, "message": "skill archived"})
}

func (h *Handler) ListReviews(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReviews")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	reviews, err := h.svc.ListReviews(ctx, tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, reviews)
}

// ==================== Audit log ====================

func (h *Handler) GetAuditLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	logs, total := h.svc.ListAuditLogs(ctx, tenantID, skillID, page, limit)
	middleware.RespondSuccess(c, gin.H{"audit_logs": logs, "total": total})
}
