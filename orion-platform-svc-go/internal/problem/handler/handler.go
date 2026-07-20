package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/problem/models"
	"orion/platform-svc-go/internal/problem/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the interface used by Handler.
type Service interface {
	ListProblems(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error)
	GetProblem(ctx context.Context, tenantID, id string) (*models.Problem, error)
	CreateProblem(ctx context.Context, tenantID string, req *models.CreateProblemRequest) (*models.Problem, error)
	UpdateProblem(ctx context.Context, tenantID, id string, req *models.UpdateProblemRequest) (*models.Problem, error)
	DeleteProblem(ctx context.Context, tenantID, id string) error
	GetStats(ctx context.Context, tenantID string) (*models.ProblemStats, error)
	LinkIncident(ctx context.Context, tenantID, problemID, incidentID string) (*models.Problem, error)
	GetIncidentLinks(ctx context.Context, tenantID, problemID string) ([]string, error)
	LinkChange(ctx context.Context, tenantID, problemID, changeID string) (*models.Problem, error)
	GetChangeLinks(ctx context.Context, tenantID, problemID string) ([]string, error)
	ListKnownErrors(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error)
	SearchKnownErrors(ctx context.Context, tenantID, query string) ([]models.KnownError, int, error)
	GetKnownError(ctx context.Context, tenantID, id string) (*models.KnownError, error)
	CreateKnownError(ctx context.Context, tenantID string, req *models.CreateKnownErrorRequest) (*models.KnownError, error)
	UpdateKnownError(ctx context.Context, tenantID, id string, req *models.UpdateKnownErrorRequest) (*models.KnownError, error)
	DeleteKnownError(ctx context.Context, tenantID, id string) error
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all problem endpoints under the /problem group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/problem")

	// === Problem CRUD ===
	f.GET("", auth.RequirePermission("problem", "read"), h.ListProblems)
	f.POST("", auth.RequirePermission("problem", "write"), h.CreateProblem)
	f.GET("/:id", auth.RequirePermission("problem", "read"), h.GetProblem)
	f.PUT("/:id", auth.RequirePermission("problem", "write"), h.UpdateProblem)
	f.DELETE("/:id", auth.RequirePermission("problem", "delete"), h.DeleteProblem)
	f.GET("/stats", auth.RequirePermission("problem", "read"), h.GetStats)

	// === Status transition ===
	f.PATCH("/:id/status", auth.RequirePermission("problem", "write"), h.UpdateStatus)

	// === Linking ===
	f.POST("/:id/link/incident", auth.RequirePermission("problem", "write"), h.LinkIncident)
	f.POST("/:id/link/change", auth.RequirePermission("problem", "write"), h.LinkChange)
	f.GET("/:id/incidents", auth.RequirePermission("problem", "read"), h.GetIncidentLinks)
	f.GET("/:id/changes", auth.RequirePermission("problem", "read"), h.GetChangeLinks)

	// === Known Errors (KEDB) ===
	f.GET("/known-errors", auth.RequirePermission("problem", "read"), h.ListKnownErrors)
	f.GET("/known-errors/search", auth.RequirePermission("problem", "read"), h.SearchKnownErrors)
	f.GET("/known-errors/:id", auth.RequirePermission("problem", "read"), h.GetKnownError)
	f.POST("/known-errors", auth.RequirePermission("problem", "write"), h.CreateKnownError)
	f.PUT("/known-errors/:id", auth.RequirePermission("problem", "write"), h.UpdateKnownError)
	f.DELETE("/known-errors/:id", auth.RequirePermission("problem", "delete"), h.DeleteKnownError)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) getAuthUserID(c *gin.Context) *string {
	userID := c.GetString("user_id")
	if userID == "" {
		return nil
	}
	return &userID
}

// ==================== Problem CRUD ====================

func (h *Handler) ListProblems(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListProblems")
	defer span.End()
	tenantID := h.getTenantID(c)

	filter := &models.ProblemFilter{
		Status:     ptrString(c.Query("status")),
		Severity:   ptrString(c.Query("severity")),
		AssignedTo: ptrString(c.Query("assignedTo")),
		Category:   ptrString(c.Query("category")),
	}
	if p := c.Query("page"); p != "" {
		filter.Offset = (ptrInt(c, "page", 1) - 1) * ptrInt(c, "pageSize", 20)
		filter.Limit = ptrInt(c, "pageSize", 20)
	}

	problems, total, err := h.svc.ListProblems(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"problems": problems, "total": total})
}

