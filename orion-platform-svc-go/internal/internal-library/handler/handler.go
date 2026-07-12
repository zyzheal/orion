package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/internal-library/models"
	"orion/platform-svc-go/internal/internal-library/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all internal-library routes onto the given router group.
//
// Mirrors the TS routes in orion-platform-service/src/api/internal-library-routes.ts:
//
//	 CRUD:
//	  POST   /internal-libraries
//	  GET    /internal-libraries
//	  GET    /internal-libraries/:id
//	  GET    /internal-libraries/name/:name
//	  GET    /internal-libraries/language/:language
//	  GET    /internal-libraries/owner/:owner
//	  DELETE /internal-libraries/:id
//
//	 Version management:
//	  POST   /internal-libraries/:id/versions
//	  GET    /internal-libraries/:id/versions
//	  GET    /internal-libraries/:id/versions/:version
//	  POST   /internal-libraries/:id/versions/:version/deprecate
//
//	 Deprecation:
//	  POST   /internal-libraries/:id/deprecate
//	  POST   /internal-libraries/:id/activate
//
//	 Dependency tracking:
//	  GET    /internal-libraries/:id/dependents
//	  POST   /internal-libraries/:id/dependents
//	  PUT    /internal-libraries/:id/dependents/:repoName
//	  GET    /internal-libraries/dependencies/:repoName
//	  POST   /internal-libraries/:id/update-stats
//
// Routes marked // TODO call service stubs because the service layer does not
// yet expose those methods. They are registered here so the surface area
// matches the TS blueprint; the service/repository layers are wired in once
// those methods are added.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	lib := rg.Group("/internal-libraries")

	// ---- CRUD ----
	lib.POST("", auth.RequirePermission("internal_library", "write"), h.Create)
	lib.GET("", h.List)
	lib.GET("/:id", h.Get)
	lib.GET("/name/:name", h.GetByName)
	lib.GET("/language/:language", h.ListByLanguage)
	lib.GET("/owner/:owner", h.ListByOwner)
	lib.DELETE("/:id", auth.RequirePermission("internal_library", "delete"), h.Delete)

	// ---- Version management ----
	lib.POST("/:id/versions", auth.RequirePermission("internal_library", "write"), h.PublishVersion)
	lib.GET("/:id/versions", h.ListVersions)
	lib.GET("/:id/versions/:version", h.GetVersion)
	lib.POST("/:id/versions/:version/deprecate", auth.RequirePermission("internal_library", "write"), h.DeprecateVersion)

	// ---- Deprecation ----
	lib.POST("/:id/deprecate", auth.RequirePermission("internal_library", "write"), h.Deprecate)
	lib.POST("/:id/activate", auth.RequirePermission("internal_library", "write"), h.Activate)

	// ---- Dependency tracking ----
	lib.GET("/:id/dependents", h.ListDependents)
	lib.POST("/:id/dependents", auth.RequirePermission("internal_library", "write"), h.AddDependent)
	lib.PUT("/:id/dependents/:repoName", auth.RequirePermission("internal_library", "write"), h.UpdateDependentVersion)
	lib.GET("/dependencies/:repoName", h.CheckDependencies)
	lib.POST("/:id/update-stats", auth.RequirePermission("internal_library", "write"), h.UpdateStats)
}

// =============================================================================
// CRUD handlers (backed by the existing service layer)
// =============================================================================

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateInternalLibraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetByName(c *gin.Context) {
	// TODO: Service does not expose GetByName yet. Return 501 so the endpoint
	// exists; replace with h.svc.GetByName(...) once wired.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "GetByName not yet implemented in the service layer",
	})
}

func (h *Handler) ListByLanguage(c *gin.Context) {
	// TODO: Service does not expose ListByLanguage yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "ListByLanguage not yet implemented in the service layer",
	})
}

func (h *Handler) ListByOwner(c *gin.Context) {
	// TODO: Service does not expose ListByOwner yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "ListByOwner not yet implemented in the service layer",
	})
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateInternalLibraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "library not found")
		return
	}
	c.Status(http.StatusNoContent)
}

