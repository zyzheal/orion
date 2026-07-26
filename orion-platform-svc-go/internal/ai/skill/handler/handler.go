package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/ai/skill/models"
	"orion/platform-svc-go/internal/ai/skill/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for the skill domain.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all skill routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// ---- Skill Packages ----
	skills := rg.Group("/skills")
	skills.POST("", auth.RequirePermission("skill", "write"), h.CreateSkill)
	skills.GET("", h.ListSkills)
	skills.GET("/search", h.SearchSkills)
	skills.GET("/categories", h.GetCategories)
	skills.GET("/pending-review", h.GetPendingReview)
	skills.GET("/featured", h.GetFeaturedSkills)
	skills.GET("/marketplace", h.GetMarketplace)
	skills.GET("/:id", h.GetSkill)
	skills.PUT("/:id", auth.RequirePermission("skill", "write"), h.UpdateSkill)
	skills.DELETE("/:id", auth.RequirePermission("skill", "delete"), h.DeleteSkill)
	skills.POST("/:id/publish", auth.RequirePermission("skill", "execute"), h.PublishSkill)
	skills.POST("/:id/install", auth.RequirePermission("skill", "write"), h.InstallSkill)
	skills.POST("/:id/uninstall", auth.RequirePermission("skill", "write"), h.UninstallSkill)
	skills.POST("/:id/rate", auth.RequirePermission("skill", "write"), h.RateSkill)
	skills.POST("/:id/unpublish", auth.RequirePermission("skill", "execute"), h.UnpublishSkill)
	skills.POST("/:id/submit-review", auth.RequirePermission("skill", "write"), h.SubmitForReview)
	skills.POST("/:id/approve", auth.RequirePermission("skill", "execute"), h.ApproveSkill)
	skills.POST("/:id/reject", auth.RequirePermission("skill", "execute"), h.RejectSkill)
	skills.POST("/:id/archive", auth.RequirePermission("skill", "write"), h.ArchiveSkill)

	// ---- Versions ----
	skills.GET("/:id/versions", h.GetVersions)
	skills.GET("/:id/versions/latest", h.GetLatestVersion)
	skills.POST("/:id/versions", auth.RequirePermission("skill", "write"), h.CreateVersion)
	skills.POST("/:id/record-version", auth.RequirePermission("skill", "execute"), h.RecordVersion)
	// Version lock/unlock use version ID directly
	rg.POST("/versions/:vid/lock", auth.RequirePermission("skill", "write"), h.LockVersion)
	rg.POST("/versions/:vid/unlock", auth.RequirePermission("skill", "write"), h.UnlockVersion)

	// ---- Reviews ----
	skills.GET("/:id/reviews", h.GetReviews)
	skills.POST("/:id/reviews", auth.RequirePermission("skill", "write"), h.AddReview)

	// ---- Instances ----
	skills.POST("/:id/instances", auth.RequirePermission("skill", "write"), h.CreateInstance)
	skills.GET("/:id/instances", h.ListInstances)
	rg.GET("/instances/:iid", h.GetInstance)
	rg.PUT("/instances/:iid", auth.RequirePermission("skill", "write"), h.UpdateInstance)
	rg.DELETE("/instances/:iid", auth.RequirePermission("skill", "delete"), h.DeleteInstance)
	rg.GET("/instances", h.ListInstancesByTenant)

	// ---- Executions ----
	skills.POST("/:id/execute", auth.RequirePermission("skill", "execute"), h.ExecuteSkill)
	skills.GET("/:id/executions", h.GetExecutions)
	rg.GET("/executions", h.GetAllExecutions)
	rg.PUT("/executions/:eid", auth.RequirePermission("skill", "write"), h.UpdateExecution)

	// ---- Audit Logs ----
	skills.GET("/:id/audit-logs", h.GetAuditLog)
	rg.GET("/audit-logs", h.GetAllAuditLogs)
}

// =====================================================================
// Skill Package handlers
// =====================================================================

func (h *Handler) CreateSkill(c *gin.Context) {
	var req models.CreateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.CreateSkill(c.Request.Context(), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, skill)
}

