package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/skill/models"
	"orion/platform-svc-go/internal/skill/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
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
	tenantID := c.GetString("tenant_id")
	category := c.Query("category")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	skills, total := h.svc.ListSkills(c.Request.Context(), tenantID, category, status, page, limit)
	middleware.RespondSuccess(c, gin.H{"skills": skills, "total": total})
}

func (h *Handler) CreateSkill(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.CreateSkill(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, skill)
}

func (h *Handler) GetSkill(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	skill, err := h.svc.GetSkill(c.Request.Context(), tenantID, id)
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.UpdateSkill(c.Request.Context(), tenantID, id, req)
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteSkill(c.Request.Context(), tenantID, id); err != nil {
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
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ==================== Version management ====================

func (h *Handler) ListVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	versions, err := h.svc.ListVersions(c.Request.Context(), tenantID, skillID)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	var req models.AddVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	version, err := h.svc.AddVersion(c.Request.Context(), tenantID, skillID, req)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.RateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.RateSkill(c.Request.Context(), tenantID, skillID, userID, req)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	stats, err := h.svc.GetRatingStats(c.Request.Context(), tenantID, skillID)
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
	tenantID := c.GetString("tenant_id")
	instances, err := h.svc.ListInstances(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, instances)
}

func (h *Handler) CreateInstance(c *gin.Context) {
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
	inst, err := h.svc.CreateInstance(c.Request.Context(), tenantID, req.SkillID, models.CreateInstanceRequest{
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	inst, err := h.svc.GetInstance(c.Request.Context(), tenantID, id)
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.UpdateInstance(c.Request.Context(), tenantID, id, req)
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteInstance(c.Request.Context(), tenantID, id); err != nil {
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.ExecuteSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	execution, err := h.svc.ExecuteSkill(c.Request.Context(), tenantID, skillID, userID, req)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	executions, err := h.svc.ListExecutions(c.Request.Context(), tenantID, skillID, page, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, executions)
}

// ==================== Review workflow ====================

func (h *Handler) GetReview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	review, err := h.svc.GetReview(c.Request.Context(), tenantID, skillID)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	review, err := h.svc.ReviewAction(c.Request.Context(), tenantID, skillID, userID, "submit", models.ReviewActionRequest{})
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.ReviewActionRequest
	c.ShouldBindJSON(&req)
	review, err := h.svc.ReviewAction(c.Request.Context(), tenantID, skillID, userID, "approve", req)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	// This is a POST with review action, so it needs a body
	userID := c.GetString("user_id")
	var req models.ReviewActionRequest
	c.ShouldBindJSON(&req)
	review, err := h.svc.ReviewAction(c.Request.Context(), tenantID, skillID, userID, "reject", req)
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
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	userID := c.GetString("user_id")
	var req models.ReviewActionRequest
	c.ShouldBindJSON(&req)
	review, err := h.svc.ReviewAction(c.Request.Context(), tenantID, skillID, userID, "archive", req)
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
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	reviews, err := h.svc.ListReviews(c.Request.Context(), tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, reviews)
}

// ==================== Audit log ====================

func (h *Handler) GetAuditLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	skillID := c.Param("skillId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	logs, total := h.svc.ListAuditLogs(c.Request.Context(), tenantID, skillID, page, limit)
	middleware.RespondSuccess(c, gin.H{"audit_logs": logs, "total": total})
}
