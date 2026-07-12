package handler

import (
	"net/http"
	"strconv"

	"orion/community-svc-go/internal/models"
	"orion/community-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Contributions
	contrib := rg.Group("/contributions")
	contrib.POST("", auth.RequirePermission("community", "write"), h.CreateContribution)
	contrib.GET("", h.ListContributions)
	contrib.GET("/:id", h.GetContribution)
	contrib.DELETE("/:id", auth.RequirePermission("community", "delete"), h.DeleteContribution)

	// Best Practices
	bp := rg.Group("/best-practices")
	bp.POST("", auth.RequirePermission("community", "write"), h.CreateBestPractice)
	bp.GET("", h.ListBestPractices)
	bp.GET("/:id", h.GetBestPractice)
	bp.POST("/:id/vote", auth.RequirePermission("community", "write"), h.VoteBestPractice)
	bp.DELETE("/:id", auth.RequirePermission("community", "delete"), h.DeleteBestPractice)

	// Contributors
	rg.GET("/contributors", h.ListContributors)
	rg.GET("/contributors/:userId", h.GetContributor)

	// Plugins
	plugins := rg.Group("/plugins")
	plugins.POST("", auth.RequirePermission("community", "write"), h.SubmitPlugin)
	plugins.GET("", h.ListPlugins)
	plugins.POST("/:id/review", auth.RequirePermission("community", "write"), h.ReviewPlugin)

	// Badges
	badges := rg.Group("/badges")
	badges.POST("", auth.RequirePermission("community", "write"), h.AwardBadge)
	badges.GET("/user/:userId", h.ListUserBadges)
	badges.GET("/definitions", h.GetBadgeDefinitions)

	// Incentive Programs
	programs := rg.Group("/incentive-programs")
	programs.POST("", auth.RequirePermission("community", "write"), h.SetupIncentiveProgram)
	programs.GET("", h.GetIncentivePrograms)
	programs.PATCH("/:id/status", auth.RequirePermission("community", "write"), h.UpdateIncentiveProgramStatus)

	// Mentorship
	mentorship := rg.Group("/mentorship")
	mentorship.POST("", auth.RequirePermission("community", "write"), h.AssignMentor)
	mentorship.GET("", h.GetMentorshipPairs)
	mentorship.PATCH("/:id/status", auth.RequirePermission("community", "write"), h.UpdateMentorshipPairStatus)
}

// ============================================================
// Contribution Handlers
// ============================================================

func (h *Handler) CreateContribution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateContributionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreateContribution(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListContributions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var paginated models.PaginatedRequest
	if err := c.ShouldBindQuery(&paginated); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	filters := &models.ContributionFilters{
		Type:   c.Query("type"),
		Status: c.Query("status"),
		UserID: c.Query("user_id"),
	}
	if tags := c.QueryArray("tags"); len(tags) > 0 {
		filters.Tags = tags
	}
	items, total, err := h.svc.ListContributions(c.Request.Context(), tenantID, filters, paginated.Offset(), paginated.Limit())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:  items,
		Total: total,
		Page:  paginated.Page,
		Size:  paginated.PageSize,
	})
}

func (h *Handler) GetContribution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetContribution(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "contribution not found")
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) DeleteContribution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteContribution(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// ============================================================
// Best Practice Handlers
// ============================================================

func (h *Handler) CreateBestPractice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBestPracticeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreateBestPractice(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListBestPractices(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var paginated models.PaginatedRequest
	if err := c.ShouldBindQuery(&paginated); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	filters := &models.BestPracticeFilters{
		Category: c.Query("category"),
		Status:   c.Query("status"),
		AuthorID: c.Query("author_id"),
		Search:   c.Query("search"),
	}
	if tags := c.QueryArray("tags"); len(tags) > 0 {
		filters.Tags = tags
	}
	items, total, err := h.svc.ListBestPractices(c.Request.Context(), tenantID, filters, paginated.Offset(), paginated.Limit())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:  items,
		Total: total,
		Page:  paginated.Page,
		Size:  paginated.PageSize,
	})
}

func (h *Handler) GetBestPractice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetBestPractice(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "best practice not found")
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) VoteBestPractice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Direction string `json:"direction" binding:"required"` // "up" or "down"
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.VoteBestPractice(c.Request.Context(), tenantID, c.Param("id"), body.Direction)
	if err != nil {
		if err == service.ErrBestPracticeNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) DeleteBestPractice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteBestPractice(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// ============================================================
// Contributor Handlers
// ============================================================

func (h *Handler) ListContributors(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	items, err := h.svc.ListContributors(c.Request.Context(), tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetContributor(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetContributor(c.Request.Context(), tenantID, c.Param("userId"))
	if err != nil {
		respondNotFound(c, "contributor not found")
		return
	}
	respondSuccess(c, item)
}

// ============================================================
// Plugin Handlers
// ============================================================

func (h *Handler) SubmitPlugin(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.SubmitPlugin(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListPlugins(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var paginated models.PaginatedRequest
	if err := c.ShouldBindQuery(&paginated); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	filters := &models.PluginFilters{
		Category: c.Query("category"),
		Status:   c.Query("status"),
		Author:   c.Query("author"),
	}
	items, total, err := h.svc.ListPlugins(c.Request.Context(), tenantID, filters, paginated.Offset(), paginated.Limit())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:  items,
		Total: total,
		Page:  paginated.Page,
		Size:  paginated.PageSize,
	})
}

func (h *Handler) ReviewPlugin(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ReviewPluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.ReviewPlugin(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrPluginNotFound {
			respondNotFound(c, err.Error())
			return
		}
		if err == service.ErrInvalidAction {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

// ============================================================
// Badge Handlers
// ============================================================

func (h *Handler) AwardBadge(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		UserID   string `json:"user_id" binding:"required"`
		BadgeType string `json:"badge_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	badge, err := h.svc.AwardBadge(c.Request.Context(), tenantID, body.UserID, body.BadgeType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, badge)
}

func (h *Handler) ListUserBadges(c *gin.Context) {
	userID := c.Param("userId")
	items, err := h.svc.ListUserBadges(c.Request.Context(), userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetBadgeDefinitions(c *gin.Context) {
	defs := h.svc.GetBadgeDefinitions()
	respondSuccess(c, defs)
}

// ============================================================
// Incentive Program Handlers
// ============================================================

func (h *Handler) SetupIncentiveProgram(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateIncentiveProgramRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.SetupIncentiveProgram(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) GetIncentivePrograms(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetIncentivePrograms(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateIncentiveProgramStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.UpdateIncentiveProgramStatus(c.Request.Context(), tenantID, c.Param("id"), body.Status)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

// ============================================================
// Mentorship Handlers
// ============================================================

func (h *Handler) AssignMentor(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AssignMentorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.AssignMentor(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) GetMentorshipPairs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetMentorshipPairs(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateMentorshipPairStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.UpdateMentorshipPairStatus(c.Request.Context(), tenantID, c.Param("id"), body.Status)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}
