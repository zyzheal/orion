package handler

import (
	"strconv"
	"time"

	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/middleware"
)

// ArchiveHandler exposes the WAL/binlog archiver behind a small REST surface.
// It is a thin wrapper around service.Archiver — the handler only parses
// requests, runs the archiver, and serialises the result.
type ArchiveHandler struct {
	archiver *service.Archiver
	log      *zap.Logger
	// parent is the parent backup handler, kept only so ArchiveHandler can
	// be constructed alongside the main handler and share the router group.
	parent *Handler
}

// NewArchiveHandler returns an ArchiveHandler bound to the given archiver.
// parent may be nil — it is only used for co-mounting the routes.
func NewArchiveHandler(archiver *service.Archiver, parent *Handler, log *zap.Logger) *ArchiveHandler {
	return &ArchiveHandler{archiver: archiver, log: log, parent: parent}
}

// RegisterRoutes mounts /backup/archive routes under the given group. All
// routes are permission-guarded.
func (h *ArchiveHandler) RegisterRoutes(rg *gin.RouterGroup) {
	bg := rg.Group("/backup")
	bg.POST("/archive/run", auth.RequirePermission("backup", "execute"), h.Run)
	bg.GET("/archive", auth.RequirePermission("backup", "read"), h.List)
	bg.GET("/archive/seen", auth.RequirePermission("backup", "read"), h.Seen)
	bg.DELETE("/archive/seen", auth.RequirePermission("backup", "write"), h.ResetSeen)
}

// RunRequest is the payload for a manual archive run.
type RunRequest struct {
	SourceDir     string                     `json:"sourceDir" binding:"required"`
	PlanID        string                     `json:"planId" binding:"required"`
	TenantID      string                     `json:"tenantId"`
	ArchiveType   models.ArchiveType         `json:"archiveType" binding:"required"`
	StorageConfig models.BackupStorageConfig `json:"storageConfig,omitempty"`
	EncryptionKey string                     `json:"encryptionKey,omitempty"` // base64
	WindowStart   *time.Time                 `json:"windowStart,omitempty"`
	WindowEnd     *time.Time                 `json:"windowEnd,omitempty"`
	DryRun        bool                       `json:"dryRun"`
}

// Run executes one archive window and returns the per-file records.
func (h *ArchiveHandler) Run(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BackupArchiveRun")
	defer span.End()

	var req RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := req.TenantID
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	var key []byte
	if req.EncryptionKey != "" {
		key = []byte(req.EncryptionKey)
	}
	opts := service.ArchiveOptions{
		SourceDir:     req.SourceDir,
		PlanID:        req.PlanID,
		TenantID:      tenantID,
		ArchiveType:   req.ArchiveType,
		StorageConfig: req.StorageConfig,
		EncryptionKey: key,
		DryRun:        req.DryRun,
	}
	if req.WindowStart != nil {
		opts.WindowStart = *req.WindowStart
	}
	if req.WindowEnd != nil {
		opts.WindowEnd = *req.WindowEnd
	}

	res, err := h.archiver.ArchiveWindow(ctx, opts)
	if err != nil {
		h.log.Error("archive run failed", zap.Error(err))
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"result": res})
}

// List returns archived records filtered by tenant/plan/window.
func (h *ArchiveHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BackupArchiveList")
	defer span.End()

	q := service.ArchiveQuery{
		TenantID: c.DefaultQuery("tenant_id", c.GetString("tenant_id")),
		PlanID:   c.Query("plan_id"),
		Limit:    100,
	}
	if v := c.Query("archive_type"); v != "" {
		q.ArchiveType = models.ArchiveType(v)
	}
	if v := c.Query("window_start"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.WindowStart = t
		}
	}
	if v := c.Query("window_end"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.WindowEnd = t
		}
	}
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			q.Limit = n
		}
	}
	out, err := h.archiver.Query(ctx, q)
	if err != nil {
		h.log.Error("archive list failed", zap.Error(err))
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"items": out, "total": len(out)})
}

// Seen returns the in-memory dedupe cache (path -> mtime).
func (h *ArchiveHandler) Seen(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{"seen": h.archiver.ListSeen()})
}

// ResetSeen clears the dedupe cache so the next run retries previously
// processed files.
func (h *ArchiveHandler) ResetSeen(c *gin.Context) {
	h.archiver.ResetSeen()
	middleware.RespondSuccess(c, gin.H{"reset": true})
}