func (h *Handler) ListSkills(c *gin.Context) {
	opts := service.ListSkillsOptions{
		Page:     queryInt(c, "page", 1),
		Limit:    queryInt(c, "limit", 20),
		Status:   c.Query("status"),
		Category: c.Query("category"),
	}
	if tags := c.QueryArray("tags"); len(tags) > 0 {
		opts.Tags = tags
	}
	result, err := h.svc.ListSkills(c.Request.Context(), opts)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetSkill(c *gin.Context) {
	skill, err := h.svc.GetSkill(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) UpdateSkill(c *gin.Context) {
	var req models.UpdateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.UpdateSkill(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) DeleteSkill(c *gin.Context) {
	if err := h.svc.UninstallSkill(c.Request.Context(), c.Param("id")); err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) PublishSkill(c *gin.Context) {
	skill, err := h.svc.PublishSkill(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) InstallSkill(c *gin.Context) {
	if err := h.svc.InstallSkill(c.Request.Context(), c.Param("id")); err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "installed"})
}

// UninstallSkill decrements the install counter (POST /:id/uninstall).
// Distinct from DELETE /:id (soft-delete of the package itself).
func (h *Handler) UninstallSkill(c *gin.Context) {
	if err := h.svc.UninstallSkillSoft(c.Request.Context(), c.Param("id")); err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "uninstalled"})
}

// RateSkill is a POST /:id/rate endpoint that extracts user_id from the JWT claim.
// It forwards to AddReview after validating the rating range.
func (h *Handler) RateSkill(c *gin.Context) {
	var body struct {
		Rating  int    `json:"rating" binding:"required"`
		Comment string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	review := &models.CreateReviewRequest{
		UserID:  c.GetString("user_id"),
		Rating:  body.Rating,
		Comment: body.Comment,
	}
	r, err := h.svc.AddReview(c.Request.Context(), c.Param("id"), review)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, r)
}

// UnpublishSkill toggles a published skill back to draft (disable).
func (h *Handler) UnpublishSkill(c *gin.Context) {
	userID := c.GetString("user_id")
	skill, err := h.svc.UnpublishSkill(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) SearchSkills(c *gin.Context) {
	query := c.Query("q")
	limit := queryInt(c, "limit", 20)
	skills, err := h.svc.SearchSkills(c.Request.Context(), query, limit)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skills)
}

func (h *Handler) GetCategories(c *gin.Context) {
	cats, err := h.svc.GetCategories(c.Request.Context())
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, cats)
}

func (h *Handler) GetPendingReview(c *gin.Context) {
	skills, total, totalPages, err := h.svc.GetPendingReview(
		c.Request.Context(),
		queryInt(c, "page", 1),
		queryInt(c, "limit", 20),
		c.Query("category"),
	)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"data": skills, "total": total, "total_pages": totalPages})
}

func (h *Handler) GetFeaturedSkills(c *gin.Context) {
	skills, err := h.svc.GetFeaturedSkills(c.Request.Context(), queryInt(c, "limit", 10))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skills)
}

func (h *Handler) GetMarketplace(c *gin.Context) {
	result, err := h.svc.GetMarketplace(c.Request.Context(), service.ListSkillsOptions{
		Page:     queryInt(c, "page", 1),
		Limit:    queryInt(c, "limit", 20),
		Category: c.Query("category"),
	})
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, result)
}

// =====================================================================
// Review Workflow handlers
// =====================================================================

func (h *Handler) SubmitForReview(c *gin.Context) {
	userID := c.GetString("user_id")
	skill, err := h.svc.SubmitForReview(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) ApproveSkill(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&body)
	skill, err := h.svc.ApproveSkill(c.Request.Context(), c.Param("id"), userID, body.Reason)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) RejectSkill(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	skill, err := h.svc.RejectSkill(c.Request.Context(), c.Param("id"), userID, body.Reason)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

func (h *Handler) ArchiveSkill(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&body)
	skill, err := h.svc.ArchiveSkill(c.Request.Context(), c.Param("id"), userID, body.Reason)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, skill)
}

// =====================================================================
// Version handlers
// =====================================================================

func (h *Handler) GetVersions(c *gin.Context) {
	versions, err := h.svc.GetVersions(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, versions)
}

func (h *Handler) GetLatestVersion(c *gin.Context) {
	v, err := h.svc.GetLatestVersion(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, v)
}

func (h *Handler) CreateVersion(c *gin.Context) {
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	v, err := h.svc.CreateVersion(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, v)
}

