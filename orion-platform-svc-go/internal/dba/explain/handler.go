package explain

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the explain Service over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler wires a Handler around a Service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the explain endpoints under /dba/explain.
//
// Routes:
//   POST /dba/explain/analyze  — run EXPLAIN + suggestions
//   GET  /dba/explain/history  — recent explain jobs for the tenant
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/dba/explain")
	f.POST("/analyze", auth.RequirePermission("dba", "execute"), h.Analyze)
	f.GET("/history", auth.RequirePermission("dba", "read"), h.History)
}

// Analyze handles POST /dba/explain/analyze.
func (h *Handler) Analyze(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExplainAnalyze")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req ExplainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Explain(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// History handles GET /dba/explain/history.
func (h *Handler) History(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExplainHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	list, err := h.svc.RecentHistory(ctx, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}
