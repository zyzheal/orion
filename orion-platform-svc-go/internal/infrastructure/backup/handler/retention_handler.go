package handler

import (
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/backup/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/middleware"
)

// RetentionHandler exposes backup retention cleanup endpoints. The service
// owns the actual purge logic (see service.retention.go); this handler
// only parses requests and reports the outcome.
type RetentionHandler struct {
	backupSvc *service.BackupService
	log       *zap.Logger
}

// NewRetentionHandler returns a RetentionHandler bound to the given backup
// service. The handler is safe to use even when the service is nil — the
// routes return 503 in that case so operators can see the mis-wiring.
func NewRetentionHandler(backupSvc *service.BackupService, log *zap.Logger) *RetentionHandler {
	return &RetentionHandler{backupSvc: backupSvc, log: log}
}

// RegisterRoutes mounts /backup/retention under the given group.
func (h *RetentionHandler) RegisterRoutes(rg *gin.RouterGroup) {
	bg := rg.Group("/backup")
	bg.POST("/retention/purge", auth.RequirePermission("backup", "delete"), h.PurgeTenant)
	bg.POST("/retention/purge-all", auth.RequirePermission("backup", "delete"), h.PurgeAll)
	bg.GET("/retention/status", auth.RequirePermission("backup", "read"), h.Status)
}

// PurgeTenant purges expired backups for the current tenant. The tenant
// is taken from the auth context; query params override.
func (h *RetentionHandler) PurgeTenant(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RetentionPurgeTenant")
	defer span.End()
	if h.backupSvc == nil {
		middleware.RespondServiceUnavailable(c, "backup service not configured")
		return
	}
	tenantID := c.DefaultQuery("tenant_id", c.GetString("tenant_id"))
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant_id required")
		return
	}
	res, err := h.backupSvc.PurgeExpired(ctx, tenantID)
	if err != nil {
		h.log.Error("purge failed", zap.String("tenant_id", tenantID), zap.Error(err))
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"result": res})
}

// PurgeAll purges expired backups across all tenants. Reserved for
// operators — requires the same permission as PurgeTenant. Accepts an
// optional ?dry_run=1 query param to preview the outcome without
// deleting artifacts.
func (h *RetentionHandler) PurgeAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RetentionPurgeAll")
	defer span.End()
	if h.backupSvc == nil {
		middleware.RespondServiceUnavailable(c, "backup service not configured")
		return
	}
	dryRun := c.DefaultQuery("dry_run", "0") == "1"
	start := time.Now()
	var out map[string]*service.RetentionResult
	if dryRun {
		out = h.backupSvc.PurgeAllWithOptions(ctx, service.PurgeAllOptions{DryRun: true})
	} else {
		out = h.backupSvc.PurgeAll(ctx)
	}
	middleware.RespondSuccess(c, gin.H{
		"results":    out,
		"dryRun":     dryRun,
		"durationMs": time.Since(start).Milliseconds(),
	})
}

// Status reports whether retention cleanup is configured. It does not
// run the purge; it's a lightweight probe for operator dashboards.
func (h *RetentionHandler) Status(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RetentionStatus")
	defer span.End()
	configured := h.backupSvc != nil
	middleware.RespondSuccess(c, gin.H{
		"configured": configured,
		"time":       time.Now().UTC().Format(time.RFC3339),
	})
}