func (h *Handler) GetProblem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProblem")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	problem, err := h.svc.GetProblem(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"problem": problem})
}

func (h *Handler) CreateProblem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateProblem")
	defer span.End()
	tenantID := h.getTenantID(c)

	var req models.CreateProblemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.CreatedBy = h.getAuthUserID(c)

	problem, err := h.svc.CreateProblem(ctx, tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"problem": problem})
}

func (h *Handler) UpdateProblem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateProblem")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	var req models.UpdateProblemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	updated, err := h.svc.UpdateProblem(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"problem": updated})
}

func (h *Handler) DeleteProblem(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteProblem")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	err := h.svc.DeleteProblem(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "problem deleted"})
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := h.getTenantID(c)

	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"stats": stats})
}

// ==================== Status Transition ====================

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	reqStruct := models.UpdateProblemRequest{Status: &req.Status}
	updated, err := h.svc.UpdateProblem(ctx, tenantID, id, &reqStruct)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"problem": updated})
}

// ==================== Linking ====================

func (h *Handler) LinkIncident(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LinkIncident")
	defer span.End()
	tenantID := h.getTenantID(c)
	problemID := c.Param("id")

	var req struct {
		IncidentID string `json:"incidentId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	problem, err := h.svc.LinkIncident(ctx, tenantID, problemID, req.IncidentID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"problem": problem, "incidentId": req.IncidentID})
}

func (h *Handler) GetIncidentLinks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetIncidentLinks")
	defer span.End()
	tenantID := h.getTenantID(c)
	problemID := c.Param("id")

	links, err := h.svc.GetIncidentLinks(ctx, tenantID, problemID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"incidentIds": links})
}

func (h *Handler) LinkChange(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LinkChange")
	defer span.End()
	tenantID := h.getTenantID(c)
	problemID := c.Param("id")

	var req struct {
		ChangeID string `json:"changeId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	problem, err := h.svc.LinkChange(ctx, tenantID, problemID, req.ChangeID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"problem": problem, "changeId": req.ChangeID})
}

func (h *Handler) GetChangeLinks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeLinks")
	defer span.End()
	tenantID := h.getTenantID(c)
	problemID := c.Param("id")

	links, err := h.svc.GetChangeLinks(ctx, tenantID, problemID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"changeIds": links})
}

// ==================== Known Errors (KEDB) ====================

func (h *Handler) ListKnownErrors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListKnownErrors")
	defer span.End()
	tenantID := h.getTenantID(c)

	filter := &models.KnownErrorFilter{
		ProblemID: ptrString(c.Query("problemId")),
		Limit:     ptrInt(c, "pageSize", 20),
		Offset:    (ptrInt(c, "page", 1) - 1) * ptrInt(c, "pageSize", 20),
	}

	kes, total, err := h.svc.ListKnownErrors(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"knownErrors": kes, "total": total})
}

func (h *Handler) SearchKnownErrors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchKnownErrors")
	defer span.End()
	tenantID := h.getTenantID(c)
	query := c.Query("q")

	kes, total, err := h.svc.SearchKnownErrors(ctx, tenantID, query)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"knownErrors": kes, "total": total})
}

func (h *Handler) GetKnownError(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetKnownError")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	ke, err := h.svc.GetKnownError(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "known error not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"knownError": ke})
}

func (h *Handler) CreateKnownError(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateKnownError")
	defer span.End()
	tenantID := h.getTenantID(c)

	var req models.CreateKnownErrorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.CreatedBy = h.getAuthUserID(c)

	ke, err := h.svc.CreateKnownError(ctx, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "problem not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"knownError": ke})
}

func (h *Handler) UpdateKnownError(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateKnownError")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	var req models.UpdateKnownErrorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	ke, err := h.svc.UpdateKnownError(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "known error not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"knownError": ke})
}

func (h *Handler) DeleteKnownError(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteKnownError")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")

	err := h.svc.DeleteKnownError(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "known error not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "known error deleted"})
}

// ==================== Helpers ====================

func ptrString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptrInt(c *gin.Context, key string, defaultVal int) int {
	v := c.Query(key)
	if v == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(v)
	if err != nil || i < 0 {
		return defaultVal
	}
	return i
}