func (h *Handler) RecordVersion(c *gin.Context) {
	var body struct {
		Version   string `json:"version" binding:"required"`
		Changelog string `json:"changelog"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	v, err := h.svc.RecordVersion(c.Request.Context(), c.Param("id"), body.Version, body.Changelog)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, v)
}

func (h *Handler) LockVersion(c *gin.Context) {
	v, err := h.svc.LockVersion(c.Request.Context(), c.Param("vid"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, v)
}

func (h *Handler) UnlockVersion(c *gin.Context) {
	v, err := h.svc.UnlockVersion(c.Request.Context(), c.Param("vid"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, v)
}

// =====================================================================
// Review handlers
// =====================================================================

func (h *Handler) GetReviews(c *gin.Context) {
	reviews, err := h.svc.GetReviews(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, reviews)
}

func (h *Handler) AddReview(c *gin.Context) {
	var req models.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	review, err := h.svc.AddReview(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, review)
}

// =====================================================================
// Instance handlers
// =====================================================================

func (h *Handler) CreateInstance(c *gin.Context) {
	var req models.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Skill ID comes from the URL param
	req.SkillID = c.Param("id")
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}
	inst, err := h.svc.CreateInstance(c.Request.Context(), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, inst)
}

func (h *Handler) ListInstances(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	instances, err := h.svc.ListInstances(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, instances)
}

func (h *Handler) GetInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	inst, err := h.svc.GetInstance(c.Request.Context(), c.Param("iid"), tenantID)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, inst)
}

func (h *Handler) UpdateInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.UpdateInstance(c.Request.Context(), c.Param("iid"), tenantID, &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, inst)
}

func (h *Handler) DeleteInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteInstance(c.Request.Context(), c.Param("iid"), tenantID); err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) ListInstancesByTenant(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	instances, total, err := h.svc.ListInstancesByTenant(
		c.Request.Context(), tenantID,
		queryInt(c, "limit", 50),
		queryInt(c, "offset", 0),
	)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"data": instances, "total": total})
}

// =====================================================================
// Execution handlers
// =====================================================================

func (h *Handler) ExecuteSkill(c *gin.Context) {
	var req models.CreateExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.SkillID = c.Param("id")
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}
	exec, err := h.svc.ExecuteSkill(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondCreated(c, exec)
}

func (h *Handler) GetExecutions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	execs, total, totalPages, err := h.svc.GetExecutions(
		c.Request.Context(), c.Param("id"), tenantID,
		queryInt(c, "page", 1),
		queryInt(c, "limit", 20),
	)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"data": execs, "total": total, "total_pages": totalPages})
}

func (h *Handler) GetAllExecutions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	execs, total, totalPages, err := h.svc.GetAllExecutions(
		c.Request.Context(), tenantID,
		queryInt(c, "page", 1),
		queryInt(c, "limit", 20),
		c.Query("skill_id"),
	)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"data": execs, "total": total, "total_pages": totalPages})
}

func (h *Handler) UpdateExecution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	exec, err := h.svc.UpdateExecution(c.Request.Context(), tenantID, c.Param("eid"), &req)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, exec)
}

// =====================================================================
// Audit Log handlers
// =====================================================================

func (h *Handler) GetAuditLog(c *gin.Context) {
	logs, total, totalPages, err := h.svc.GetAuditLog(
		c.Request.Context(), c.Param("id"),
		queryInt(c, "page", 1),
		queryInt(c, "limit", 50),
	)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"data": logs, "total": total, "total_pages": totalPages})
}

func (h *Handler) GetAllAuditLogs(c *gin.Context) {
	logs, total, totalPages, err := h.svc.GetAllAuditLogs(
		c.Request.Context(),
		queryInt(c, "page", 1),
		queryInt(c, "limit", 50),
		c.Query("action"),
	)
	if err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"data": logs, "total": total, "total_pages": totalPages})
}

// =====================================================================
// Helpers
// =====================================================================

func queryInt(c *gin.Context, key string, def int) int {
	v, err := strconv.Atoi(c.DefaultQuery(key, strconv.Itoa(def)))
	if err != nil {
		return def
	}
	return v
}

func mapError(c *gin.Context, err error) {
	switch err {
	case service.ErrSkillNotFound, service.ErrInstanceNotFound,
		service.ErrExecutionNotFound, service.ErrVersionNotFound:
		respondNotFound(c, err.Error())
	case service.ErrDuplicateName:
		respondConflict(c, err.Error())
	case service.ErrInvalidInput, service.ErrInvalidRating, service.ErrRejectionReasonReq:
		respondBadRequest(c, err.Error())
	case service.ErrInvalidState, service.ErrVersionLocked:
		respondBadRequest(c, err.Error())
	case service.ErrTenantMismatch:
		respondForbidden(c, err.Error())
	default:
		respondInternalError(c, err.Error())
	}
}
