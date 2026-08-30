package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/schema-registry/models"
	"orion/platform-svc-go/internal/schema-registry/repository"
	"orion/platform-svc-go/internal/schema-registry/service"
)

// Handler wires the schema-registry service to HTTP. Every endpoint is
// guarded by a RequirePermission middleware so the same auth layer applies
// as elsewhere in the platform.
type Handler struct {
	svc  *service.Service
	repo repository.Interface
}

// New returns a Handler ready to be mounted on a gin RouterGroup.
func New(svc *service.Service, repo repository.Interface) *Handler {
	return &Handler{svc: svc, repo: repo}
}

// RegisterRoutes mounts the schema-registry endpoints on the given group.
// The group prefix is expected to already be "/api/v1" (or similar) — this
// handler adds "/schema-registry" beneath it.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/schema-registry")
	g.POST("/schemas", auth.RequirePermission("schema-registry", "write"), h.Register)
	g.GET("/schemas", auth.RequirePermission("schema-registry", "read"), h.List)
	g.GET("/schemas/:namespace/:name", auth.RequirePermission("schema-registry", "read"), h.Lookup)
	g.PUT("/schemas/:namespace/:name", auth.RequirePermission("schema-registry", "write"), h.Update)
	g.DELETE("/schemas/:namespace/:name", auth.RequirePermission("schema-registry", "delete"), h.Delete)
	g.POST("/schemas/:namespace/:name/evolve", auth.RequirePermission("schema-registry", "read"), h.Evolve)
	g.GET("/schemas/:namespace/:name/versions", auth.RequirePermission("schema-registry", "read"), h.VersionHistory)
	g.GET("/schemas/:namespace/:name/versions/:version", auth.RequirePermission("schema-registry", "read"), h.GetVersion)
	g.GET("/schemas/:namespace/:name/compatibility", auth.RequirePermission("schema-registry", "read"), h.Compatibility)
}

// Register accepts a RegisterRequest body and persists or evolves the schema.
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "invalid body: "+err.Error())
		return
	}
	if errs := h.svc.ValidateFields(req.Fields); len(errs) > 0 {
		badRequest(c, joinErrors(errs))
		return
	}
	resp, err := h.svc.Register(c.Request.Context(), &req)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// List returns all schemas matching the query parameters.
func (h *Handler) List(c *gin.Context) {
	q := &models.QueryRequest{
		Namespace: c.Query("namespace"),
		Owner:     c.Query("owner"),
	}
	if t := c.Query("type"); t != "" {
		q.Type = models.SchemaType(t)
	}
	if st := c.Query("status"); st != "" {
		q.Status = models.SchemaStatus(st)
	}
	resp, err := h.svc.List(c.Request.Context(), q)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Lookup returns the latest version of a single schema.
func (h *Handler) Lookup(c *gin.Context) {
	s, err := h.svc.Lookup(c.Request.Context(), c.Param("namespace"), c.Param("name"))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

// Update persists changes to an existing schema by routing through the
// Register/evolution path. Body shape matches RegisterRequest.
func (h *Handler) Update(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "invalid body: "+err.Error())
		return
	}
	req.Namespace = c.Param("namespace")
	req.Name = c.Param("name")
	if req.Owner == "" {
		req.Owner = c.GetString("userID")
	}
	if errs := h.svc.ValidateFields(req.Fields); len(errs) > 0 {
		badRequest(c, joinErrors(errs))
		return
	}
	resp, err := h.svc.Register(c.Request.Context(), &req)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Delete removes a schema entirely.
func (h *Handler) Delete(c *gin.Context) {
	err := h.repo.DeleteSchema(c.Request.Context(), c.Param("namespace"), c.Param("name"))
	if err != nil {
		if errors.Is(err, repository.ErrSchemaNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "schema not found"})
			return
		}
		handleError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// Evolve runs a dry-run compatibility check against the existing schema
// without persisting the change.
func (h *Handler) Evolve(c *gin.Context) {
	var req struct {
		Fields []models.SchemaField `json:"fields"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "invalid body: "+err.Error())
		return
	}
	s, err := h.svc.Lookup(c.Request.Context(), c.Param("namespace"), c.Param("name"))
	if err != nil {
		handleError(c, err)
		return
	}
	result := h.svc.Evolve(s, req.Fields, s.Compatibility)
	c.JSON(http.StatusOK, &models.CompatibilityResponse{
		Result:     result,
		Breaking:   result.Breaking,
		Compatible: result.Compatible,
	})
}

// VersionHistory returns the last N versions of a schema.
func (h *Handler) VersionHistory(c *gin.Context) {
	limit := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	versions, err := h.repo.GetVersionHistory(c.Request.Context(), c.Param("namespace"), c.Param("name"), limit)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, &models.VersionHistoryResponse{
		Schema:   c.Param("namespace") + "/" + c.Param("name"),
		Versions: versions,
	})
}

// GetVersion returns a single schema version by number.
func (h *Handler) GetVersion(c *gin.Context) {
	ver, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		badRequest(c, "invalid version: "+c.Param("version"))
		return
	}
	v, err := h.repo.GetVersion(c.Request.Context(), c.Param("namespace"), c.Param("name"), ver)
	if err != nil {
		if errors.Is(err, repository.ErrSchemaNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "version not found"})
			return
		}
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, v)
}

// Compatibility reports the effective compatibility mode for a schema.
func (h *Handler) Compatibility(c *gin.Context) {
	mode, err := h.repo.GetCompatibility(c.Request.Context(), c.Param("namespace"), c.Param("name"))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"compatibility": mode})
}

// --- response helpers ---

func badRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"error": msg})
}

func handleError(c *gin.Context, err error) {
	if errors.Is(err, repository.ErrSchemaNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func joinErrors(errs []string) string {
	if len(errs) == 0 {
		return ""
	}
	out := errs[0]
	for _, e := range errs[1:] {
		out += "; " + e
	}
	return out
}