// =============================================================================
// Version management handlers (TODO: service stubs)
// =============================================================================

// PublishVersionInput mirrors TS PublishVersionInput.
type PublishVersionInput struct {
	Version       string  `json:"version" binding:"required"`
	Status        string  `json:"status"`
	Changelog     string  `json:"changelog"`
	ArtifactID    string  `json:"artifactId"`
	SecurityScore float64 `json:"securityScore"`
	TestCoverage  float64 `json:"testCoverage"`
	PublishedTo   string  `json:"publishedTo"`
}

func (h *Handler) PublishVersion(c *gin.Context) {
	// TODO: Service does not expose PublishVersion yet. Return 501 so the
	// endpoint exists; wire up the service call once the method is added.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "PublishVersion not yet implemented in the service layer",
	})
}

func (h *Handler) ListVersions(c *gin.Context) {
	// TODO: Service does not expose GetVersions yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "ListVersions not yet implemented in the service layer",
	})
}

func (h *Handler) GetVersion(c *gin.Context) {
	// TODO: Service does not expose GetVersion yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "GetVersion not yet implemented in the service layer",
	})
}

// DeprecateVersionInput mirrors TS body for deprecating a version.
type DeprecateVersionInput struct {
	Reason        string    `json:"reason"`
	EOLDate       time.Time `json:"eolDate"`
	MigrationGuide string   `json:"migrationGuide"`
}

func (h *Handler) DeprecateVersion(c *gin.Context) {
	// TODO: Service does not expose DeprecateVersion yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "DeprecateVersion not yet implemented in the service layer",
	})
}

// =============================================================================
// Deprecation handlers (TODO: service stubs)
// =============================================================================

// DeprecateLibraryInput mirrors TS DeprecateLibraryInput.
type DeprecateLibraryInput struct {
	LibraryID          string    `json:"libraryId" binding:"required"`
	Reason             string    `json:"reason"`
	EOLDate            time.Time `json:"eolDate"`
	MigrationGuide     string    `json:"migrationGuide"`
	ReplacementLibrary string    `json:"replacementLibrary"`
}

func (h *Handler) Deprecate(c *gin.Context) {
	// TODO: Service does not expose DeprecateLibrary yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "DeprecateLibrary not yet implemented in the service layer",
	})
}

func (h *Handler) Activate(c *gin.Context) {
	// TODO: Service does not expose ActivateLibrary yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "ActivateLibrary not yet implemented in the service layer",
	})
}

// =============================================================================
// Dependency tracking handlers (TODO: service stubs)
// =============================================================================

func (h *Handler) ListDependents(c *gin.Context) {
	// TODO: Service does not expose GetDependents yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "ListDependents not yet implemented in the service layer",
	})
}

// AddDependentInput mirrors TS body for adding a dependent.
type AddDependentInput struct {
	RepoName string `json:"repoName" binding:"required"`
	TeamName string `json:"teamName"`
	Version  string `json:"version"`
}

func (h *Handler) AddDependent(c *gin.Context) {
	// TODO: Service does not expose AddDependent yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "AddDependent not yet implemented in the service layer",
	})
}

// UpdateDependentInput mirrors TS body for updating dependent version.
type UpdateDependentInput struct {
	Version string `json:"version" binding:"required"`
}

func (h *Handler) UpdateDependentVersion(c *gin.Context) {
	// TODO: Service does not expose UpdateDependentVersion yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "UpdateDependentVersion not yet implemented in the service layer",
	})
}

func (h *Handler) CheckDependencies(c *gin.Context) {
	// TODO: Service does not expose CheckDependencies yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "CheckDependencies not yet implemented in the service layer",
	})
}

func (h *Handler) UpdateStats(c *gin.Context) {
	// TODO: Service does not expose UpdateDependentsStats yet.
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "NOT_IMPLEMENTED",
		"message": "UpdateDependentsStats not yet implemented in the service layer",
	})
}
