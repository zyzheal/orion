package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/internal-library/models"
	"orion/platform-svc-go/internal/internal-library/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all internal-library routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	lib := rg.Group("/internal-libraries")

	// ---- CRUD ----
	lib.POST("", auth.RequirePermission("internal_library", "write"), h.Create)
	lib.GET("", auth.RequirePermission("internal_library", "read"), h.List)
	lib.GET("/:id", auth.RequirePermission("internal_library", "read"), h.Get)
	lib.PUT("/:id", auth.RequirePermission("internal_library", "write"), h.Update)
	lib.GET("/name/:name", auth.RequirePermission("internal_library", "read"), h.GetByName)
	lib.GET("/language/:language", auth.RequirePermission("internal_library", "read"), h.ListByLanguage)
	lib.GET("/owner/:owner", auth.RequirePermission("internal_library", "read"), h.ListByOwner)
	lib.DELETE("/:id", auth.RequirePermission("internal_library", "delete"), h.Delete)

	// ---- Version management ----
	lib.POST("/:id/versions", auth.RequirePermission("internal_library", "write"), h.PublishVersion)
	lib.GET("/:id/versions", auth.RequirePermission("internal_library", "read"), h.ListVersions)
	lib.GET("/:id/versions/:version", auth.RequirePermission("internal_library", "read"), h.GetVersion)
	lib.POST("/:id/versions/:version/deprecate", auth.RequirePermission("internal_library", "write"), h.DeprecateVersion)

	// ---- Deprecation ----
	lib.POST("/:id/deprecate", auth.RequirePermission("internal_library", "write"), h.Deprecate)
	lib.POST("/:id/activate", auth.RequirePermission("internal_library", "write"), h.Activate)

	// ---- Dependency tracking ----
	lib.GET("/:id/dependents", auth.RequirePermission("internal_library", "read"), h.ListDependents)
	lib.POST("/:id/dependents", auth.RequirePermission("internal_library", "write"), h.AddDependent)
	lib.PUT("/:id/dependents/:repoName", auth.RequirePermission("internal_library", "write"), h.UpdateDependentVersion)
	lib.GET("/dependencies/:repoName", auth.RequirePermission("internal_library", "read"), h.CheckDependencies)
	lib.POST("/:id/update-stats", auth.RequirePermission("internal_library", "write"), h.UpdateStats)
}

// =============================================================================
// CRUD handlers
// =============================================================================

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateInternalLibraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"libraries": items,
		"total":     len(items),
	})
}

func (h *Handler) GetByName(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	m, err := h.svc.GetByName(c.Request.Context(), tenantID, c.Param("name"))
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) ListByLanguage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListByLanguage(c.Request.Context(), tenantID, c.Param("language"), limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"libraries": items,
		"total":     len(items),
	})
}

func (h *Handler) ListByOwner(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListByOwner(c.Request.Context(), tenantID, c.Param("owner"), limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"libraries": items,
		"total":     len(items),
	})
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateInternalLibraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Writer.WriteHeader(http.StatusNoContent)
}

// =============================================================================
// Version management handlers
// =============================================================================

func (h *Handler) PublishVersion(c *gin.Context) {
	libraryID := c.Param("id")
	var req models.PublishVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	v, err := h.svc.PublishVersion(c.Request.Context(), libraryID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		if err != nil && service.IsVersionExists(err) {
			middleware.RespondConflict(c, "version already exists")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, v)
}

func (h *Handler) ListVersions(c *gin.Context) {
	libraryID := c.Param("id")
	versions, err := h.svc.ListVersions(c.Request.Context(), libraryID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"versions": versions,
		"total":    len(versions),
	})
}

func (h *Handler) GetVersion(c *gin.Context) {
	libraryID := c.Param("id")
	version := c.Param("version")
	v, err := h.svc.GetVersion(c.Request.Context(), libraryID, version)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, v)
}

func (h *Handler) DeprecateVersion(c *gin.Context) {
	libraryID := c.Param("id")
	version := c.Param("version")
	var req models.DeprecateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	v, err := h.svc.DeprecateVersion(c.Request.Context(), libraryID, version, req.Reason, req.MigrationGuide, req.EOLDate)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, v)
}

// =============================================================================
// Deprecation handlers
// =============================================================================

func (h *Handler) Deprecate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.DeprecateLibraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	lib, err := h.svc.Deprecate(c.Request.Context(), tenantID, id, req.Reason, req.MigrationGuide, req.EOLDate)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		if service.IsAlreadyDeprecated(err) {
			middleware.RespondConflict(c, "library already deprecated")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, lib)
}

func (h *Handler) Activate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	lib, err := h.svc.Activate(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		if service.IsAlreadyActive(err) {
			middleware.RespondConflict(c, "library already active")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, lib)
}

// =============================================================================
// Dependency tracking handlers
// =============================================================================

func (h *Handler) ListDependents(c *gin.Context) {
	libraryID := c.Param("id")
	dependents, err := h.svc.ListDependents(c.Request.Context(), libraryID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"dependents": dependents,
		"total":      len(dependents),
	})
}

func (h *Handler) AddDependent(c *gin.Context) {
	libraryID := c.Param("id")
	var req models.AddDependentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.AddDependent(c.Request.Context(), libraryID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) UpdateDependentVersion(c *gin.Context) {
	libraryID := c.Param("id")
	repoName := c.Param("repoName")
	var req models.UpdateDependentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateDependentVersion(c.Request.Context(), libraryID, repoName, req.Version); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "dependent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) CheckDependencies(c *gin.Context) {
	repoName := c.Param("repoName")
	results, err := h.svc.CheckDependencies(c.Request.Context(), repoName)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

func (h *Handler) UpdateStats(c *gin.Context) {
	libraryID := c.Param("id")
	stats, err := h.svc.UpdateStats(c.Request.Context(), libraryID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "library not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ---------------------------------------------------------------------------
// time needed for model tags
// ---------------------------------------------------------------------------
var _ = time.Now()
