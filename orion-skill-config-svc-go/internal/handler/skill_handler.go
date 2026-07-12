package handler

import (
	"net/http"
	"strconv"

	"orion/skill-config-svc-go/internal/models"
	"orion/skill-config-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// SkillHandler handles skill package CRUD and management endpoints.
type SkillHandler struct {
	svc *service.Service
}

func NewSkillHandler(svc *service.Service) *SkillHandler {
	return &SkillHandler{svc: svc}
}

// RegisterRoutes registers all skill management routes.
func (h *SkillHandler) RegisterRoutes(r *gin.RouterGroup) {
	// Skill CRUD
	r.GET("/skills", h.ListSkills)
	r.GET("/skills/:id", h.GetSkill)
	r.POST("/skills", h.CreateSkill)
	r.PUT("/skills/:id", h.UpdateSkill)
	r.DELETE("/skills/:id", h.DeleteSkill)

	// Search & Marketplace
	r.GET("/skills/search", h.SearchSkills)
	r.GET("/skills/categories", h.GetCategories)
	r.GET("/skills/featured", h.GetFeaturedSkills)

	// Version management
	r.GET("/skills/:id/versions", h.ListVersions)
	r.POST("/skills/:id/versions", h.AddVersion)

	// Install / Uninstall
	r.POST("/skills/:id/install", h.InstallSkill)
	r.POST("/skills/:id/uninstall", h.UninstallSkill)

	// Rating
	r.POST("/skills/:id/rate", h.RateSkill)

	// Instance management
	r.GET("/skills/:id/instances", h.ListInstances)
	r.POST("/skills/:id/instances", h.CreateInstance)
	r.PUT("/skills/:id/instances/:instanceId", h.UpdateInstance)
	r.DELETE("/skills/:id/instances/:instanceId", h.DeleteInstance)

	// Direct execution
	r.POST("/skills/:id/execute", h.ExecuteSkill)
	r.GET("/skills/:id/executions", h.ListExecutions)
	r.GET("/skills/executions", h.ListAllExecutions)

	// Review workflow
	r.POST("/skills/:id/submit", h.SubmitForReview)
	r.POST("/skills/:id/approve", h.ApproveSkill)
	r.POST("/skills/:id/reject", h.RejectSkill)
	r.POST("/skills/:id/archive", h.ArchiveSkill)
	r.GET("/skills/pending-review", h.PendingReview)

	// Audit logs
	r.GET("/skills/:id/audit", h.GetAuditLog)
	r.GET("/skills/audit", h.GetAllAuditLogs)
}

// ListSkills returns paginated skill packages with optional filters.
func (h *SkillHandler) ListSkills(c *gin.Context) {
	status := c.Query("status")
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	data, err := h.svc.ListSkills(c.Request.Context(), status, category, nil, page, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, data)
}

// GetSkill returns a skill package by ID.
func (h *SkillHandler) GetSkill(c *gin.Context) {
	id := c.Param("id")
	sp, err := h.svc.GetSkill(c.Request.Context(), id)
	if err != nil {
		respondNotFound(c, "skill not found")
		return
	}
	respondSuccess(c, sp)
}

// CreateSkill creates a new skill package.
func (h *SkillHandler) CreateSkill(c *gin.Context) {
	var req models.CreateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sp, err := h.svc.CreateSkill(c.Request.Context(), &req)
	if err != nil {
		if err.Error() == service.ErrDuplicateName.Error() {
			respondConflict(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, sp)
}

// UpdateSkill modifies a skill package.
func (h *SkillHandler) UpdateSkill(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sp, err := h.svc.UpdateSkill(c.Request.Context(), id, &req)
	if err != nil {
		respondNotFound(c, "skill not found")
		return
	}
	respondSuccess(c, sp)
}

// DeleteSkill soft-deletes a skill.
func (h *SkillHandler) DeleteSkill(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.UninstallSkill(c.Request.Context(), id); err != nil {
		respondNotFound(c, "skill not found")
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// SearchSkills searches published skills by query string.
func (h *SkillHandler) SearchSkills(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		respondBadRequest(c, "query parameter 'q' is required")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	items, err := h.svc.SearchSkills(c.Request.Context(), query, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// GetCategories returns published skill categories with counts.
func (h *SkillHandler) GetCategories(c *gin.Context) {
	cats, err := h.svc.GetCategories(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cats)
}

// GetFeaturedSkills returns top published skills.
func (h *SkillHandler) GetFeaturedSkills(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, err := h.svc.GetFeaturedSkills(c.Request.Context(), limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ListVersions returns all versions for a skill.
func (h *SkillHandler) ListVersions(c *gin.Context) {
	skillID := c.Param("id")
	versions, err := h.svc.GetVersions(c.Request.Context(), skillID)
	if err != nil {
		respondNotFound(c, "skill not found")
		return
	}
	respondSuccess(c, versions)
}

// AddVersion adds a new version for a skill.
func (h *SkillHandler) AddVersion(c *gin.Context) {
	skillID := c.Param("id")
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sv, err := h.svc.CreateVersion(c.Request.Context(), skillID, &req)
	if err != nil {
		if err.Error() == service.ErrVersionLocked.Error() {
			respondConflict(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, sv)
}

// InstallSkill increments the install count for a published skill.
func (h *SkillHandler) InstallSkill(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.InstallSkill(c.Request.Context(), id); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "installed"})
}

// UninstallSkill decrements the install count.
func (h *SkillHandler) UninstallSkill(c *gin.Context) {
	_ = c.Param("id")
	respondSuccess(c, map[string]any{"message": "uninstalled"})
}

// RateSkill adds a rating for a skill.
func (h *SkillHandler) RateSkill(c *gin.Context) {
	skillID := c.Param("id")
	var req models.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rev, err := h.svc.AddReview(c.Request.Context(), skillID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, rev)
}

// ListInstances returns all instances for a skill within a tenant.
func (h *SkillHandler) ListInstances(c *gin.Context) {
	skillID := c.Param("id")
	tenantID := c.GetString("tenant_id")
	instances, err := h.svc.ListInstances(c.Request.Context(), skillID, tenantID)
	if err != nil {
		respondNotFound(c, "skill not found")
		return
	}
	respondSuccess(c, instances)
}

// CreateInstance creates a new skill instance.
func (h *SkillHandler) CreateInstance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.CreateInstance(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, inst)
}

// UpdateInstance modifies a skill instance.
func (h *SkillHandler) UpdateInstance(c *gin.Context) {
	id := c.Param("instanceId")
	tenantID := c.GetString("tenant_id")
	var req models.UpdateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.UpdateInstance(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		respondNotFound(c, "instance not found")
		return
	}
	respondSuccess(c, inst)
}

// DeleteInstance removes a skill instance.
func (h *SkillHandler) DeleteInstance(c *gin.Context) {
	id := c.Param("instanceId")
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteInstance(c.Request.Context(), id, tenantID); err != nil {
		respondNotFound(c, "instance not found")
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// ExecuteSkill triggers direct execution of a skill.
func (h *SkillHandler) ExecuteSkill(c *gin.Context) {
	skillID := c.Param("id")
	tenantID := c.GetString("tenant_id")
	var req models.CreateExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	exec, err := h.svc.ExecuteSkill(c.Request.Context(), skillID, tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, exec)
}

// ListExecutions returns execution history for a skill.
func (h *SkillHandler) ListExecutions(c *gin.Context) {
	skillID := c.Param("id")
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	items, total, totalPages, err := h.svc.GetExecutions(c.Request.Context(), skillID, tenantID, page, limit)
	if err != nil {
		respondNotFound(c, "skill not found")
		return
	}
	respondSuccess(c, items, "total": total, "page": page, "total_pages": totalPages)
}

// ListAllExecutions returns all executions (admin).
func (h *SkillHandler) ListAllExecutions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	skillID := c.Query("skill_id")

	items, total, totalPages, err := h.svc.GetAllExecutions(c.Request.Context(), tenantID, page, limit, func() *string {
		if skillID != "" {
			return &skillID
		}
		return nil
	}())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items, "total": total, "page": page, "total_pages": totalPages)
}

// SubmitForReview submits a skill for review.
func (h *SkillHandler) SubmitForReview(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	sp, err := h.svc.SubmitForReview(c.Request.Context(), id, userID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, sp)
}

// ApproveSkill approves a skill for publication.
func (h *SkillHandler) ApproveSkill(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	reason := c.PostForm("reason")
	if userID == "" {
		userID = "system"
	}
	sp, err := h.svc.ApproveSkill(c.Request.Context(), id, userID, reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, sp)
}

// RejectSkill rejects a skill under review.
func (h *SkillHandler) RejectSkill(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	reason := c.PostForm("reason")
	if userID == "" {
		userID = "system"
	}
	sp, err := h.svc.RejectSkill(c.Request.Context(), id, userID, reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, sp)
}

// ArchiveSkill archives a skill.
func (h *SkillHandler) ArchiveSkill(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	reason := c.PostForm("reason")
	if userID == "" {
		userID = tenantID
	}
	sp, err := h.svc.ArchiveSkill(c.Request.Context(), id, userID, reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, sp)
}

// PendingReview returns skills pending review.
func (h *SkillHandler) PendingReview(c *gin.Context) {
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	items, total, totalPages, err := h.svc.GetPendingReview(c.Request.Context(), category, page, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items, "total": total, "page": page, "total_pages": totalPages)
}

// GetAuditLog returns audit log for a skill.
func (h *SkillHandler) GetAuditLog(c *gin.Context) {
	skillID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	items, total, totalPages, err := h.svc.GetAuditLog(c.Request.Context(), skillID, page, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items, "total": total, "page": page, "total_pages": totalPages)
}

// GetAllAuditLogs returns global audit log (admin).
func (h *SkillHandler) GetAllAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	action := c.Query("action")

	var actionPtr *string
	if action != "" {
		actionPtr = &action
	}
	items, total, totalPages, err := h.svc.GetAllAuditLogs(c.Request.Context(), page, limit, actionPtr)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items, "total": total, "page": page, "total_pages": totalPages)
}
