package slowquery

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the slowquery Service over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler wires a Handler around a Service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the slowquery endpoints under /dba/slowquery.
//
// Routes:
//   POST /dba/slowquery/collect        — kick off a collection pass
//   GET  /dba/slowquery/top            — Top N slow queries
//   POST /dba/slowquery/analyze        — heuristic analysis on one SQL
//   GET  /dba/slowquery/stats          — aggregate counts
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/dba/slowquery")
	f.POST("/collect", auth.RequirePermission("dba", "execute"), h.Collect)
	f.GET("/top", auth.RequirePermission("dba", "read"), h.TopN)
	f.POST("/analyze", auth.RequirePermission("dba", "write"), h.Analyze)
	f.GET("/stats", auth.RequirePermission("dba", "read"), h.Stats)
}

// Collect handles POST /dba/slowquery/collect.
func (h *Handler) Collect(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SlowQueryCollect")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req CollectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	n, err := h.svc.Collect(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"collected": n})
}

// TopN handles GET /dba/slowquery/top.
func (h *Handler) TopN(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SlowQueryTopN")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	req := TopNRequest{
		DataSourceID: c.Query("data_source_id"),
		TenantID:     c.GetString("tenant_id"),
		Limit:        limit,
		OrderBy:      c.DefaultQuery("order_by", "total_time_ms"),
	}
	if req.DataSourceID == "" {
		middleware.RespondBadRequest(c, "data_source_id is required")
		return
	}
	if sinceStr := c.Query("since"); sinceStr != "" {
		if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			req.Since = &t
		}
	}
	list, err := h.svc.TopN(ctx, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

// Analyze handles POST /dba/slowquery/analyze.
func (h *Handler) Analyze(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SlowQueryAnalyze")
	defer span.End()
	var req AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Analyze(ctx, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// Stats handles GET /dba/slowquery/stats.
func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SlowQueryStats")
	defer span.End()
	dsID := c.Query("data_source_id")
	if dsID == "" {
		middleware.RespondBadRequest(c, "data_source_id is required")
		return
	}
	tenantID := c.GetString("tenant_id")
	windowH := 24
	if s := c.DefaultQuery("window_hours", "24"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			windowH = v
		}
	}
	n, err := h.svc.Stats(ctx, tenantID, dsID, time.Now().UTC().Add(-time.Duration(windowH)*time.Hour))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"distinct_queries": n,
		"window_hours":     windowH,
	})
}
