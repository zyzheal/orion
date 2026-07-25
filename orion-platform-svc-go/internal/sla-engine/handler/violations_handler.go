package handler

import (
    "context"
    "strconv"
    "time"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/sla-engine/events"
    "orion/platform-svc-go/internal/sla-engine/models"
    "orion/platform-svc-go/internal/sla-engine/service"

    "github.com/gin-gonic/gin"
    "go.opentelemetry.io/otel"
)

// ViolationHandler exposes SLA violation, compliance, and scan endpoints.
type ViolationHandler struct {
    calc *service.SLACalculator
}

func NewViolationHandler(calc *service.SLACalculator) *ViolationHandler {
    return &ViolationHandler{calc: calc}
}

// RegisterRoutes registers violation/compliance/scan endpoints. Call this after
// Handler.RegisterRoutes to extend the SLA API surface.
func (vh *ViolationHandler) RegisterRoutes(rg *gin.RouterGroup) {
    f := rg.Group("/sla")

    // Violations
    f.GET("/violations", auth.RequirePermission("sla-engine", "read"), vh.ListViolations)
    f.GET("/violations/:tracker_id", auth.RequirePermission("sla-engine", "read"), vh.GetViolationsByTracker)

    // Compliance report
    f.GET("/compliance", auth.RequirePermission("sla-engine", "read"), vh.GetComplianceReport)

    // Breach scan (background job API)
    f.POST("/scan", auth.RequirePermission("sla-engine", "manage"), vh.ScanBreaches)

    // Violation statistics
    f.GET("/violation-statistics", auth.RequirePermission("sla-engine", "read"), vh.GetViolationStatistics)
}

// --- Violations ---

func (vh *ViolationHandler) ListViolations(c *gin.Context) {
    ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListViolations")
    defer span.End()
    tenantID := c.GetString("tenant_id")
    q := models.ViolationListQuery{Limit: 50}
    if l := c.DefaultQuery("limit", "50"); l != "" {
        q.Limit, _ = strconv.Atoi(l)
    }
    if o := c.DefaultQuery("offset", "0"); o != "" {
        q.Offset, _ = strconv.Atoi(o)
    }
    if t := c.Query("tracker_id"); t != "" {
        q.TrackerID = t
    }
    if s := c.Query("severity"); s != "" {
        q.Severity = s
    }
    if vt := c.Query("violation_type"); vt != "" {
        q.ViolationType = vt
    }

    violations, err := vh.listViolations(ctx, tenantID, q)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
        return
    }
    errors.WriteSuccess(c, violations)
}

func (vh *ViolationHandler) GetViolationsByTracker(c *gin.Context) {
    ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetViolationsByTracker")
    defer span.End()
    trackerID := c.Param("tracker_id")
    violations, err := vh.calc.GetViolationsByTracker(ctx, trackerID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
        return
    }
    if violations == nil {
        violations = []models.SLAViolation{}
    }
    errors.WriteSuccess(c, violations)
}

// --- Compliance ---

func (vh *ViolationHandler) GetComplianceReport(c *gin.Context) {
    ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComplianceReport")
    defer span.End()
    tenantID := c.GetString("tenant_id")

    startRaw := c.Query("start_date")
    endRaw := c.Query("end_date")
    severity := models.SeverityLevel(c.Query("severity"))

    var startDate, endDate time.Time
    if startRaw == "" || endRaw == "" {
        // Default: last 30 days
        endDate = time.Now().UTC()
        startDate = endDate.Add(-30 * 24 * time.Hour)
    } else {
        var err error
        startDate, err = parseRFC3339(startRaw)
        if err != nil {
            errors.WriteError(c, errors.ErrBadRequest, "invalid start_date", 400)
            return
        }
        endDate, err = parseRFC3339(endRaw)
        if err != nil {
            errors.WriteError(c, errors.ErrBadRequest, "invalid end_date", 400)
            return
        }
    }
    report, err := vh.calc.ComplianceReport(ctx, tenantID, startDate, endDate, severity)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
        return
    }
    errors.WriteSuccess(c, report)
}

// --- Breach Scan ---

func (vh *ViolationHandler) ScanBreaches(c *gin.Context) {
    ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScanBreaches")
    defer span.End()
    tenantID := c.GetString("tenant_id")
    alerts, err := vh.calc.ScanBreaches(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
        return
    }
    if alerts == nil {
        alerts = []events.ViolationAlert{}
    }
    errors.WriteSuccess(c, gin.H{
        "alerts_scanned": len(alerts),
        "alerts":         alerts,
    })
}

// --- Violation Statistics ---

func (vh *ViolationHandler) GetViolationStatistics(c *gin.Context) {
    ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetViolationStatistics")
    defer span.End()
    tenantID := c.GetString("tenant_id")
    stats, err := vh.calc.GetViolationStatistics(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
        return
    }
    errors.WriteSuccess(c, stats)
}

// listViolations delegates to the repo via calculator.
// The GetViolationsByTracker signature (context.Context, trackerID) does not yet support
// tenantID/filter params, so we pass the context and empty trackerID.
func (vh *ViolationHandler) listViolations(ctx context.Context, tenantID string, q models.ViolationListQuery) ([]models.SLAViolation, error) {
    return vh.calc.GetViolationsByTracker(ctx, "")
}

func parseRFC3339(s string) (time.Time, error) {
    t, err := time.Parse(time.RFC3339, s)
    if err != nil {
        t, err = time.Parse("2006-01-02T15:04:05Z", s)
        if err != nil {
            t, err = time.Parse("2006-01-02", s)
        }
    }
    return t, err
}
