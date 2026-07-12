package handler

import (
	"net/http"
	"strconv"

	"orion/artifact-svc-go/internal/artifact/models"
	"orion/artifact-svc-go/internal/artifact/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler wires service methods to HTTP endpoints.
type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/artifacts")

	// Core CRUD
	r.POST("", auth.RequirePermission("artifact", "write"), h.Create)
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.PUT("/:id", auth.RequirePermission("artifact", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("artifact", "delete"), h.Delete)

	// Tags
	r.POST("/:id/tags", auth.RequirePermission("artifact", "write"), h.AddTags)
	r.DELETE("/:id/tags", auth.RequirePermission("artifact", "write"), h.RemoveTags)
	r.GET("/:id/tags", h.GetTags)

	// Download
	r.GET("/:id/download", h.Download)
	r.GET("/:id/downloads", h.GetDownloadHistory)

	// Search & stats
	r.GET("/search", h.Search)
	r.GET("/stats", h.Stats)
	r.GET("/types", h.TypeStats)
	r.GET("/namespaces", h.Namespaces)

	// Promotion
	r.POST("/:id/promote", auth.RequirePermission("artifact", "write"), h.Promote)
	r.GET("/:id/stage", h.GetStage)
	r.GET("/:id/history", h.GetHistory)

	// Lifecycle
	r.POST("/:id/deprecate", auth.RequirePermission("artifact", "write"), h.Deprecate)
	r.POST("/:id/quarantine", auth.RequirePermission("artifact", "write"), h.Quarantine)
}

// ------------------------------------------------------------
// CRUD
// ------------------------------------------------------------

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	artifact, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		if models.IsNotFound(err) || models.IsInvalidInput(err) || models.IsAlreadyExists(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, artifact)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ns := c.Query("namespace")
	name := c.Query("name")
	atype := c.Query("type")
	status := c.Query("status")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	opts := &models.ListQueryOptions{
		Namespace: ns, Name: name, Type: atype, Status: status,
		Search: search, Page: page, PageSize: pageSize,
	}
	items, total, err := h.svc.List(c.Request.Context(), tenantID, opts)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items, "total": total)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	artifact, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, artifact)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	artifact, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, artifact)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// ------------------------------------------------------------
// Tags
// ------------------------------------------------------------

func (h *Handler) AddTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct{ Tags []string `json:"tags" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.AddTags(c.Request.Context(), tenantID, c.Param("id"), req.Tags); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "tags added"})
}

func (h *Handler) RemoveTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct{ Tags []string `json:"tags" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.RemoveTags(c.Request.Context(), tenantID, c.Param("id"), req.Tags); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "tags removed"})
}

func (h *Handler) GetTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	tags, err := h.svc.GetTags(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"tags": tags})
}

// ------------------------------------------------------------
// Download
// ------------------------------------------------------------

func (h *Handler) Download(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DownloadRequest
	if c.Request.Method == "GET" {
		// Allow GET with no body; downloaded_by defaults to authenticated user
		req.DownloadedBy = c.GetString("user_id")
		req.IPAddress = c.ClientIP()
		req.UserAgent = c.Request.UserAgent()
		if req.DownloadedBy == "" {
			req.DownloadedBy = "anonymous"
		}
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			respondBadRequest(c, err.Error())
			return
		}
	}
	artifact, err := h.svc.Download(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if models.IsNotFound(err) || models.IsNotAvailable(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"artifact": artifact, "download_url": artifact.StoragePath})
}

func (h *Handler) GetDownloadHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	history, err := h.svc.GetDownloadHistory(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"downloads": history})
}

// ------------------------------------------------------------
// Search & Stats
// ------------------------------------------------------------

func (h *Handler) Search(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	query := c.Query("query")
	if query == "" {
		respondBadRequest(c, "query parameter required")
		return
	}
	results, err := h.svc.Search(c.Request.Context(), tenantID, query)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, results)
}

func (h *Handler) Stats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) TypeStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetTypeStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) Namespaces(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	namespaces, err := h.svc.GetNamespaces(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, namespaces)
}

// ------------------------------------------------------------
// Promotion
// ------------------------------------------------------------

func (h *Handler) Promote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		PromotedBy string `json:"promoted_by" binding:"required"`
		ApprovedBy string `json:"approved_by"`
		Reason     string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	var (
		rec *models.PromotionRecord
		err error
	)
	if req.ApprovedBy != "" {
		rec, err = h.svc.PromoteWithApproval(c.Request.Context(), tenantID, c.Param("id"), req.PromotedBy, req.ApprovedBy, req.Reason)
	} else {
		rec, err = h.svc.Promote(c.Request.Context(), tenantID, c.Param("id"), req.PromotedBy, req.Reason)
	}
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, rec)
}

func (h *Handler) GetStage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stage, err := h.svc.GetCurrentStage(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"stage": string(stage)})
}

func (h *Handler) GetHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	history, err := h.svc.GetPromotionHistory(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"history": history})
}

// ------------------------------------------------------------
// Lifecycle
// ------------------------------------------------------------

func (h *Handler) Deprecate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	artifact, err := h.svc.Deprecate(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, artifact)
}

func (h *Handler) Quarantine(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct{ Reason string `json:"reason"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	artifact, err := h.svc.Quarantine(c.Request.Context(), tenantID, c.Param("id"), req.Reason)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, artifact)
}

// isUserError returns true for known domain errors (maps to 4xx).
func isUserError(err error) bool {
	return models.IsNotFound(err) || models.IsInvalidInput(err) ||
		models.IsAlreadyExists(err) || models.IsNotAvailable(err)
}
