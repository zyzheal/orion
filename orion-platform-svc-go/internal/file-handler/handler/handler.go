package handler

import (
	"encoding/json"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/file-handler/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler handles HTTP requests for the file-handler module.
type Handler struct {
	svc *service.FileStorageManager
}

// NewHandler creates a new file-handler handler.
func NewHandler(svc *service.FileStorageManager) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all file-handler endpoints under the /files group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/api/files")

	// === Files ===
	f.POST("", auth.RequirePermission("files", "write"), h.Upload)
	f.GET("", auth.RequirePermission("files", "read"), h.List)
	f.GET("/:id", auth.RequirePermission("files", "read"), h.Get)
	f.GET("/:id/download", auth.RequirePermission("files", "read"), h.Download)
	// Download is large; skip size limit on download endpoint
	f.DELETE("/:id", auth.RequirePermission("files", "delete"), h.Delete)
	f.POST("/:id/move", auth.RequirePermission("files", "write"), h.Move)
	f.GET("/:id/url", auth.RequirePermission("files", "read"), h.URL)

	// === Validate ===
	f.POST("/validate", h.Validate)

	// === Storage backends ===
	f.POST("/storage/backends", auth.RequirePermission("files", "write"), h.CreateBackend)
	f.GET("/storage/backends", auth.RequirePermission("files", "read"), h.ListBackends)
}

// Upload handles multipart file upload.
func (h *Handler) Upload(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Upload")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	owner := c.GetString("user_id")

	form, err := c.MultipartForm()
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid multipart form", 400)
		return
	}

	files := form.File["file"]
	if len(files) == 0 {
		errors.WriteError(c, errors.ErrBadRequest, "file field is required", 400)
		return
	}
	file := files[0]

	opened, err := file.Open()
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "failed to open uploaded file", 400)
		return
	}
	defer opened.Close()

	// Build the FileRecord metadata.
	storageType := c.PostForm("storageType")
	if storageType == "" {
		storageType = "local"
	}
	bucket := c.PostForm("bucket")
	if bucket == "" {
		bucket = "uploads"
	}
	category := c.PostForm("category")
	visibility := c.PostForm("visibility")
	if visibility == "" {
		visibility = "private"
	}
	tags := c.PostForm("tags")

	record, err := h.svc.StoreFile(ctx, tenantID, owner, bucket, storageType, category, visibility, tags, file.Filename, opened, file.Size)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "upload failed: "+err.Error(), 500)
		return
	}
	errors.WriteCreated(c, record)
}

// List retrieves paginated file records for the tenant.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	category := c.Query("category")
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		limit = 50
	}
	offset, _ := strconv.Atoi(c.Query("offset"))

	files, err := h.svc.ListFiles(ctx, tenantID, category, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "list files failed: "+err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": files, "total": len(files)})
}

// Get retrieves a single file record by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	record, err := h.svc.GetFile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "file not found", 404)
		return
	}
	errors.WriteSuccess(c, record)
}

// Download streams the file content back to the client.
func (h *Handler) Download(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Download")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	data, record, err := h.svc.DownloadFile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "file not found", 404)
		return
	}

	origName := record.Name
	c.Header("Content-Type", record.Type)
	c.Header("Content-Disposition", "attachment; filename="+origName)
	c.Header("Content-Length", strconv.FormatInt(record.Size, 10))
	c.Data(200, record.Type, data)
}

// Delete removes a file from storage and the DB.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	err := h.svc.DeleteFile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "file not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deleted"})
}

// Move moves or renames a file record.
func (h *Handler) Move(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Move")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req service.MoveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	record, err := h.svc.MoveFile(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "file not found", 404)
		return
	}
	errors.WriteSuccess(c, record)
}

// URL returns the download URL for a file.
func (h *Handler) URL(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "URL")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	urlStr, err := h.svc.FileURL(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "file not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"url": urlStr})
}

// Validate checks whether a file type/extension is allowed.
func (h *Handler) Validate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Validate")
	defer span.End()

	var req struct {
		Extension string `json:"extension" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if err := h.svc.ValidateFileType(ctx, req.Extension, nil); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	errors.WriteSuccess(c, gin.H{"valid": true, "extension": req.Extension})
}

// CreateBackend creates a new storage backend configuration.
func (h *Handler) CreateBackend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBackend")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req struct {
		Name    string                 `json:"name" binding:"required"`
		Type    string                 `json:"type" binding:"required"`
		Config  map[string]interface{} `json:"config"`
		Enabled bool                   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	cfgBytes, _ := json.Marshal(req.Config)
	record, err := h.svc.CreateBackend(ctx, tenantID, req.Name, req.Type, string(cfgBytes), req.Enabled)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "create backend failed: "+err.Error(), 500)
		return
	}
	errors.WriteCreated(c, record)
}

// ListBackends lists storage backends for the tenant.
func (h *Handler) ListBackends(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBackends")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	backends, err := h.svc.ListBackends(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "list backends failed: "+err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": backends, "total": len(backends)})
}
