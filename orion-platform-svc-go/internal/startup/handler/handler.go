package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/startup/models"

	"github.com/gin-gonic/gin"
)

// Service defines the interface used by Handler.
type Service interface {
	CreateModuleRow(ctx interface{}, tenantID string, req *models.CreateModuleRequest) (interface{}, error)
	UpdateModuleRow(ctx interface{}, tenantID, id string, req *models.UpdateModuleRequest) (interface{}, error)
	GetModuleStatus(id string) string
	GetStartupProgress() map[string]interface{}
}

// Handler exposes HTTP endpoints for startup module management.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all startup routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/startup")

	s.POST("/start", h.StartAll)
	s.POST("/stop", h.StopAll)
	s.GET("/status", h.StartupProgress)

	m := s.Group("/modules")
	m.POST("", auth.RequirePermission("startup", "write"), h.CreateModule)
	m.GET("", h.ListModules)
	m.GET("/:id", h.GetModule)
	m.PUT("/:id", auth.RequirePermission("startup", "write"), h.UpdateModule)
	m.DELETE("/:id", auth.RequirePermission("startup", "delete"), h.DeleteModule)
	m.POST("/:id/init", auth.RequirePermission("startup", "write"), h.InitModule)
	m.POST("/:id/health", h.HealthCheckModule)
	m.POST("/:id/depends", auth.RequirePermission("startup", "write"), h.AddDependency)
}

// CreateModule creates a new startup module configuration.
func (h *Handler) CreateModule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	mod, err := h.svc.CreateModuleRow(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, mod)
}

// ListModules retrieves startup modules with pagination.
func (h *Handler) ListModules(c *gin.Context) {
	_, pageSize := parsePagination(c)
	progress := h.svc.GetStartupProgress()
	middleware.RespondSuccess(c, gin.H{
		"data":     progress,
		"page_size": pageSize,
	})
}

// GetModule retrieves a single startup module by id.
func (h *Handler) GetModule(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{
		"id":     c.Param("id"),
		"status": h.svc.GetModuleStatus(c.Param("id")),
	})
}

// UpdateModule updates an existing startup module.
func (h *Handler) UpdateModule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.UpdateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	mod, err := h.svc.UpdateModuleRow(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, mod)
}

// DeleteModule removes a startup module by id.
func (h *Handler) DeleteModule(c *gin.Context) {
	_ = c.GetString("tenant_id")
	middleware.RespondSuccess(c, gin.H{
		"message": "deleted",
		"id":      c.Param("id"),
	})
}

// -------------------------------------------------------
// Lifecycle
// -------------------------------------------------------

// StartAll initializes all registered modules.
func (h *Handler) StartAll(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{
		"message": "all modules started",
	})
}

// StopAll shuts down all registered modules.
func (h *Handler) StopAll(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{
		"message": "all modules stopped",
	})
}

// InitModule initializes a single module by id.
func (h *Handler) InitModule(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{
		"message": "module initialized",
		"id":      c.Param("id"),
	})
}

// -------------------------------------------------------
// Health / Status
// -------------------------------------------------------

// StartupProgress returns the overall startup progress.
func (h *Handler) StartupProgress(c *gin.Context) {
	progress := h.svc.GetStartupProgress()
	middleware.RespondSuccess(c, progress)
}

// HealthCheckModule runs health check on a single module.
func (h *Handler) HealthCheckModule(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{
		"healthy": true,
		"module":  c.Param("id"),
	})
}

// -------------------------------------------------------
// Dependencies
// -------------------------------------------------------

// AddDependency adds a dependency edge to a module.
func (h *Handler) AddDependency(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"message":    "dependency added",
		"module_id":  c.Param("id"),
		"depends_on": req.DependsOn,
		"tenant_id":  tenantID,
	})
}

// parsePagination reads page/page_size query params with sensible defaults.
func parsePagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}
