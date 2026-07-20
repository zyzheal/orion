package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/diagnostic/models"
	"orion/platform-svc-go/internal/diagnostic/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all diagnostic endpoints under the given group.
// Mirrors /api/v1/diagnostic routes from the TS source (14 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/diagnostic")

	// --- Trigger ---
	// POST /diagnostic/trigger - Trigger a diagnostic
	f.POST("/trigger", auth.RequirePermission("diagnostic", "write"), h.Trigger)

	// --- Sessions ---
	// GET /diagnostic/sessions - Get diagnostic history
	f.GET("/sessions", auth.RequirePermission("diagnostic", "read"), h.ListSessions)
	// GET /diagnostic/sessions/:id - Get diagnostic detail
	f.GET("/sessions/:id", auth.RequirePermission("diagnostic", "read"), h.GetSession)
	// POST /diagnostic/sessions/:id/symptoms - Add symptom to session
	f.POST("/sessions/:id/symptoms", auth.RequirePermission("diagnostic", "write"), h.AddSymptom)
	// POST /diagnostic/sessions/:id/complete - Complete session
	f.POST("/sessions/:id/complete", auth.RequirePermission("diagnostic", "write"), h.CompleteSession)
	// GET /diagnostic/sessions/:id/complexity - Estimate fix complexity
	f.GET("/sessions/:id/complexity", auth.RequirePermission("diagnostic", "read"), h.EstimateComplexity)

	// --- Reports ---
	// GET /diagnostic/reports - Get report history
	f.GET("/reports", auth.RequirePermission("diagnostic", "read"), h.ListReports)
	// GET /diagnostic/reports/:id - Get report detail
	f.GET("/reports/:id", auth.RequirePermission("diagnostic", "read"), h.GetReport)

	// --- Knowledge ---
	// POST /diagnostic/knowledge/patterns - Add diagnostic pattern
	f.POST("/knowledge/patterns", auth.RequirePermission("diagnostic", "write"), h.AddPattern)
	// GET /diagnostic/knowledge/patterns - Search diagnostic patterns
	f.GET("/knowledge/patterns", auth.RequirePermission("diagnostic", "read"), h.ListPatterns)
	// GET /diagnostic/knowledge/patterns/:id - Get pattern detail
	f.GET("/knowledge/patterns/:id", auth.RequirePermission("diagnostic", "read"), h.GetPattern)
	// GET /diagnostic/knowledge/stats - Get knowledge base stats
	f.GET("/knowledge/stats", auth.RequirePermission("diagnostic", "read"), h.GetStats)
	// POST /diagnostic/knowledge/outcomes - Record diagnostic outcome
	f.POST("/knowledge/outcomes", auth.RequirePermission("diagnostic", "write"), h.RecordOutcome)

	// --- Status ---
	// GET /diagnostic/status - Get diagnostic service status
	f.GET("/status", auth.RequirePermission("diagnostic", "read"), h.GetStatus)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// --- Trigger ---

func (h *Handler) Trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Trigger")
	defer span.End()
	var req models.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if len(req.Symptoms) == 0 {
		middleware.RespondBadRequest(c, "symptoms is required")
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.TriggerDiagnostic(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// --- Sessions ---

func (h *Handler) ListSessions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSessions")
	defer span.End()
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	statusPtr := &status
	if status == "" {
		statusPtr = nil
	}
	triggerType := c.Query("triggerType")
	triggerTypePtr := &triggerType
	if triggerType == "" {
		triggerTypePtr = nil
	}
	triggerID := c.Query("triggerId")
	triggerIDPtr := &triggerID
	if triggerID == "" {
		triggerIDPtr = nil
	}
	sessions, total, err := h.svc.GetDiagnosticHistory(ctx, tenantID, statusPtr, triggerTypePtr, triggerIDPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     sessions,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) GetSession(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSession")
	defer span.End()
	id := c.Param("id")
	session, err := h.svc.GetDiagnosticDetail(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	// Try to include the associated report
	report, _ := h.svc.GetReportBySession(ctx, id)
	middleware.RespondSuccess(c, models.SessionWithReport{
		Session: *session,
		Report:  report,
	})
}

func (h *Handler) AddSymptom(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddSymptom")
	defer span.End()
	id := c.Param("id")
	var req models.AddSymptomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	session, err := h.svc.AddSymptomToSession(ctx, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, session)
}

func (h *Handler) CompleteSession(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteSession")
	defer span.End()
	id := c.Param("id")
	result, err := h.svc.CompleteSession(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) EstimateComplexity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EstimateComplexity")
	defer span.End()
	id := c.Param("id")
	estimate, err := h.svc.EstimateFixComplexity(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic session not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, estimate)
}

// --- Reports ---

func (h *Handler) ListReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReports")
	defer span.End()
	tenantID := h.getTenantID(c)
	tenantIDPtr := &tenantID
	sessionID := c.Query("sessionId")
	sessionIDPtr := &sessionID
	if sessionID == "" {
		sessionIDPtr = nil
	}
	_ = c.Query("limit") // unused for now
	reports, total, err := h.svc.GetReportHistory(ctx, tenantIDPtr, sessionIDPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     reports,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReport")
	defer span.End()
	id := c.Param("id")
	report, err := h.svc.GetReport(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic report not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Knowledge ---

func (h *Handler) AddPattern(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddPattern")
	defer span.End()
	var req models.CreatePatternRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	pattern, err := h.svc.AddPattern(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pattern)
}

func (h *Handler) ListPatterns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPatterns")
	defer span.End()
	tenantID := h.getTenantID(c)
	tenantIDPtr := &tenantID
	category := c.Query("category")
	categoryPtr := &category
	if category == "" {
		categoryPtr = nil
	}
	keyword := c.Query("keyword")
	keywordPtr := &keyword
	if keyword == "" {
		keywordPtr = nil
	}
	_ = c.Query("minFrequency")
	_ = c.Query("limit")
	patterns, total, err := h.svc.SearchPatterns(ctx, tenantIDPtr, categoryPtr, keywordPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     patterns,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) GetPattern(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPattern")
	defer span.End()
	id := c.Param("id")
	pattern, err := h.svc.GetPattern(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic pattern not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pattern)
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := h.getTenantID(c)
	stats, err := h.svc.GetKnowledgeBaseStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) RecordOutcome(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordOutcome")
	defer span.End()
	var req models.RecordOutcomeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	outcome, err := h.svc.RecordOutcome(ctx, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "diagnostic session or pattern not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, outcome)
}

// --- Status ---

func (h *Handler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatus")
	defer span.End()
	tenantID := h.getTenantID(c)
	status, err := h.svc.GetStatus(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}
